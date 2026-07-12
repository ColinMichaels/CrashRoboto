import { describe, expect, it, vi } from 'vitest';
import {
  CARDS,
  DEFAULT_ENEMY_DECK,
  DEFAULT_PLAYER_DECK,
  DECK_SIZE,
  ENEMY_BRIDGE_EDGE_Y,
  FIXED_STEP_MS,
  GAME_MODES,
  HAND_SIZE,
  INSTALLATIONS,
  LOBBY_FIRMWARE_BUDGET,
  OVERDRIVE_COOLDOWN_MS,
  OVERDRIVE_COST,
  OVERDRIVE_DURATION_MS,
  PLAYER_BRIDGE_EDGE_Y,
  PROGRAMS,
  PROGRAM_TOWER_DAMAGE_MULTIPLIER,
  ROBOTS,
  TOWER_WEAPONS,
  TOWER_PAD_POSITIONS,
  UPGRADE_COSTS,
  UPGRADE_MULTIPLIERS,
  createDefaultMatchConfig,
  createDefaultTowerWeapons,
  createEmptyRobotUpgrades,
  createTowers,
  getEffectiveRobotStats,
  getLaneX,
  getPerspectiveScale,
  isValidDeck,
  validateMatchConfig,
} from './content';
import { MatchEngine } from './MatchEngine';
import type {
  CardId,
  GameCommand,
  GameEvent,
  MatchConfig,
  ProgramZoneState,
  RobotKind,
  Team,
  UnitState,
} from './types';

const advance = (engine: MatchEngine, ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += FIXED_STEP_MS) engine.step(FIXED_STEP_MS);
};

type MatchEngineHarness = {
  spawnUnit: (team: Team, kind: RobotKind, x: number, y: number) => UnitState;
  units: UnitState[];
  zones: ProgramZoneState[];
};

const harness = (engine: MatchEngine) => engine as unknown as MatchEngineHarness;

const PROGRAM_TEST_DECK: CardId[] = ['zip', 'foundry', 'sentry', 'vector', 'nano', 'pulse', 'brute', 'emp'];
const SENTRY_TEST_DECK: CardId[] = ['zip', 'brute', 'emp', 'vector', 'nano', 'pulse', 'foundry', 'sentry'];

const startWithDeck = (
  engine: MatchEngine,
  playerDeck: CardId[],
  modeId: MatchConfig['modeId'] = 'core-siege',
) => engine.dispatch({ type: 'start', config: { modeId, playerDeck } });

describe('MatchEngine', () => {
  it('uses converging lanes and smaller far-field scale for perspective', () => {
    expect(getLaneX('right', 650) - 800).toBeGreaterThan(getLaneX('right', 100) - 800);
    expect(getPerspectiveScale(100)).toBeLessThan(getPerspectiveScale(600));
  });

  it('anchors every structure to its painted board mounting pad', () => {
    const towers = createTowers();
    const enemyCore = towers.find((tower) => tower.id === 'enemy-core')!;
    const enemyRelays = towers.filter((tower) => tower.team === 'enemy' && tower.kind === 'relay');
    const playerCore = towers.find((tower) => tower.id === 'player-core')!;
    const playerRelays = towers.filter((tower) => tower.team === 'player' && tower.kind === 'relay');
    for (const tower of towers) {
      expect(tower).toMatchObject(TOWER_PAD_POSITIONS[tower.id as keyof typeof TOWER_PAD_POSITIONS]);
    }
    expect(enemyRelays.every((tower) => enemyCore.y < tower.y)).toBe(true);
    expect(playerRelays.every((tower) => playerCore.y > tower.y)).toBe(true);
  });

  it('starts with the required three structures per side', () => {
    const engine = new MatchEngine();
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('menu');
    expect(snapshot.towers.filter((tower) => tower.team === 'player')).toHaveLength(3);
    expect(snapshot.towers.filter((tower) => tower.team === 'enemy')).toHaveLength(3);
    expect(snapshot.towers.filter((tower) => tower.kind === 'core')).toHaveLength(2);
  });

  it('configures each player Relay with a distinct weapon tradeoff and splash behavior', () => {
    const towers = createTowers(1, { left: 'rocket', right: 'flame' });
    expect(towers.find((tower) => tower.id === 'player-left')).toMatchObject({
      weapon: 'rocket',
      damage: TOWER_WEAPONS.rocket.damage,
      attackInterval: TOWER_WEAPONS.rocket.attackInterval,
      projectile: 'rocket',
      splashRadius: TOWER_WEAPONS.rocket.splashRadius,
    });
    expect(towers.find((tower) => tower.id === 'player-right')).toMatchObject({
      weapon: 'flame',
      damage: TOWER_WEAPONS.flame.damage,
      attackInterval: TOWER_WEAPONS.flame.attackInterval,
      projectile: 'flame',
    });
    expect(towers.find((tower) => tower.id === 'enemy-left')?.weapon).toBe('gun');
    expect(towers.find((tower) => tower.id === 'player-core')).toMatchObject({
      weapon: 'rocket',
      damage: 118,
      attackInterval: 0.85,
    });

    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    expect(engine.dispatch({
      type: 'start',
      config: {
        ...createDefaultMatchConfig(),
        playerTowerWeapons: { left: 'rocket', right: 'flame' },
      },
    })).toBe(true);
    const primary = harness(engine).spawnUnit('enemy', 'brute', 520, 380);
    const secondary = harness(engine).spawnUnit('enemy', 'brute', 475, 380);

    engine.step(FIXED_STEP_MS);

    expect(events).toContainEqual(expect.objectContaining({
      type: 'projectileFired',
      projectile: 'rocket',
      source: expect.objectContaining({ id: 'player-left' }),
      amount: TOWER_WEAPONS.rocket.damage,
      splashRadius: TOWER_WEAPONS.rocket.splashRadius,
    }));
    expect(engine.getSnapshot().units.find((unit) => unit.id === primary.id)?.hp)
      .toBe(ROBOTS.brute.maxHp - TOWER_WEAPONS.rocket.damage);
    expect(engine.getSnapshot().units.find((unit) => unit.id === secondary.id)?.hp)
      .toBeCloseTo(
        ROBOTS.brute.maxHp - TOWER_WEAPONS.rocket.damage * TOWER_WEAPONS.rocket.splashMultiplier,
        5,
      );
  });

  it('keeps a Core dormant until one of its own Relays is destroyed', () => {
    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    engine.dispatch({ type: 'start' });
    harness(engine).spawnUnit('enemy', 'brute', 800, 500);
    const coreShots = () => events.filter(
      (event) => event.type === 'projectileFired' && event.source.id === 'player-core',
    );

    engine.step(FIXED_STEP_MS);
    expect(coreShots()).toHaveLength(0);

    engine.debugDamageTower('enemy-left', 2_000);
    engine.step(FIXED_STEP_MS);
    expect(coreShots()).toHaveLength(0);

    engine.debugDamageTower('player-left', 2_000);
    engine.step(FIXED_STEP_MS);
    expect(coreShots()).toHaveLength(1);
  });

  it('waits for a robot to complete the bridge crossing before defensive towers fire', () => {
    const enemyEvents: GameEvent[] = [];
    const enemyDefense = new MatchEngine((event) => enemyEvents.push(event));
    enemyDefense.dispatch({ type: 'start' });
    const playerRobot = harness(enemyDefense).spawnUnit(
      'player',
      'brute',
      getLaneX('left', ENEMY_BRIDGE_EDGE_Y + 1),
      ENEMY_BRIDGE_EDGE_Y + 1,
    );

    enemyDefense.step(FIXED_STEP_MS);
    expect(enemyEvents.some(
      (event) => event.type === 'projectileFired' && event.source.id === 'enemy-left',
    )).toBe(false);
    expect(playerRobot.y).toBeLessThanOrEqual(ENEMY_BRIDGE_EDGE_Y);

    enemyDefense.step(FIXED_STEP_MS);
    expect(enemyEvents.some(
      (event) => event.type === 'projectileFired' && event.source.id === 'enemy-left',
    )).toBe(true);

    const playerEvents: GameEvent[] = [];
    const playerDefense = new MatchEngine((event) => playerEvents.push(event));
    playerDefense.dispatch({ type: 'start' });
    const enemyRobot = harness(playerDefense).spawnUnit(
      'enemy',
      'brute',
      getLaneX('left', PLAYER_BRIDGE_EDGE_Y - 1),
      PLAYER_BRIDGE_EDGE_Y - 1,
    );

    playerDefense.step(FIXED_STEP_MS);
    expect(playerEvents.some(
      (event) => event.type === 'projectileFired' && event.source.id === 'player-left',
    )).toBe(false);
    expect(enemyRobot.y).toBeGreaterThanOrEqual(PLAYER_BRIDGE_EDGE_Y);

    playerDefense.step(FIXED_STEP_MS);
    expect(playerEvents.some(
      (event) => event.type === 'projectileFired' && event.source.id === 'player-left',
    )).toBe(true);
  });

  it('does not apply tower splash damage across the bridge boundary', () => {
    const engine = new MatchEngine();
    engine.dispatch({
      type: 'start',
      config: {
        ...createDefaultMatchConfig(),
        playerTowerWeapons: { left: 'rocket', right: 'flame' },
      },
    });
    const crossed = harness(engine).spawnUnit('enemy', 'brute', 600, PLAYER_BRIDGE_EDGE_Y);
    const protectedAcrossBridge = harness(engine).spawnUnit('enemy', 'brute', 600, PLAYER_BRIDGE_EDGE_Y - 1);

    engine.step(FIXED_STEP_MS);

    expect(crossed.hp).toBe(ROBOTS.brute.maxHp - TOWER_WEAPONS.rocket.damage);
    expect(protectedAcrossBridge.hp).toBe(ROBOTS.brute.maxHp);
  });

  it('validates exact eight-card unique decks and complete match configs at runtime', () => {
    expect(DECK_SIZE).toBe(8);
    expect(HAND_SIZE).toBe(4);
    expect(isValidDeck(DEFAULT_PLAYER_DECK)).toBe(true);
    expect(isValidDeck(DEFAULT_PLAYER_DECK.slice(0, 7))).toBe(false);
    expect(isValidDeck([...DEFAULT_PLAYER_DECK.slice(0, 7), DEFAULT_PLAYER_DECK[0]])).toBe(false);
    expect(isValidDeck([...DEFAULT_PLAYER_DECK.slice(0, 7), 'unknown-chip'])).toBe(false);

    const candidate = { modeId: 'turbo-grid', playerDeck: [...PROGRAM_TEST_DECK] };
    const validated = validateMatchConfig(candidate);
    expect(validated).toEqual({
      ...candidate,
      playerUpgrades: createEmptyRobotUpgrades(),
      playerTowerWeapons: createDefaultTowerWeapons(),
    });
    expect(validated?.playerDeck).not.toBe(candidate.playerDeck);
    expect(validateMatchConfig({ modeId: 'ghost-mode', playerDeck: DEFAULT_PLAYER_DECK })).toBeNull();
    expect(validateMatchConfig({
      ...candidate,
      playerTowerWeapons: { left: 'laser', right: 'gun' },
    })).toBeNull();
    expect(createDefaultMatchConfig()).toEqual({
      modeId: 'core-siege',
      playerDeck: DEFAULT_PLAYER_DECK,
      playerUpgrades: createEmptyRobotUpgrades(),
      playerTowerWeapons: createDefaultTowerWeapons(),
    });
  });

  it('normalizes and clones lobby firmware while rejecting invalid loadouts', () => {
    const playerUpgrades = {
      zip: { output: 2, range: 1 },
      pulse: { speed: 2 },
      vector: { range: 1 },
    };
    const valid = {
      modeId: 'core-siege',
      playerDeck: [...DEFAULT_PLAYER_DECK],
      playerUpgrades,
    };
    const validated = validateMatchConfig(valid);

    expect(LOBBY_FIRMWARE_BUDGET).toBe(6);
    expect(validated?.playerUpgrades).toEqual({
      ...createEmptyRobotUpgrades(),
      zip: { output: 2, range: 1, speed: 0 },
      pulse: { output: 0, range: 0, speed: 2 },
      vector: { output: 0, range: 1, speed: 0 },
    });
    playerUpgrades.zip.output = 0;
    expect(validated?.playerUpgrades?.zip?.output).toBe(2);

    expect(validateMatchConfig({
      ...valid,
      playerUpgrades: { zip: { output: 2, range: 2, speed: 2 }, pulse: { output: 1 } },
    })).toBeNull();
    expect(validateMatchConfig({
      ...valid,
      playerFirmwareBudget: 7,
      playerUpgrades: { zip: { output: 2, range: 2, speed: 2 }, pulse: { output: 1 } },
    })?.playerFirmwareBudget).toBe(7);
    expect(validateMatchConfig({
      ...valid,
      playerUpgrades: { rail: { output: 1 } },
    })).toBeNull();
    expect(validateMatchConfig({
      ...valid,
      playerUpgrades: { zip: { output: 3 } },
    })).toBeNull();
  });

  it('starts with free lobby firmware and restores it on restart after paid upgrades', () => {
    const config: MatchConfig = {
      modeId: 'core-siege',
      playerDeck: [...DEFAULT_PLAYER_DECK],
      playerUpgrades: {
        zip: { output: 1, range: 1 },
        pulse: { speed: 2 },
      },
    };
    const engine = new MatchEngine();

    expect(engine.dispatch({ type: 'start', config })).toBe(true);
    config.playerUpgrades!.zip!.output = 2;
    let snapshot = engine.getSnapshot();
    expect(snapshot.charge).toEqual({ player: 5, enemy: 5 });
    expect(snapshot.upgrades.player.zip).toEqual({ output: 1, range: 1, speed: 0 });
    expect(snapshot.upgrades.player.pulse).toEqual({ output: 0, range: 0, speed: 2 });
    expect(snapshot.upgrades.enemy.zip).toEqual({ output: 0, range: 0, speed: 0 });

    expect(engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'output' })).toBe(true);
    snapshot = engine.getSnapshot();
    expect(snapshot.charge.player).toBe(2);
    expect(snapshot.upgrades.player.zip.output).toBe(2);

    expect(engine.dispatch({ type: 'restart' })).toBe(true);
    snapshot = engine.getSnapshot();
    expect(snapshot.charge.player).toBe(5);
    expect(snapshot.upgrades.player.zip).toEqual({ output: 1, range: 1, speed: 0 });
    expect(snapshot.upgrades.player.pulse.speed).toBe(2);
    expect(snapshot.upgrades.enemy.zip).toEqual({ output: 0, range: 0, speed: 0 });
  });

  it('rejects an invalid start config without leaving the lobby or mutating the active snapshot', () => {
    const engine = new MatchEngine();
    const before = engine.getSnapshot();
    const invalidStart = {
      type: 'start',
      config: { modeId: 'core-siege', playerDeck: ['zip', 'zip'] },
    } as unknown as GameCommand;

    expect(engine.dispatch(invalidStart)).toBe(false);
    expect(engine.getSnapshot()).toEqual(before);
    expect(engine.getSnapshot().phase).toBe('menu');
  });

  it('locks a custom player deck, keeps the enemy default, and shuffles openings deterministically by seed', () => {
    const customDeck: CardId[] = ['swarm', 'rail', 'arc', 'drone', 'patch', 'zip', 'emp', 'sentry'];
    const first = new MatchEngine(undefined, 2026);
    const replay = new MatchEngine(undefined, 2026);
    const differentSeed = new MatchEngine(undefined, 2027);

    for (const engine of [first, replay, differentSeed]) {
      expect(startWithDeck(engine, customDeck)).toBe(true);
    }

    const firstSnapshot = first.getSnapshot();
    const replaySnapshot = replay.getSnapshot();
    const differentSnapshot = differentSeed.getSnapshot();
    expect(firstSnapshot.decks).toEqual({ player: customDeck, enemy: DEFAULT_ENEMY_DECK });
    expect(firstSnapshot.hands.player).toHaveLength(HAND_SIZE);
    expect(firstSnapshot.hands.enemy).toHaveLength(HAND_SIZE);
    expect(firstSnapshot.hands.player.every((cardId) => customDeck.includes(cardId))).toBe(true);
    expect(firstSnapshot.hands.player).toEqual(replaySnapshot.hands.player);
    expect(firstSnapshot.next.player).toBe(replaySnapshot.next.player);
    expect(firstSnapshot.hands.enemy).toEqual(replaySnapshot.hands.enemy);
    expect(firstSnapshot.hands.player).not.toEqual(differentSnapshot.hands.player);
    expect(firstSnapshot.hands.player).not.toEqual(customDeck.slice(0, HAND_SIZE));
  });

  it('deals four cards and advances the seeded queue with the existing fair FIFO cycle', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });
    const before = engine.getSnapshot();
    const played = before.hands.player[0];

    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: played, x: 680, y: 420 })).toBe(true);
    const after = engine.getSnapshot();
    expect(after.hands.player).toEqual([...before.hands.player.slice(1), before.next.player]);
    expect(after.hands.player).toHaveLength(HAND_SIZE);
    expect(after.next.player).not.toBe(played);
    expect(new Set([...after.hands.player, after.next.player]).size).toBe(HAND_SIZE + 1);
  });

  it('drives duration, Charge pace, overclock timing, and Relay integrity from game mode data', () => {
    expect(GAME_MODES['core-siege']).toMatchObject({
      durationMs: 180_000,
      startingCharge: 5,
      chargeRegenPerSecond: 0.4,
      overclockThresholdMs: 60_000,
      relayHpMultiplier: 1,
    });
    expect(GAME_MODES['turbo-grid']).toMatchObject({
      durationMs: 90_000,
      startingCharge: 7,
      chargeRegenPerSecond: 0.7,
      overclockThresholdMs: 45_000,
      relayHpMultiplier: 0.8,
    });
    expect(GAME_MODES['relay-rush']).toMatchObject({
      durationMs: 120_000,
      startingCharge: 6,
      chargeRegenPerSecond: 0.5,
      overclockThresholdMs: 45_000,
      relayHpMultiplier: 0.72,
      relayScoreLimit: 2,
    });

    const turbo = new MatchEngine();
    startWithDeck(turbo, DEFAULT_PLAYER_DECK, 'turbo-grid');
    let snapshot = turbo.getSnapshot();
    expect(snapshot).toMatchObject({ modeId: 'turbo-grid', remainingMs: 90_000, charge: { player: 7 } });
    expect(snapshot.towers.find((tower) => tower.kind === 'relay')?.maxHp).toBe(1_600);
    advance(turbo, 1_000);
    expect(turbo.getSnapshot().charge.player).toBeCloseTo(7.875, 5);
    advance(turbo, 44_000);
    snapshot = turbo.getSnapshot();
    expect(snapshot.remainingMs).toBe(45_000);
    expect(snapshot.chargeOverclock).toBe(true);
  });

  it('preserves the locked mode, decks, and opening order on restart while clearing match state', () => {
    const engine = new MatchEngine(undefined, 8080);
    startWithDeck(engine, PROGRAM_TEST_DECK, 'turbo-grid');
    const opening = engine.getSnapshot();
    const zip = opening.hands.player.includes('zip') ? 'zip' : opening.hands.player[0];
    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: zip, x: 680, y: 420 })).toBe(true);
    engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'output' });
    const enemyRelay = engine.getSnapshot().towers.find((tower) => tower.id === 'enemy-left')!;
    engine.debugDamageTower(enemyRelay.id, enemyRelay.hp);

    expect(engine.dispatch({ type: 'restart' })).toBe(true);
    const restarted = engine.getSnapshot();
    expect(restarted).toMatchObject({
      phase: 'playing',
      modeId: 'turbo-grid',
      remainingMs: GAME_MODES['turbo-grid'].durationMs,
      charge: { player: GAME_MODES['turbo-grid'].startingCharge },
      score: { player: 0, enemy: 0 },
    });
    expect(restarted.decks.player).toEqual(PROGRAM_TEST_DECK);
    expect(restarted.hands).toEqual(opening.hands);
    expect(restarted.next).toEqual(opening.next);
    expect(restarted.units).toHaveLength(0);
    expect(restarted.installations).toHaveLength(0);
    expect(restarted.zones).toHaveLength(0);
    expect(restarted.upgrades.player.zip).toEqual({ output: 0, range: 0, speed: 0 });
    expect(restarted.result).toBeNull();
  });

  it('returns to a clean lobby snapshot and blocks match simulation until another start', () => {
    const engine = new MatchEngine();
    startWithDeck(engine, PROGRAM_TEST_DECK, 'relay-rush');
    const playing = engine.getSnapshot();
    const cardId = playing.hands.player[0];
    engine.dispatch({ type: 'playCard', team: 'player', cardId, x: 680, y: 420 });

    expect(engine.dispatch({ type: 'returnToLobby' })).toBe(true);
    const lobby = engine.getSnapshot();
    expect(lobby).toMatchObject({
      phase: 'menu',
      modeId: 'relay-rush',
      remainingMs: GAME_MODES['relay-rush'].durationMs,
      score: { player: 0, enemy: 0 },
      result: null,
      guidance: null,
    });
    expect(lobby.decks.player).toEqual(PROGRAM_TEST_DECK);
    expect(lobby.units).toHaveLength(0);
    expect(lobby.installations).toHaveLength(0);
    expect(lobby.zones).toHaveLength(0);
    engine.step(1_000);
    expect(engine.getSnapshot().remainingMs).toBe(lobby.remainingMs);
    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: lobby.hands.player[0], x: 600, y: 600 })).toBe(false);
  });

  it('ends Relay Rush immediately when either team secures two Relay points', () => {
    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    startWithDeck(engine, DEFAULT_PLAYER_DECK, 'relay-rush');
    const relays = engine
      .getSnapshot()
      .towers.filter((tower) => tower.team === 'enemy' && tower.kind === 'relay');
    expect(relays).toHaveLength(2);
    expect(relays.every((relay) => relay.maxHp === 1_440)).toBe(true);

    engine.debugDamageTower(relays[0].id, relays[0].hp);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'playing', score: { player: 1 } });
    engine.debugDamageTower(relays[1].id, relays[1].hp);
    expect(engine.getSnapshot()).toMatchObject({
      phase: 'ended',
      score: { player: 2 },
      result: { winner: 'player', reason: 'relay', headline: 'RELAYS OVERRUN' },
    });
    expect(events.at(-1)).toMatchObject({ type: 'matchEnded', result: { reason: 'relay' } });
  });

  it('opens with mixed tech, spends Charge, deploys by lane, and cycles the hand', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });

    expect(engine.getSnapshot()).toMatchObject({
      charge: { player: 5 },
      hands: { player: ['brute', 'nano', 'vector', 'zip'] },
      next: { player: 'sentry' },
    });

    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 420 })).toBe(true);
    const snapshot = engine.getSnapshot();

    expect(snapshot.charge.player).toBe(3);
    expect(snapshot.units).toHaveLength(1);
    expect(snapshot.units[0]).toMatchObject({ team: 'player', kind: 'zip', lane: 'left' });
    expect(snapshot.hands.player).toEqual(['brute', 'nano', 'vector', 'sentry']);
    expect(snapshot.next.player).toBe('emp');

    advance(engine, 2_500);
    expect(engine.getSnapshot().charge.player).toBeCloseTo(4.25, 5);
  });

  it('uses the visible perspective polygon as the authoritative home deployment area', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });

    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 549, y: 360 })).toBe(false);
    expect(engine.getSnapshot().charge.player).toBe(5);
    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 550, y: 360 })).toBe(true);
  });

  it('allows a strategic rear deployment behind the player Core', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });

    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 800, y: 625 })).toBe(true);
    expect(engine.getSnapshot().units.at(-1)).toMatchObject({ team: 'player', x: 800, y: 625 });
  });

  it('extends deployment into only the enemy lane whose Relay was destroyed', () => {
    const leftEngine = new MatchEngine();
    leftEngine.dispatch({ type: 'start' });

    expect(leftEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 220 })).toBe(false);
    leftEngine.debugDamageTower('enemy-left', 2_000);
    expect(leftEngine.getSnapshot().guidance).toBe('LEFT RELAY BREACHED — DEPLOYMENT EXTENDED');
    expect(leftEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 920, y: 220 })).toBe(false);
    expect(leftEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 800, y: 200 })).toBe(false);
    expect(leftEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 220 })).toBe(true);
    expect(leftEngine.getSnapshot().units.at(-1)).toMatchObject({ team: 'player', lane: 'left', x: 680, y: 220 });

    const rightEngine = new MatchEngine();
    rightEngine.dispatch({ type: 'start' });
    rightEngine.debugDamageTower('enemy-right', 2_000);
    expect(rightEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 220 })).toBe(false);
    expect(rightEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 920, y: 220 })).toBe(true);
    expect(rightEngine.getSnapshot().units.at(-1)).toMatchObject({ team: 'player', lane: 'right', x: 920, y: 220 });

    expect(rightEngine.dispatch({ type: 'restart' })).toBe(true);
    expect(rightEngine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 920, y: 220 })).toBe(false);
  });

  it('allows Installations in a breached lane without overlapping a live structure', () => {
    const engine = new MatchEngine();
    startWithDeck(engine, SENTRY_TEST_DECK);
    engine.debugDamageTower('enemy-left', 2_000);

    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'sentry', x: 800, y: 200 })).toBe(false);
    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'sentry', x: 680, y: 220 })).toBe(true);
    expect(engine.getSnapshot().installations.at(-1)).toMatchObject({ team: 'player', lane: 'left', x: 680, y: 220 });
  });

  it('applies the same destroyed-Relay lane restriction to enemy deployment', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });
    const enemyCard = engine
      .getSnapshot()
      .hands.enemy.find((cardId) => CARDS[cardId].category !== 'program')!;

    expect(engine.dispatch({ type: 'playCard', team: 'enemy', cardId: enemyCard, x: 920, y: 440 })).toBe(false);
    engine.debugDamageTower('player-right', 2_000);
    expect(engine.dispatch({ type: 'playCard', team: 'enemy', cardId: enemyCard, x: 680, y: 440 })).toBe(false);
    expect(engine.dispatch({ type: 'playCard', team: 'enemy', cardId: enemyCard, x: 920, y: 440 })).toBe(true);
  });

  it('casts Programs across the battlefield and gives EMP its disable plus exact 35% tower damage', () => {
    const engine = new MatchEngine();
    startWithDeck(engine, PROGRAM_TEST_DECK);
    const enemyRelay = engine.getSnapshot().towers.find((tower) => tower.id === 'enemy-left')!;

    harness(engine).spawnUnit('enemy', 'zip', enemyRelay.x, enemyRelay.y + 100);
    expect(
      engine.dispatch({
        type: 'playCard',
        team: 'player',
        cardId: 'emp',
        x: enemyRelay.x,
        y: enemyRelay.y,
      }),
    ).toBe(true);

    const afterCast = engine.getSnapshot();
    const disabledZip = afterCast.units.find((unit) => unit.team === 'enemy' && unit.kind === 'zip')!;
    const damagedRelay = afterCast.towers.find((tower) => tower.id === 'enemy-left')!;
    expect(PROGRAM_TOWER_DAMAGE_MULTIPLIER).toBe(0.35);
    expect(damagedRelay.hp).toBeCloseTo(
      enemyRelay.hp - PROGRAMS.emp.damage * PROGRAM_TOWER_DAMAGE_MULTIPLIER,
      5,
    );
    expect(disabledZip).toMatchObject({ hp: 60, disabledMs: 1_500 });

    const position = { x: disabledZip.x, y: disabledZip.y };
    advance(engine, 1_000);
    const whileDisabled = engine
      .getSnapshot()
      .units.find((unit) => unit.team === 'enemy' && unit.kind === 'zip')!;
    expect(whileDisabled).toMatchObject({ ...position, disabledMs: 500 });
  });

  it('ticks Nano Cloud persistently and removes the zone at exact expiry', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });
    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 420 })).toBe(true);
    advance(engine, 2_500);

    const relayBefore = engine.getSnapshot().towers.find((tower) => tower.id === 'enemy-left')!;
    expect(
      engine.dispatch({
        type: 'playCard',
        team: 'player',
        cardId: 'nano',
        x: relayBefore.x,
        y: relayBefore.y,
      }),
    ).toBe(true);
    expect(engine.getSnapshot().zones).toHaveLength(1);

    advance(engine, 950);
    expect(engine.getSnapshot().towers.find((tower) => tower.id === 'enemy-left')!.hp).toBe(relayBefore.hp);

    advance(engine, 50);
    expect(engine.getSnapshot().towers.find((tower) => tower.id === 'enemy-left')!.hp).toBeCloseTo(
      relayBefore.hp - PROGRAMS.nano.damage * PROGRAM_TOWER_DAMAGE_MULTIPLIER,
      5,
    );

    advance(engine, 4_900);
    expect(engine.getSnapshot().zones[0].remainingMs).toBe(100);
    advance(engine, 100);
    const expired = engine.getSnapshot();
    expect(expired.zones).toHaveLength(0);
    expect(expired.towers.find((tower) => tower.id === 'enemy-left')!.hp).toBeCloseTo(
      relayBefore.hp - PROGRAMS.nano.damage * PROGRAM_TOWER_DAMAGE_MULTIPLIER * 6,
      5,
    );
  });

  it('stops later combat systems when a zone ends the match', () => {
    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    engine.dispatch({ type: 'start' });
    const before = engine.getSnapshot();
    const enemyCore = before.towers.find((tower) => tower.id === 'enemy-core')!;
    const enemyRelay = before.towers.find((tower) => tower.id === 'enemy-left')!;
    const nanoTowerDamage = PROGRAMS.nano.damage * PROGRAM_TOWER_DAMAGE_MULTIPLIER;
    engine.debugDamageTower(enemyCore.id, enemyCore.hp - nanoTowerDamage);

    const target = harness(engine).spawnUnit(
      'player',
      'brute',
      enemyRelay.x,
      enemyRelay.y + 80,
    );
    harness(engine).zones.push({
      id: 'player-nano-terminal-test',
      kind: 'nano',
      team: 'player',
      x: enemyCore.x,
      y: enemyCore.y,
      radius: PROGRAMS.nano.radius,
      remainingMs: PROGRAMS.nano.durationMs,
      tickAccumulatorMs: PROGRAMS.nano.tickIntervalMs - FIXED_STEP_MS,
    });
    events.length = 0;

    engine.step(FIXED_STEP_MS);

    const ended = engine.getSnapshot();
    expect(ended).toMatchObject({
      phase: 'ended',
      result: { winner: 'player', reason: 'core' },
    });
    expect(ended.units.find((unit) => unit.id === target.id)?.hp).toBe(ROBOTS.brute.maxHp);
    expect(events.some((event) => event.type === 'projectileFired')).toBe(false);
  });

  it('restricts Installations to their side and applies health and lifetime decay', () => {
    const events = vi.fn();
    const engine = new MatchEngine(events);
    startWithDeck(engine, SENTRY_TEST_DECK);

    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'sentry', x: 800, y: 200 }),
    ).toBe(false);
    expect(engine.getSnapshot().charge.player).toBe(5);
    expect(engine.getSnapshot().installations).toHaveLength(0);
    expect(events).toHaveBeenCalledWith({ type: 'playRejected', team: 'player', reason: 'zone' });

    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'sentry', x: 800, y: 400 }),
    ).toBe(true);
    const placed = engine.getSnapshot().installations[0];
    expect(placed).toMatchObject({
      team: 'player',
      kind: 'sentry',
      hp: INSTALLATIONS.sentry.maxHp,
      remainingMs: INSTALLATIONS.sentry.lifetimeMs,
    });

    advance(engine, 1_000);
    const decayed = engine.getSnapshot().installations[0];
    expect(decayed.remainingMs).toBe(INSTALLATIONS.sentry.lifetimeMs - 1_000);
    expect(decayed.hp).toBeCloseTo(
      INSTALLATIONS.sentry.maxHp -
        (INSTALLATIONS.sentry.maxHp / INSTALLATIONS.sentry.lifetimeMs) * 1_000,
      5,
    );

    advance(engine, INSTALLATIONS.sentry.lifetimeMs - 1_000);
    expect(engine.getSnapshot().installations.filter((installation) => installation.team === 'player')).toHaveLength(0);
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'entityDestroyed',
        entity: expect.objectContaining({ id: placed.id, entityType: 'installation', team: 'player' }),
        cause: 'decay',
      }),
    );
  });

  it('has the Foundry fabricate a pair of lane-locked Microbots after activation', () => {
    const engine = new MatchEngine();
    startWithDeck(engine, PROGRAM_TEST_DECK);

    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 420 })).toBe(true);
    advance(engine, 250);
    expect(engine.dispatch({ type: 'playCard', team: 'player', cardId: 'emp', x: 800, y: 55 })).toBe(true);
    advance(engine, 9_750);
    expect(engine.getSnapshot().charge.player).toBeCloseTo(6, 5);
    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'foundry', x: 1_040, y: 420 }),
    ).toBe(true);

    advance(engine, INSTALLATIONS.foundry.activationDelayMs - 50);
    expect(
      engine.getSnapshot().units.filter((unit) => unit.team === 'player' && unit.kind === 'microbot'),
    ).toHaveLength(0);

    advance(engine, 50);
    const microbots = engine
      .getSnapshot()
      .units.filter((unit) => unit.team === 'player' && unit.kind === 'microbot');
    expect(microbots).toHaveLength(2);
    expect(microbots.every((unit) => unit.lane === 'right')).toBe(true);
  });

  it('keeps VECTOR-9 unique and spends two Charge on timed, cooling-down Overdrive', () => {
    const events = vi.fn();
    const engine = new MatchEngine(events);
    startWithDeck(engine, DEFAULT_PLAYER_DECK, 'turbo-grid');

    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'vector', x: 920, y: 420 }),
    ).toBe(true);
    const commander = harness(engine).units.find((unit) => unit.team === 'player' && unit.kind === 'vector')!;
    commander.hp = 10_000;
    commander.maxHp = 10_000;
    advance(engine, 250);
    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'vector', x: 900, y: 400 }),
    ).toBe(false);
    expect(events).toHaveBeenCalledWith({ type: 'playRejected', team: 'player', reason: 'unique' });
    expect(
      engine.getSnapshot().units.filter((unit) => unit.team === 'player' && unit.kind === 'vector'),
    ).toHaveLength(1);

    expect(engine.getSnapshot().charge.player).toBeCloseTo(
      OVERDRIVE_COST + GAME_MODES['turbo-grid'].chargeRegenPerSecond * 1.25 * 0.25,
      5,
    );
    expect(engine.getSnapshot().commander.player.available).toBe(true);
    expect(engine.dispatch({ type: 'activateOverdrive', team: 'player' })).toBe(true);
    const activated = engine.getSnapshot();
    expect(activated.charge.player).toBeCloseTo(
      GAME_MODES['turbo-grid'].chargeRegenPerSecond * 1.25 * 0.25,
      5,
    );
    expect(activated.commander.player).toMatchObject({
      active: true,
      remainingMs: OVERDRIVE_DURATION_MS,
      cooldownMs: OVERDRIVE_COOLDOWN_MS,
    });

    advance(engine, OVERDRIVE_DURATION_MS);
    const expired = engine.getSnapshot();
    expect(expired.commander.player).toMatchObject({
      active: false,
      remainingMs: 0,
      cooldownMs: OVERDRIVE_COOLDOWN_MS - OVERDRIVE_DURATION_MS,
    });
    expect(engine.dispatch({ type: 'activateOverdrive', team: 'player' })).toBe(false);
    expect(events).toHaveBeenCalledWith({ type: 'playRejected', team: 'player', reason: 'cooldown' });
  });

  it('scores Relay destruction and ends immediately when the enemy Core is destroyed', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });

    engine.debugDamageTower('enemy-left', 2_000);
    expect(engine.getSnapshot().score.player).toBe(1);
    expect(engine.getSnapshot().battleScore.player).toBe(500);
    expect(engine.getSnapshot().phase).toBe('playing');

    engine.debugDamageTower('enemy-core', 3_200);
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('ended');
    expect(snapshot.battleScore.player).toBe(3_000);
    expect(snapshot.result).toMatchObject({ winner: 'player', reason: 'core', headline: 'CORE CRASHED' });
    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 600, y: 530 }),
    ).toBe(false);
  });

  it('does not advance the clock while paused', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });
    engine.dispatch({ type: 'togglePause' });
    const before = engine.getSnapshot().remainingMs;
    advance(engine, 5_000);
    expect(engine.getSnapshot().remainingMs).toBe(before);
  });

  it('charges exact upgrade costs, applies both tiers, rejects invalid purchases, and resets upgrades', () => {
    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    engine.dispatch({ type: 'start' });

    expect(UPGRADE_COSTS).toEqual([2, 3]);
    expect(UPGRADE_MULTIPLIERS).toEqual({
      output: [1, 1.12, 1.24],
      range: [1, 1.08, 1.16],
      speed: [1, 1.08, 1.16],
    });

    expect(engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'output' })).toBe(true);
    let snapshot = engine.getSnapshot();
    expect(snapshot.charge.player).toBe(3);
    expect(snapshot.upgrades.player.zip.output).toBe(1);
    expect(getEffectiveRobotStats('zip', snapshot.upgrades.player.zip)).toMatchObject({
      damage: ROBOTS.zip.damage * 1.12,
      range: ROBOTS.zip.range,
      speed: ROBOTS.zip.speed,
    });
    expect(events).toContainEqual({
      type: 'robotUpgraded',
      team: 'player',
      robotId: 'zip',
      stat: 'output',
      tier: 1,
      cost: 2,
    });

    expect(engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'output' })).toBe(true);
    snapshot = engine.getSnapshot();
    expect(snapshot.charge.player).toBe(0);
    expect(snapshot.upgrades.player.zip.output).toBe(2);
    expect(getEffectiveRobotStats('zip', snapshot.upgrades.player.zip).damage).toBeCloseTo(47.12, 8);
    expect(events).toContainEqual({
      type: 'robotUpgraded',
      team: 'player',
      robotId: 'zip',
      stat: 'output',
      tier: 2,
      cost: 3,
    });

    expect(engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'output' })).toBe(false);
    expect(events.at(-1)).toEqual({
      type: 'upgradeRejected',
      team: 'player',
      robotId: 'zip',
      stat: 'output',
      reason: 'maxTier',
    });
    expect(engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'range' })).toBe(false);
    expect(events.at(-1)).toEqual({
      type: 'upgradeRejected',
      team: 'player',
      robotId: 'zip',
      stat: 'range',
      reason: 'charge',
    });

    const fullyUpgraded = getEffectiveRobotStats('zip', { output: 2, range: 2, speed: 2 });
    expect(fullyUpgraded.damage).toBeCloseTo(47.12, 8);
    expect(fullyUpgraded.range).toBeCloseTo(44.08, 8);
    expect(fullyUpgraded.speed).toBeCloseTo(129.92, 8);

    engine.dispatch({ type: 'restart' });
    snapshot = engine.getSnapshot();
    expect(snapshot.charge.player).toBe(5);
    expect(snapshot.upgrades.player.zip).toEqual({ output: 0, range: 0, speed: 0 });
  });

  it('keeps robot upgrades specific to the team that purchased them', () => {
    const engine = new MatchEngine();
    engine.dispatch({ type: 'start' });

    expect(engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'output' })).toBe(true);
    expect(engine.dispatch({ type: 'upgradeRobot', team: 'enemy', robotId: 'zip', stat: 'range' })).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.charge).toEqual({ player: 3, enemy: 3 });
    expect(snapshot.upgrades.player.zip).toEqual({ output: 1, range: 0, speed: 0 });
    expect(snapshot.upgrades.enemy.zip).toEqual({ output: 0, range: 1, speed: 0 });
    expect(getEffectiveRobotStats('zip', snapshot.upgrades.player.zip)).toMatchObject({
      damage: ROBOTS.zip.damage * 1.12,
      range: ROBOTS.zip.range,
    });
    expect(getEffectiveRobotStats('zip', snapshot.upgrades.enemy.zip)).toMatchObject({
      damage: ROBOTS.zip.damage,
      range: ROBOTS.zip.range * 1.08,
    });
  });

  it('maps bullet and rocket weapons for robots and both tower classes', () => {
    const towers = createTowers();
    expect(ROBOTS.vector.projectile).toBe('bullet');
    expect(ROBOTS.brute.projectile).toBe('rocket');
    expect(towers.find((tower) => tower.kind === 'relay')?.projectile).toBe('bullet');
    expect(towers.find((tower) => tower.kind === 'core')?.projectile).toBe('rocket');
  });

  it('emits sequential projectiles before the linked projectile destruction event', () => {
    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    engine.dispatch({ type: 'start' });
    const enemyRelay = engine.getSnapshot().towers.find((tower) => tower.id === 'enemy-left')!;
    engine.debugDamageTower(enemyRelay.id, enemyRelay.hp - ROBOTS.vector.damage);

    // This location is in both weapons' reach but outside the rear Core's range,
    // keeping the event-order assertion focused on one Relay and one robot.
    expect(harness(engine).spawnUnit('player', 'vector', 570, 160))
      .toBeTruthy();
    advance(engine, 300);

    const projectileEvents = events.filter((event) => event.type === 'projectileFired');
    expect(projectileEvents.map((event) => event.attackId)).toEqual([1, 2]);
    expect(projectileEvents[0]).toMatchObject({
      projectile: 'bullet',
      source: { id: 'enemy-left', entityType: 'tower', team: 'enemy' },
      target: { id: 'player-vector-1', entityType: 'unit', team: 'player' },
    });
    expect(projectileEvents[1]).toMatchObject({
      attackId: 2,
      projectile: 'bullet',
      source: { id: 'player-vector-1', entityType: 'unit', team: 'player' },
      target: { id: 'enemy-left', entityType: 'tower', team: 'enemy' },
      amount: ROBOTS.vector.damage,
    });

    const destroyedIndex = events.findIndex(
      (event) => event.type === 'entityDestroyed' && event.entity.id === enemyRelay.id,
    );
    const destroyed = events[destroyedIndex];
    expect(destroyed).toMatchObject({
      type: 'entityDestroyed',
      entity: { id: 'enemy-left', entityType: 'tower', team: 'enemy' },
      cause: 'projectile',
      byTeam: 'player',
      attackId: 2,
    });
    expect(events.findIndex((event) => event.type === 'projectileFired' && event.attackId === 2)).toBeLessThan(
      destroyedIndex,
    );
  });

  it('reports a Program kill as program destruction without a projectile link', () => {
    const events: GameEvent[] = [];
    const engine = new MatchEngine((event) => events.push(event));
    startWithDeck(engine, PROGRAM_TEST_DECK);
    const target = harness(engine).spawnUnit('enemy', 'zip', 900, 200);
    target.hp = PROGRAMS.emp.damage;
    events.length = 0;

    expect(
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'emp', x: target.x, y: target.y }),
    ).toBe(true);

    expect(events).toContainEqual({
      type: 'entityDestroyed',
      entity: expect.objectContaining({ id: target.id, entityType: 'unit', team: 'enemy' }),
      cause: 'program',
      byTeam: 'player',
      attackId: undefined,
    });
    expect(events.some((event) => event.type === 'projectileFired')).toBe(false);
  });

  it('replays upgrade commands and the resulting battle identically with the same seed', () => {
    const first = new MatchEngine(undefined, 314159);
    const second = new MatchEngine(undefined, 314159);
    for (const engine of [first, second]) {
      engine.dispatch({ type: 'start' });
      engine.dispatch({ type: 'upgradeRobot', team: 'player', robotId: 'zip', stat: 'speed' });
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 420 });
      advance(engine, 12_000);
    }
    expect(first.getSnapshot().upgrades.player.zip.speed).toBe(1);
    expect(second.getSnapshot()).toEqual(first.getSnapshot());
  });

  it('replays identically with the same seed and commands', () => {
    const first = new MatchEngine(undefined, 42);
    const second = new MatchEngine(undefined, 42);
    for (const engine of [first, second]) {
      engine.dispatch({ type: 'start' });
      engine.dispatch({ type: 'playCard', team: 'player', cardId: 'zip', x: 680, y: 420 });
      advance(engine, 12_000);
    }
    expect(second.getSnapshot()).toEqual(first.getSnapshot());
  });
});
