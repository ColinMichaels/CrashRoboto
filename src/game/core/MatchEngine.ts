import {
  CARDS,
  DEFAULT_ENEMY_DECK,
  DEFAULT_GAME_MODE_ID,
  DEFAULT_PLAYER_DECK,
  ENEMY_BRIDGE_EDGE_Y,
  FIXED_STEP_MS,
  GAME_MODES,
  HAND_SIZE,
  INSTALLATIONS,
  MAX_CHARGE,
  OVERDRIVE_AURA_RADIUS,
  OVERDRIVE_COOLDOWN_MS,
  OVERDRIVE_COST,
  OVERDRIVE_DURATION_MS,
  PLAYER_BRIDGE_EDGE_Y,
  PROGRAMS,
  PROGRAM_TOWER_DAMAGE_MULTIPLIER,
  ROBOTS,
  TOWER_COMBAT_RADIUS,
  cloneRobotUpgrades,
  createDefaultMatchConfig,
  createDefaultTowerWeapons,
  createEmptyRobotUpgrades,
  createTowers,
  getEffectiveRobotStats,
  getLaneX,
  getMatchStage,
  getOpponent,
  getUpgradeCost,
  normalizePlayerUpgrades,
  validateMatchConfig,
} from './content';
import {
  hasDeploymentBreach,
} from './deployment';
import { SCORE_AWARDS } from './progression';
import { evaluatePlacement } from './placementFeedback';
import type {
  CardId,
  CombatEntityRef,
  CommanderAbilityState,
  GameCommand,
  GameEvent,
  InstallationState,
  Lane,
  MatchConfig,
  MatchResult,
  MatchSnapshot,
  ProjectileKind,
  ProgramZoneState,
  RobotKind,
  RobotCardId,
  RobotUpgradeBook,
  RobotUpgradeState,
  Team,
  TowerState,
  UnitState,
  UpgradeStat,
} from './types';

type EventSink = (event: GameEvent) => void;
type StructureState = TowerState | InstallationState;

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed || 0x9e3779b9;
  }

  next(): number {
    let x = this.state | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    return (x >>> 0) / 0x1_0000_0000;
  }
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const cloneDecks = (decks: Record<Team, CardId[]>): Record<Team, CardId[]> => ({
  player: [...decks.player],
  enemy: [...decks.enemy],
});

const deriveSeed = (seed: number, salt: number): number => {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
};

const shuffleDeck = (deck: readonly CardId[], seed: number): CardId[] => {
  const shuffled = [...deck];
  const random = new SeededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const createOpeningDecks = (decks: Record<Team, CardId[]>, seed: number): Record<Team, CardId[]> => ({
  player: shuffleDeck(decks.player, deriveSeed(seed, 0x504c4159)),
  enemy: shuffleDeck(decks.enemy, deriveSeed(seed, 0x454e454d)),
});

const dealHands = (openingDecks: Record<Team, CardId[]>): Record<Team, CardId[]> => ({
  player: openingDecks.player.slice(0, HAND_SIZE),
  enemy: openingDecks.enemy.slice(0, HAND_SIZE),
});

const dealQueues = (openingDecks: Record<Team, CardId[]>): Record<Team, CardId[]> => ({
  player: openingDecks.player.slice(HAND_SIZE),
  enemy: openingDecks.enemy.slice(HAND_SIZE),
});

const createUpgradeBook = (
  playerUpgrades: Record<RobotCardId, RobotUpgradeState> = createEmptyRobotUpgrades(),
): RobotUpgradeBook => ({
  player: cloneRobotUpgrades(playerUpgrades),
  enemy: createEmptyRobotUpgrades(),
});

const isInstallation = (structure: StructureState): structure is InstallationState =>
  'remainingMs' in structure;

export class MatchEngine {
  private phase: MatchSnapshot['phase'] = 'menu';
  private modeId = DEFAULT_GAME_MODE_ID;
  private decks: Record<Team, CardId[]> = {
    player: [...DEFAULT_PLAYER_DECK],
    enemy: [...DEFAULT_ENEMY_DECK],
  };
  private openingDecks = cloneDecks(this.decks);
  private remainingMs = GAME_MODES[DEFAULT_GAME_MODE_ID].durationMs;
  private charge: Record<Team, number> = {
    player: GAME_MODES[DEFAULT_GAME_MODE_ID].startingCharge,
    enemy: GAME_MODES[DEFAULT_GAME_MODE_ID].startingCharge,
  };
  private score: Record<Team, number> = { player: 0, enemy: 0 };
  private battleScore: Record<Team, number> = { player: 0, enemy: 0 };
  private towers = createTowers();
  private units: UnitState[] = [];
  private installations: InstallationState[] = [];
  private zones: ProgramZoneState[] = [];
  private hands = dealHands(this.openingDecks);
  private queues = dealQueues(this.openingDecks);
  private selected: CardId | null = null;
  private commanderCooldown: Record<Team, number> = { player: 0, enemy: 0 };
  private configuredPlayerUpgrades = createEmptyRobotUpgrades();
  private configuredPlayerTowerWeapons = createDefaultTowerWeapons();
  private upgrades = createUpgradeBook();
  private result: MatchResult | null = null;
  private guidance: string | null = null;
  private guidanceMs = 0;
  private overclockAnnounced = false;
  private revision = 0;
  private unitCounter = 0;
  private installationCounter = 0;
  private zoneCounter = 0;
  private attackCounter = 0;
  private aiDecisionMs = 900;
  private playDebounce: Record<Team, number> = { player: 0, enemy: 0 };
  private random: SeededRandom;

  constructor(
    private readonly emit: EventSink = () => undefined,
    private readonly seed = 0xc0ffee,
  ) {
    this.random = new SeededRandom(seed);
    this.openingDecks = createOpeningDecks(this.decks, seed);
    this.hands = dealHands(this.openingDecks);
    this.queues = dealQueues(this.openingDecks);
  }

  dispatch(command: GameCommand): boolean {
    switch (command.type) {
      case 'start': {
        const config = command.config === undefined
          ? createDefaultMatchConfig()
          : validateMatchConfig(command.config);
        if (!config) return false;
        this.lockMatchConfig(config);
        this.reset('playing');
        return true;
      }
      case 'restart':
        this.reset('playing');
        return true;
      case 'returnToLobby':
        this.reset('menu');
        return true;
      case 'togglePause':
        if (this.phase === 'playing') {
          this.phase = 'paused';
          this.revision += 1;
          return true;
        }
        if (this.phase === 'paused') {
          this.phase = 'playing';
          this.revision += 1;
          return true;
        }
        return false;
      case 'select':
        if (this.phase !== 'playing') return false;
        if (command.cardId && !this.hands.player.includes(command.cardId)) return false;
        this.selected = command.cardId;
        this.guidance = command.cardId ? this.getCardGuidance(command.cardId) : null;
        this.guidanceMs = command.cardId ? 2_500 : 0;
        this.revision += 1;
        return true;
      case 'playCard':
        return this.tryPlayCard(command.team, command.cardId, command.x, command.y);
      case 'activateOverdrive':
        return this.tryActivateOverdrive(command.team);
      case 'upgradeRobot':
        return this.tryUpgradeRobot(command.team, command.robotId, command.stat);
    }
  }

  step(ms = FIXED_STEP_MS): void {
    if (this.phase !== 'playing') return;

    const dtMs = Math.max(0, Math.min(ms, 250));
    const dt = dtMs / 1000;
    const mode = GAME_MODES[this.modeId];
    const previousStage = getMatchStage(mode, this.remainingMs);
    this.remainingMs = Math.max(0, this.remainingMs - dtMs);
    const stage = getMatchStage(mode, this.remainingMs);
    const chargeOverclock = stage === 'core-surge';

    if (stage !== previousStage && stage === 'relay-war') {
      this.guidance = 'RELAY WAR — BREACH A LANE';
      this.guidanceMs = 3_000;
    }
    if (chargeOverclock && previousStage !== 'core-surge' && !this.overclockAnnounced) {
      this.overclockAnnounced = true;
      this.guidance = 'CORE SURGE — CHARGE REGEN ×2';
      this.guidanceMs = 3_200;
    }

    const regenMultiplier = chargeOverclock ? 2 : stage === 'opening' ? 1.25 : 1;
    const regenPerSecond = mode.chargeRegenPerSecond * regenMultiplier;
    this.charge.player = Math.min(MAX_CHARGE, this.charge.player + regenPerSecond * dt);
    this.charge.enemy = Math.min(MAX_CHARGE, this.charge.enemy + regenPerSecond * dt);
    this.playDebounce.player = Math.max(0, this.playDebounce.player - dtMs);
    this.playDebounce.enemy = Math.max(0, this.playDebounce.enemy - dtMs);
    this.commanderCooldown.player = Math.max(0, this.commanderCooldown.player - dtMs);
    this.commanderCooldown.enemy = Math.max(0, this.commanderCooldown.enemy - dtMs);

    if (this.guidanceMs > 0) {
      this.guidanceMs -= dtMs;
      if (this.guidanceMs <= 0) this.guidance = null;
    }

    this.aiDecisionMs -= dtMs;
    if (this.aiDecisionMs <= 0) {
      this.runAi();
      this.aiDecisionMs = 760 + Math.floor(this.random.next() * 320);
    }

    if (this.phase === 'playing') this.updateZones(dtMs);
    if (this.phase === 'playing') this.updateInstallations(dtMs);
    if (this.phase === 'playing') this.updateTowers(dt);
    if (this.phase === 'playing') this.updateUnits(dt, dtMs);
    this.units = this.units.filter((unit) => unit.hp > 0);
    this.installations = this.installations.filter((installation) => installation.hp > 0 && installation.remainingMs > 0);
    this.zones = this.zones.filter((zone) => zone.remainingMs > 0);

    if (this.remainingMs === 0 && this.phase === 'playing') this.finishByTimer();
    this.revision += 1;
  }

  getSnapshot(): MatchSnapshot {
    const mode = GAME_MODES[this.modeId];
    return {
      phase: this.phase,
      modeId: this.modeId,
      decks: cloneDecks(this.decks),
      remainingMs: this.remainingMs,
      chargeOverclock: this.remainingMs <= mode.overclockThresholdMs,
      stage: getMatchStage(mode, this.remainingMs),
      charge: { ...this.charge },
      score: { ...this.score },
      battleScore: { ...this.battleScore },
      towers: this.towers.map((tower) => ({ ...tower })),
      units: this.units.map((unit) => ({ ...unit })),
      installations: this.installations.map((installation) => ({ ...installation })),
      zones: this.zones.map((zone) => ({ ...zone })),
      hands: { player: [...this.hands.player], enemy: [...this.hands.enemy] },
      next: {
        player: this.queues.player[0] ?? this.hands.player[0],
        enemy: this.queues.enemy[0] ?? this.hands.enemy[0],
      },
      selected: this.selected,
      commander: {
        player: this.getCommanderState('player'),
        enemy: this.getCommanderState('enemy'),
      },
      upgrades: {
        player: Object.fromEntries(
          Object.entries(this.upgrades.player).map(([robotId, state]) => [robotId, { ...state }]),
        ) as RobotUpgradeBook['player'],
        enemy: Object.fromEntries(
          Object.entries(this.upgrades.enemy).map(([robotId, state]) => [robotId, { ...state }]),
        ) as RobotUpgradeBook['enemy'],
      },
      result: this.result ? { ...this.result } : null,
      guidance: this.guidance,
      revision: this.revision,
    };
  }

  debugDamageTower(id: string, amount: number): void {
    const tower = this.towers.find((item) => item.id === id);
    if (!tower || tower.hp <= 0 || amount <= 0) return;
    this.damageTower(tower, amount, 'program', getOpponent(tower.team));
    this.revision += 1;
  }

  private lockMatchConfig(config: MatchConfig): void {
    this.modeId = config.modeId;
    this.decks = {
      player: [...config.playerDeck],
      enemy: [...DEFAULT_ENEMY_DECK],
    };
    this.configuredPlayerUpgrades = normalizePlayerUpgrades(config.playerUpgrades, config.playerDeck)
      ?? createEmptyRobotUpgrades();
    this.configuredPlayerTowerWeapons = config.playerTowerWeapons
      ? { ...config.playerTowerWeapons }
      : createDefaultTowerWeapons();
    this.openingDecks = createOpeningDecks(this.decks, this.seed);
  }

  private reset(phase: MatchSnapshot['phase']): void {
    const mode = GAME_MODES[this.modeId];
    this.phase = phase;
    this.remainingMs = mode.durationMs;
    this.charge = { player: mode.startingCharge, enemy: mode.startingCharge };
    this.score = { player: 0, enemy: 0 };
    this.battleScore = { player: 0, enemy: 0 };
    this.towers = createTowers(mode.relayHpMultiplier, this.configuredPlayerTowerWeapons);
    this.units = [];
    this.installations = [];
    this.zones = [];
    this.hands = dealHands(this.openingDecks);
    this.queues = dealQueues(this.openingDecks);
    this.selected = null;
    this.commanderCooldown = { player: 0, enemy: 0 };
    this.upgrades = createUpgradeBook(this.configuredPlayerUpgrades);
    this.result = null;
    this.guidance = phase === 'playing' ? 'OPENING WINDOW — CHARGE REGEN +25%' : null;
    this.guidanceMs = phase === 'playing' ? 4_000 : 0;
    this.overclockAnnounced = false;
    this.unitCounter = 0;
    this.installationCounter = 0;
    this.zoneCounter = 0;
    this.attackCounter = 0;
    this.aiDecisionMs = 1_100;
    this.playDebounce = { player: 0, enemy: 0 };
    this.random = new SeededRandom(this.seed);
    this.revision += 1;
  }

  private getCardGuidance(cardId: CardId): string {
    const card = CARDS[cardId];
    if (card.category === 'program') return 'PROGRAMS TARGET ANYWHERE';
    const breached = hasDeploymentBreach('player', 'left', this.towers) ||
      hasDeploymentBreach('player', 'right', this.towers);
    const territory = breached ? 'YOUR SIDE OR BREACHED LANE' : 'YOUR SIDE';
    if (card.category === 'installation') return `INSTALL ON ${territory}`;
    return card.category === 'commander' ? `DEPLOY YOUR COMMANDER ON ${territory}` : `DEPLOY ON ${territory}`;
  }

  private reject(team: Team, reason: Extract<GameEvent, { type: 'playRejected' }>['reason']): false {
    this.emit({ type: 'playRejected', team, reason });
    return false;
  }

  private tryPlayCard(team: Team, cardId: CardId, x: number, y: number): boolean {
    const card = CARDS[cardId];
    if (!card || !Number.isFinite(x) || !Number.isFinite(y)) return this.reject(team, 'zone');
    if (this.phase !== 'playing' || this.playDebounce[team] > 0) return this.reject(team, 'phase');
    if (card.category === 'commander' && this.getCommanderUnit(team)) return this.reject(team, 'unique');
    if (!this.hands[team].includes(cardId)) return this.reject(team, 'hand');
    const placement = evaluatePlacement(team, cardId, x, y, {
      charge: this.charge[team],
      commanderDeployed: Boolean(this.getCommanderUnit(team)),
      towers: this.towers,
      installations: this.installations,
    });
    if (!placement.valid) {
      if (team === 'player') {
        this.guidance = placement.message;
        this.guidanceMs = 2_200;
      }
      return this.reject(
        team,
        placement.failure === 'charge'
          ? 'charge'
          : placement.failure === 'unique'
            ? 'unique'
            : 'zone',
      );
    }

    this.charge[team] = Math.max(0, this.charge[team] - card.cost);
    this.rotateHand(team, cardId);
    this.playDebounce[team] = 250;

    if (card.category === 'program') {
      this.resolveProgram(team, cardId as 'emp' | 'nano', x, y);
    } else if (card.category === 'installation') {
      this.placeInstallation(team, cardId as 'sentry' | 'foundry', x, y);
    } else {
      this.spawnUnit(team, cardId as RobotKind, x, y);
    }

    if (team === 'player') {
      this.selected = null;
      this.guidance = card.category === 'program'
        ? `${card.shortName} EXECUTED`
        : card.category === 'installation'
          ? `${card.shortName} ONLINE — LIFETIME DECAY ACTIVE`
          : 'BOTS LOCK TO THE NEAREST LANE';
      this.guidanceMs = 2_700;
    }
    this.emit({ type: 'cardPlayed', team, cardId, x, y });
    this.revision += 1;
    return true;
  }

  private rotateHand(team: Team, cardId: CardId): void {
    const index = this.hands[team].indexOf(cardId);
    if (index < 0) return;
    this.hands[team].splice(index, 1);
    const incoming = this.queues[team].shift();
    if (incoming) this.hands[team].push(incoming);
    this.queues[team].push(cardId);
  }

  private spawnUnit(team: Team, kind: RobotKind, x: number, y: number): UnitState {
    const definition = ROBOTS[kind];
    const lane: Lane = x < 800 ? 'left' : 'right';
    const unit: UnitState = {
      id: `${team}-${kind}-${++this.unitCounter}`,
      kind,
      team,
      lane,
      x: Math.max(80, Math.min(1520, x)),
      y,
      hp: definition.maxHp,
      maxHp: definition.maxHp,
      cooldown: 0.25,
      radius: definition.radius,
      facing: team === 'player' ? -Math.PI / 2 : Math.PI / 2,
      disabledMs: 0,
      overdriveMs: 0,
    };
    this.units.push(unit);
    return unit;
  }

  private placeInstallation(team: Team, kind: 'sentry' | 'foundry', x: number, y: number): void {
    const definition = INSTALLATIONS[kind];
    this.installations.push({
      id: `${team}-${kind}-${++this.installationCounter}`,
      kind,
      team,
      lane: x < 800 ? 'left' : 'right',
      x,
      y,
      hp: definition.maxHp,
      maxHp: definition.maxHp,
      radius: definition.radius,
      cooldownMs: definition.activationDelayMs,
      remainingMs: definition.lifetimeMs,
      disabledMs: 0,
    });
    this.emit({ type: 'installationPlaced', team, kind, x, y });
  }

  private resolveProgram(team: Team, kind: 'emp' | 'nano', x: number, y: number): void {
    const definition = PROGRAMS[kind];
    if (kind === 'emp') {
      const opponent = getOpponent(team);
      for (const unit of this.units) {
        if (unit.team !== opponent || unit.hp <= 0 || distance(unit, { x, y }) > definition.radius) continue;
        this.damageUnit(unit, definition.damage, 'program', team);
        unit.disabledMs = Math.max(unit.disabledMs, definition.disableMs ?? 0);
        unit.overdriveMs = 0;
        this.emit({ type: 'impact', x: unit.x, y: unit.y, team, amount: definition.damage });
      }
      for (const installation of this.installations) {
        if (installation.team !== opponent || installation.hp <= 0 || distance(installation, { x, y }) > definition.radius) continue;
        this.damageInstallation(installation, definition.damage, 'program', team);
        installation.disabledMs = Math.max(installation.disabledMs, definition.disableMs ?? 0);
        this.emit({ type: 'impact', x: installation.x, y: installation.y, team, amount: definition.damage });
      }
      const towerDamage = definition.damage * PROGRAM_TOWER_DAMAGE_MULTIPLIER;
      for (const tower of this.towers) {
        if (tower.team !== opponent || tower.hp <= 0 || distance(tower, { x, y }) > definition.radius) continue;
        this.damageTower(tower, towerDamage, 'program', team);
        this.emit({ type: 'impact', x: tower.x, y: tower.y, team, amount: towerDamage });
      }
    } else {
      this.zones.push({
        id: `${team}-nano-${++this.zoneCounter}`,
        kind: 'nano',
        team,
        x,
        y,
        radius: definition.radius,
        remainingMs: definition.durationMs,
        tickAccumulatorMs: 0,
      });
    }
    this.emit({ type: 'programCast', team, kind, x, y, radius: definition.radius });
  }

  private updateZones(dtMs: number): void {
    const definition = PROGRAMS.nano;
    for (const zone of this.zones) {
      zone.remainingMs = Math.max(0, zone.remainingMs - dtMs);
      zone.tickAccumulatorMs += dtMs;
      while (zone.tickAccumulatorMs >= definition.tickIntervalMs) {
        zone.tickAccumulatorMs -= definition.tickIntervalMs;
        this.applyNanoTick(zone, definition.damage);
      }
    }
  }

  private applyNanoTick(zone: ProgramZoneState, damage: number): void {
    const opponent = getOpponent(zone.team);
    for (const unit of this.units) {
      if (unit.team !== opponent || unit.hp <= 0 || distance(unit, zone) > zone.radius) continue;
      this.damageUnit(unit, damage, 'program', zone.team);
      this.emit({ type: 'impact', x: unit.x, y: unit.y, team: zone.team, amount: damage });
    }
    for (const installation of this.installations) {
      if (installation.team !== opponent || installation.hp <= 0 || distance(installation, zone) > zone.radius) continue;
      this.damageInstallation(installation, damage, 'program', zone.team);
      this.emit({ type: 'impact', x: installation.x, y: installation.y, team: zone.team, amount: damage });
    }
    const towerDamage = damage * PROGRAM_TOWER_DAMAGE_MULTIPLIER;
    for (const tower of this.towers) {
      if (tower.team !== opponent || tower.hp <= 0 || distance(tower, zone) > zone.radius) continue;
      this.damageTower(tower, towerDamage, 'program', zone.team);
      this.emit({ type: 'impact', x: tower.x, y: tower.y, team: zone.team, amount: towerDamage });
    }
  }

  private updateInstallations(dtMs: number): void {
    for (const installation of this.installations) {
      if (installation.hp <= 0 || installation.remainingMs <= 0) continue;
      const definition = INSTALLATIONS[installation.kind];
      installation.remainingMs = Math.max(0, installation.remainingMs - dtMs);
      this.damageInstallation(
        installation,
        (installation.maxHp / definition.lifetimeMs) * dtMs,
        'decay',
      );
      if (installation.remainingMs === 0 && installation.hp > 0) {
        this.damageInstallation(installation, installation.hp, 'decay');
      }
      installation.cooldownMs = Math.max(0, installation.cooldownMs - dtMs);
      installation.disabledMs = Math.max(0, installation.disabledMs - dtMs);
      if (installation.hp <= 0 || installation.remainingMs <= 0 || installation.disabledMs > 0 || installation.cooldownMs > 0) continue;

      if (installation.kind === 'foundry') {
        const direction = installation.team === 'player' ? -1 : 1;
        this.spawnUnit(installation.team, 'microbot', installation.x - 22, installation.y + direction * 28);
        this.spawnUnit(installation.team, 'microbot', installation.x + 22, installation.y + direction * 28);
        installation.cooldownMs = definition.spawnIntervalMs ?? 7_000;
        this.emit({ type: 'impact', x: installation.x, y: installation.y, team: installation.team, amount: -1 });
        continue;
      }

      const targets = this.units
        .filter((unit) => unit.team !== installation.team && unit.hp > 0 && unit.lane === installation.lane && distance(unit, installation) <= definition.range)
        .sort((a, b) => distance(a, installation) - distance(b, installation));
      const target = targets[0];
      if (!target) continue;
      const attackId = this.fireProjectile(
        definition.projectile ?? 'bullet',
        this.installationRef(installation),
        this.unitRef(target),
        definition.damage,
      );
      this.damageUnit(target, definition.damage, 'projectile', installation.team, attackId);
      installation.cooldownMs = definition.attackInterval * 1000;
      const secondary = targets.find((candidate) => candidate.id !== target.id && distance(candidate, target) <= 75);
      if (secondary) {
        const secondaryAttackId = this.fireProjectile(
          definition.projectile ?? 'bullet',
          this.unitRef(target),
          this.unitRef(secondary),
          definition.damage * 0.5,
        );
        this.damageUnit(secondary, definition.damage * 0.5, 'projectile', installation.team, secondaryAttackId);
      }
    }
  }

  private updateTowers(dt: number): void {
    for (const tower of this.towers) {
      if (tower.hp <= 0) continue;
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.cooldown > 0) continue;
      if (tower.kind === 'core' && !this.isCoreDefenseAwake(tower.team)) continue;
      const target = this.units
        .filter((unit) =>
          unit.team !== tower.team &&
          unit.hp > 0 &&
          this.hasCrossedBridgeForDefense(tower.team, unit.y) &&
          distance(unit, tower) <= tower.range,
        )
        .sort((a, b) => distance(a, tower) - distance(b, tower))[0];
      if (!target) continue;
      const attackId = this.fireProjectile(
        tower.projectile,
        this.towerRef(tower),
        this.unitRef(target),
        tower.damage,
        tower.splashRadius || undefined,
      );
      this.damageUnit(target, tower.damage, 'projectile', tower.team, attackId);
      if (tower.splashRadius > 0) {
        for (const secondary of this.units) {
          if (
            secondary.id === target.id ||
            secondary.team === tower.team ||
            secondary.hp <= 0 ||
            !this.hasCrossedBridgeForDefense(tower.team, secondary.y) ||
            distance(secondary, target) > tower.splashRadius
          ) continue;
          this.damageUnit(
            secondary,
            tower.damage * tower.splashMultiplier,
            'projectile',
            tower.team,
            attackId,
          );
        }
      }
      tower.cooldown = tower.attackInterval;
    }
  }

  private isCoreDefenseAwake(team: Team): boolean {
    return this.towers.some(
      (tower) => tower.team === team && tower.kind === 'relay' && tower.hp <= 0,
    );
  }

  private hasCrossedBridgeForDefense(defendingTeam: Team, unitY: number): boolean {
    return defendingTeam === 'enemy'
      ? unitY <= ENEMY_BRIDGE_EDGE_Y
      : unitY >= PLAYER_BRIDGE_EDGE_Y;
  }

  private updateUnits(dt: number, dtMs: number): void {
    const ordered = [...this.units].sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of ordered) {
      if (unit.hp <= 0 || this.phase !== 'playing') continue;
      const definition = ROBOTS[unit.kind];
      const stats = this.getUnitStats(unit);
      const boosted = this.isOverdriveBoosted(unit);
      unit.cooldown = Math.max(0, unit.cooldown - dt * (boosted ? 1.4 : 1));
      unit.disabledMs = Math.max(0, unit.disabledMs - dtMs);
      unit.overdriveMs = Math.max(0, unit.overdriveMs - dtMs);
      if (unit.disabledMs > 0) {
        unit.overdriveMs = 0;
        continue;
      }

      if (stats.heal > 0 && unit.cooldown === 0) {
        const ally = this.units
          .filter((candidate) => candidate.id !== unit.id && candidate.team === unit.team && candidate.hp > 0 && candidate.hp < candidate.maxHp && distance(candidate, unit) <= stats.range)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ally) {
          ally.hp = Math.min(ally.maxHp, ally.hp + stats.heal);
          unit.cooldown = definition.attackInterval;
          this.emit({ type: 'impact', x: ally.x, y: ally.y, team: unit.team, amount: -stats.heal });
          continue;
        }
        const installation = this.installations
          .filter((candidate) => candidate.team === unit.team && candidate.hp > 0 && candidate.hp < candidate.maxHp && distance(candidate, unit) <= stats.range)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (installation) {
          installation.hp = Math.min(installation.maxHp, installation.hp + stats.heal * 0.5);
          unit.cooldown = definition.attackInterval;
          this.emit({ type: 'impact', x: installation.x, y: installation.y, team: unit.team, amount: -stats.heal * 0.5 });
          continue;
        }
      }

      const enemyUnit = this.findEnemyUnit(unit);
      if (enemyUnit) {
        const attackDistance = stats.range + enemyUnit.radius * 0.35;
        if (distance(unit, enemyUnit) <= attackDistance) {
          if (unit.cooldown === 0) this.attackUnit(unit, enemyUnit);
        } else {
          this.moveToward(unit, enemyUnit, stats.speed * (boosted ? 1.25 : 1), dt);
        }
        continue;
      }

      const structure = this.getStructureTarget(unit);
      if (!structure) continue;
      const structurePadding = isInstallation(structure) ? structure.radius : TOWER_COMBAT_RADIUS[structure.kind];
      const attackDistance = stats.range + structurePadding;
      if (distance(unit, structure) <= attackDistance) {
        if (unit.cooldown === 0) this.attackStructure(unit, structure);
      } else {
        const destination = isInstallation(structure) ? structure : this.getRouteDestination(unit, structure);
        this.moveToward(unit, destination, stats.speed * (boosted ? 1.25 : 1), dt);
      }
    }
  }

  private isOverdriveBoosted(unit: UnitState): boolean {
    const commander = this.getCommanderUnit(unit.team);
    return Boolean(commander && commander.overdriveMs > 0 && distance(unit, commander) <= OVERDRIVE_AURA_RADIUS);
  }

  private findEnemyUnit(unit: UnitState): UnitState | undefined {
    const definition = ROBOTS[unit.kind];
    if (definition.structureOnly) return undefined;
    const leash = definition.structurePreferred ? 84 : 190;
    return this.units
      .filter((candidate) => {
        if (candidate.team === unit.team || candidate.hp <= 0 || candidate.lane !== unit.lane) return false;
        if (ROBOTS[candidate.kind].flying && definition.targeting === 'ground') return false;
        return distance(candidate, unit) <= leash;
      })
      .sort((a, b) => distance(a, unit) - distance(b, unit))[0];
  }

  private getStructureTarget(unit: UnitState): StructureState | undefined {
    const definition = ROBOTS[unit.kind];
    const opponent = getOpponent(unit.team);
    const installationLeash = definition.structureOnly ? 330 : definition.structurePreferred ? 140 : 150;
    const nearbyInstallation = this.installations
      .filter((installation) => installation.team === opponent && installation.hp > 0 && installation.lane === unit.lane && distance(installation, unit) <= installationLeash)
      .sort((a, b) => distance(a, unit) - distance(b, unit))[0];
    if (nearbyInstallation) return nearbyInstallation;
    const relay = this.towers.find(
      (tower) => tower.team === opponent && tower.kind === 'relay' && tower.lane === unit.lane && tower.hp > 0,
    );
    if (relay) return relay;
    return this.towers.find((tower) => tower.team === opponent && tower.kind === 'core' && tower.hp > 0);
  }

  private getRouteDestination(unit: UnitState, structure: TowerState): { x: number; y: number } {
    if (unit.team === 'player') {
      if (unit.y > PLAYER_BRIDGE_EDGE_Y) return { x: getLaneX(unit.lane, 335), y: 335 };
      if (unit.y > ENEMY_BRIDGE_EDGE_Y) return { x: getLaneX(unit.lane, 270), y: 270 };
    } else {
      if (unit.y < ENEMY_BRIDGE_EDGE_Y) return { x: getLaneX(unit.lane, 278), y: 278 };
      if (unit.y < PLAYER_BRIDGE_EDGE_Y) return { x: getLaneX(unit.lane, 345), y: 345 };
    }
    return structure;
  }

  private moveToward(unit: UnitState, destination: { x: number; y: number }, speed: number, dt: number): void {
    const dx = destination.x - unit.x;
    const dy = destination.y - unit.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return;
    const move = Math.min(length, speed * 0.72 * dt);
    unit.x += (dx / length) * move;
    unit.y += (dy / length) * move;
    unit.facing = Math.atan2(dy, dx);
  }

  private unitRef(unit: UnitState): CombatEntityRef {
    return { id: unit.id, entityType: 'unit', team: unit.team, x: unit.x, y: unit.y, radius: unit.radius };
  }

  private installationRef(installation: InstallationState): CombatEntityRef {
    return {
      id: installation.id,
      entityType: 'installation',
      team: installation.team,
      x: installation.x,
      y: installation.y,
      radius: installation.radius,
    };
  }

  private towerRef(tower: TowerState): CombatEntityRef {
    return {
      id: tower.id,
      entityType: 'tower',
      team: tower.team,
      x: tower.x,
      y: tower.y,
      radius: TOWER_COMBAT_RADIUS[tower.kind],
    };
  }

  private structureRef(structure: StructureState): CombatEntityRef {
    return isInstallation(structure) ? this.installationRef(structure) : this.towerRef(structure);
  }

  private fireProjectile(
    projectile: ProjectileKind,
    source: CombatEntityRef,
    target: CombatEntityRef,
    amount: number,
    splashRadius?: number,
  ): number {
    const attackId = ++this.attackCounter;
    this.emit({ type: 'projectileFired', attackId, projectile, source, target, amount, splashRadius });
    return attackId;
  }

  private damageUnit(
    target: UnitState,
    amount: number,
    cause: 'projectile' | 'program' | 'decay',
    byTeam?: Team,
    attackId?: number,
  ): void {
    if (target.hp <= 0 || amount <= 0) return;
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp === 0) {
      if (byTeam && byTeam !== target.team) this.battleScore[byTeam] += SCORE_AWARDS.unit;
      this.emit({ type: 'entityDestroyed', entity: this.unitRef(target), cause, byTeam, attackId });
    }
  }

  private damageInstallation(
    target: InstallationState,
    amount: number,
    cause: 'projectile' | 'program' | 'decay',
    byTeam?: Team,
    attackId?: number,
  ): void {
    if (target.hp <= 0 || amount <= 0) return;
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp === 0) {
      if (byTeam && byTeam !== target.team) this.battleScore[byTeam] += SCORE_AWARDS.installation;
      this.emit({ type: 'entityDestroyed', entity: this.installationRef(target), cause, byTeam, attackId });
    }
  }

  private damageTower(
    target: TowerState,
    amount: number,
    cause: 'projectile' | 'program' | 'decay',
    byTeam?: Team,
    attackId?: number,
  ): void {
    if (target.hp <= 0 || amount <= 0) return;
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp === 0) {
      if (byTeam && byTeam !== target.team) {
        this.battleScore[byTeam] += target.kind === 'core' ? SCORE_AWARDS.core : SCORE_AWARDS.relay;
      }
      this.emit({ type: 'entityDestroyed', entity: this.towerRef(target), cause, byTeam, attackId });
      this.onTowerDestroyed(target);
    }
  }

  private damageStructure(
    target: StructureState,
    amount: number,
    cause: 'projectile' | 'program' | 'decay',
    byTeam?: Team,
    attackId?: number,
  ): void {
    if (isInstallation(target)) this.damageInstallation(target, amount, cause, byTeam, attackId);
    else this.damageTower(target, amount, cause, byTeam, attackId);
  }

  private attackUnit(attacker: UnitState, target: UnitState): void {
    const definition = ROBOTS[attacker.kind];
    const stats = this.getUnitStats(attacker);
    const attackId = this.fireProjectile(
      definition.projectile,
      this.unitRef(attacker),
      this.unitRef(target),
      stats.damage,
      definition.splashRadius,
    );
    this.damageUnit(target, stats.damage, 'projectile', attacker.team, attackId);
    attacker.cooldown = definition.attackInterval;
    if (!definition.splashRadius) return;
    for (const candidate of this.units) {
      if (candidate.id === target.id || candidate.team === attacker.team || candidate.hp <= 0) continue;
      if (distance(candidate, target) <= definition.splashRadius) {
        this.damageUnit(candidate, stats.damage * 0.58, 'projectile', attacker.team, attackId);
      }
    }
  }

  private attackStructure(attacker: UnitState, structure: StructureState): void {
    if (structure.hp <= 0) return;
    const definition = ROBOTS[attacker.kind];
    const stats = this.getUnitStats(attacker);
    const attackId = this.fireProjectile(
      definition.projectile,
      this.unitRef(attacker),
      this.structureRef(structure),
      stats.damage,
    );
    this.damageStructure(structure, stats.damage, 'projectile', attacker.team, attackId);
    attacker.cooldown = definition.attackInterval;
  }

  private getUnitStats(unit: UnitState) {
    const upgrades = unit.kind === 'microbot' ? undefined : this.upgrades[unit.team][unit.kind];
    return getEffectiveRobotStats(unit.kind, upgrades);
  }

  private tryUpgradeRobot(team: Team, robotId: RobotCardId, stat: UpgradeStat): boolean {
    if (this.phase !== 'playing') {
      this.emit({ type: 'upgradeRejected', team, robotId, stat, reason: 'phase' });
      return false;
    }
    const currentTier = this.upgrades[team][robotId][stat];
    const cost = getUpgradeCost(currentTier);
    if (cost === null) {
      this.emit({ type: 'upgradeRejected', team, robotId, stat, reason: 'maxTier' });
      return false;
    }
    if (this.charge[team] + 0.001 < cost) {
      this.emit({ type: 'upgradeRejected', team, robotId, stat, reason: 'charge' });
      return false;
    }
    const tier = (currentTier + 1) as 1 | 2;
    this.charge[team] = Math.max(0, this.charge[team] - cost);
    this.upgrades[team][robotId][stat] = tier;
    if (team === 'player') {
      this.guidance = `${ROBOTS[robotId].shortName} ${stat.toUpperCase()} UPGRADED — MK ${tier + 1}`;
      this.guidanceMs = 2_400;
    }
    this.emit({ type: 'robotUpgraded', team, robotId, stat, tier, cost });
    this.revision += 1;
    return true;
  }

  private tryActivateOverdrive(team: Team): boolean {
    if (this.phase !== 'playing') return this.reject(team, 'phase');
    const commander = this.getCommanderUnit(team);
    if (!commander) return this.reject(team, 'unique');
    if (commander.disabledMs > 0) return this.reject(team, 'disabled');
    if (this.commanderCooldown[team] > 0 || commander.overdriveMs > 0) return this.reject(team, 'cooldown');
    if (this.charge[team] + 0.001 < OVERDRIVE_COST) return this.reject(team, 'charge');
    this.charge[team] = Math.max(0, this.charge[team] - OVERDRIVE_COST);
    commander.overdriveMs = OVERDRIVE_DURATION_MS;
    this.commanderCooldown[team] = OVERDRIVE_COOLDOWN_MS;
    this.guidance = team === 'player' ? 'VECTOR-9 OVERDRIVE ENGAGED' : 'ENEMY OVERDRIVE DETECTED';
    this.guidanceMs = 2_400;
    this.emit({ type: 'overdriveActivated', team, x: commander.x, y: commander.y });
    this.revision += 1;
    return true;
  }

  private getCommanderUnit(team: Team): UnitState | undefined {
    return this.units.find((unit) => unit.team === team && unit.kind === 'vector' && unit.hp > 0);
  }

  private getCommanderState(team: Team): CommanderAbilityState {
    const commander = this.getCommanderUnit(team);
    const disabled = Boolean(commander && commander.disabledMs > 0);
    const active = Boolean(commander && commander.overdriveMs > 0);
    return {
      deployed: Boolean(commander),
      available: this.phase === 'playing' && Boolean(commander) && !disabled && !active && this.commanderCooldown[team] <= 0 && this.charge[team] + 0.001 >= OVERDRIVE_COST,
      active,
      cost: OVERDRIVE_COST,
      cooldownMs: this.commanderCooldown[team],
      remainingMs: commander?.overdriveMs ?? 0,
      disabled,
    };
  }

  private onTowerDestroyed(tower: TowerState): void {
    this.emit({ type: 'towerDestroyed', tower: { ...tower } });
    const victor = getOpponent(tower.team);
    if (tower.kind === 'relay') {
      this.score[victor] += 1;
      const relayScoreLimit = GAME_MODES[this.modeId].relayScoreLimit;
      if (relayScoreLimit !== undefined && this.score[victor] >= relayScoreLimit) {
        this.endMatch({
          winner: victor,
          reason: 'relay',
          headline: victor === 'player' ? 'RELAYS OVERRUN' : 'RELAY GRID LOST',
          detail: `${relayScoreLimit} Relay breaches secured the match.`,
        });
        return;
      }
      const lane = tower.lane.toUpperCase();
      this.guidance = tower.team === 'enemy'
        ? `${lane} RELAY BREACHED — DEPLOYMENT EXTENDED`
        : `${lane} RELAY OFFLINE — ENEMY DEPLOYMENT EXTENDED`;
      this.guidanceMs = 2_800;
      return;
    }
    this.endMatch({
      winner: victor,
      reason: 'core',
      headline: victor === 'player' ? 'CORE CRASHED' : 'SYSTEM OVERRUN',
      detail: victor === 'player' ? 'Enemy command network is offline.' : 'Your Core Node was destroyed.',
    });
  }

  private finishByTimer(): void {
    const scoreDelta = this.score.player - this.score.enemy;
    if (scoreDelta !== 0) {
      const winner: Team = scoreDelta > 0 ? 'player' : 'enemy';
      this.endMatch({
        winner,
        reason: 'timer',
        headline: winner === 'player' ? 'NETWORK SECURED' : 'SIGNAL LOST',
        detail: `Final Data Point score ${this.score.player}–${this.score.enemy}.`,
      });
      return;
    }
    const integrity = (team: Team) => this.towers.filter((tower) => tower.team === team).reduce((sum, tower) => sum + tower.hp / tower.maxHp, 0);
    const playerIntegrity = integrity('player');
    const enemyIntegrity = integrity('enemy');
    if (Math.abs(playerIntegrity - enemyIntegrity) <= 0.005) {
      this.endMatch({ winner: 'draw', reason: 'integrity', headline: 'SIGNAL DEADLOCK', detail: 'Both networks survived with equal integrity.' });
      return;
    }
    const winner: Team = playerIntegrity > enemyIntegrity ? 'player' : 'enemy';
    this.endMatch({
      winner,
      reason: 'integrity',
      headline: winner === 'player' ? 'NETWORK SECURED' : 'SIGNAL LOST',
      detail: 'Tower integrity broke the Data Point tie.',
    });
  }

  private endMatch(result: MatchResult): void {
    if (this.phase === 'ended') return;
    if (result.winner !== 'draw') this.battleScore[result.winner] += SCORE_AWARDS.victory;
    this.phase = 'ended';
    this.result = result;
    this.selected = null;
    this.guidance = null;
    this.emit({ type: 'matchEnded', result });
    this.revision += 1;
  }

  private runAi(): void {
    if (this.phase !== 'playing' || this.playDebounce.enemy > 0) return;
    const affordable = this.hands.enemy.filter((cardId) => {
      if (CARDS[cardId].cost > this.charge.enemy + 0.001) return false;
      return cardId !== 'vector' || !this.getCommanderUnit('enemy');
    });
    if (affordable.length === 0) return;

    const threat = { left: 0, right: 0 };
    for (const unit of this.units) {
      if (unit.team === 'player' && unit.y < 365) threat[unit.lane] += unit.hp + this.getUnitStats(unit).damage * 4;
    }
    const underPressure = threat.left > 0 || threat.right > 0;
    if (!underPressure && this.charge.enemy < 6.5 && this.random.next() < 0.72) return;
    let lane: Lane = threat.left >= threat.right ? 'left' : 'right';
    if (!underPressure) {
      const left = this.towers.find((tower) => tower.id === 'player-left');
      const right = this.towers.find((tower) => tower.id === 'player-right');
      lane = (left?.hp ?? 0) <= (right?.hp ?? 0) ? 'left' : 'right';
      if (this.random.next() < 0.2) lane = lane === 'left' ? 'right' : 'left';
    }

    const preferences: CardId[] = underPressure
      ? ['sentry', 'emp', 'nano', 'pulse', 'zip', 'brute', 'vector', 'foundry']
      : ['foundry', 'vector', 'brute', 'zip', 'pulse', 'nano', 'emp', 'sentry'];
    const cardId = preferences.find((candidate) => affordable.includes(candidate)) ?? affordable[0];
    const card = CARDS[cardId];
    if (card.category === 'program') {
      const targetUnit = this.units
        .filter((unit) => unit.team === 'player' && unit.hp > 0)
        .sort((a, b) => a.y - b.y)[0];
      const targetTower = this.towers.find((tower) => tower.team === 'player' && tower.kind === 'relay' && tower.lane === lane && tower.hp > 0);
      const target = targetUnit ?? targetTower ?? { x: 800, y: 500 };
      this.tryPlayCard('enemy', cardId, target.x, target.y);
      return;
    }
    const breachedLane = hasDeploymentBreach('enemy', lane, this.towers);
    const y = breachedLane
      ? card.category === 'installation' ? 430 : 445
      : card.category === 'installation' ? 208 : 215;
    const inwardOffset = lane === 'left' ? 45 : -45;
    const x = getLaneX(lane, y) + inwardOffset + (this.random.next() - 0.5) * 46;
    this.tryPlayCard('enemy', cardId, x, y);

    const commander = this.getCommanderState('enemy');
    if (commander.available && this.random.next() < 0.22) this.tryActivateOverdrive('enemy');
  }
}
