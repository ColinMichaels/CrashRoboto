import type {
  CardDefinition,
  CardId,
  GameModeDefinition,
  GameModeId,
  InstallationDefinition,
  InstallationKind,
  ProgramDefinition,
  ProgramKind,
  RobotDefinition,
  RobotCardId,
  RobotKind,
  RobotUpgradeState,
  MatchConfig,
  Team,
  TowerState,
  TowerWeaponDefinition,
  TowerWeaponId,
  TowerWeaponLoadout,
  UpgradeStat,
} from './types';
import { BASE_FIRMWARE_BUDGET, MAX_FIRMWARE_BUDGET } from './progression';

export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 684;
export const RIVER_Y = 305;
export const MAX_CHARGE = 10;
export const FIXED_STEP_MS = 50;
export const PROGRAM_TOWER_DAMAGE_MULTIPLIER = 0.35;
export const OVERDRIVE_COST = 2;
export const OVERDRIVE_DURATION_MS = 5_000;
export const OVERDRIVE_COOLDOWN_MS = 14_000;
export const OVERDRIVE_AURA_RADIUS = 180;
export const DECK_SIZE = 8;
export const HAND_SIZE = 4;

export const TOWER_WEAPON_IDS: TowerWeaponId[] = ['gun', 'rocket', 'flame'];
export const DEFAULT_TOWER_WEAPON_ID: TowerWeaponId = 'gun';
export const TOWER_WEAPONS: Record<TowerWeaponId, TowerWeaponDefinition> = {
  gun: {
    id: 'gun',
    name: 'Twin Gun',
    shortName: 'GUN',
    description: 'Fast single-target fire with balanced reach.',
    damage: 64,
    range: 245,
    attackInterval: 0.55,
    projectile: 'bullet',
    splashRadius: 0,
    splashMultiplier: 0,
    frame: 0,
    accent: '#57e8f5',
  },
  rocket: {
    id: 'rocket',
    name: 'Siege Rockets',
    shortName: 'ROCKET',
    description: 'Heavy long-range splash damage with a slow firing cycle.',
    damage: 190,
    range: 270,
    attackInterval: 1.8,
    projectile: 'rocket',
    splashRadius: 82,
    splashMultiplier: 0.58,
    frame: 1,
    accent: '#ffc857',
  },
  flame: {
    id: 'flame',
    name: 'Flame Jet',
    shortName: 'FLAME',
    description: 'Rapid short-range thermal splash that controls clustered attackers.',
    damage: 36,
    range: 150,
    attackInterval: 0.3,
    projectile: 'flame',
    splashRadius: 58,
    splashMultiplier: 0.72,
    frame: 2,
    accent: '#ff7548',
  },
};

export const createDefaultTowerWeapons = (): TowerWeaponLoadout => ({
  left: DEFAULT_TOWER_WEAPON_ID,
  right: DEFAULT_TOWER_WEAPON_ID,
});

export const isTowerWeaponId = (value: unknown): value is TowerWeaponId =>
  typeof value === 'string' && Object.hasOwn(TOWER_WEAPONS, value);

export function normalizeTowerWeapons(value: unknown): TowerWeaponLoadout | null {
  if (value === undefined) return createDefaultTowerWeapons();
  if (!isPlainRecord(value)) return null;
  const entries = getOwnEntries(value);
  if (!entries || entries.some(([lane]) => lane !== 'left' && lane !== 'right')) return null;
  const candidate = value as Partial<Record<'left' | 'right', unknown>>;
  if (!isTowerWeaponId(candidate.left) || !isTowerWeaponId(candidate.right)) return null;
  return { left: candidate.left, right: candidate.right };
}

export const GAME_MODE_IDS: GameModeId[] = ['core-siege', 'turbo-grid', 'relay-rush'];
export const DEFAULT_GAME_MODE_ID: GameModeId = 'core-siege';
export const GAME_MODES: Record<GameModeId, GameModeDefinition> = {
  'core-siege': {
    id: 'core-siege',
    name: 'Core Siege',
    shortName: 'CORE SIEGE',
    description: 'The full three-minute command battle. Break Relays or crash the enemy Core.',
    durationMs: 180_000,
    startingCharge: 5,
    chargeRegenPerSecond: 0.4,
    overclockThresholdMs: 60_000,
    relayHpMultiplier: 1,
  },
  'turbo-grid': {
    id: 'turbo-grid',
    name: 'Turbo Grid',
    shortName: 'TURBO GRID',
    description: 'A compressed 90-second battle with lighter Relays and accelerated Charge flow.',
    durationMs: 90_000,
    startingCharge: 7,
    chargeRegenPerSecond: 0.7,
    overclockThresholdMs: 45_000,
    relayHpMultiplier: 0.8,
  },
  'relay-rush': {
    id: 'relay-rush',
    name: 'Relay Rush',
    shortName: 'RELAY RUSH',
    description: 'A two-minute race to breach both enemy Relays. Two Data Points end the match immediately.',
    durationMs: 120_000,
    startingCharge: 6,
    chargeRegenPerSecond: 0.5,
    overclockThresholdMs: 45_000,
    relayHpMultiplier: 0.72,
    relayScoreLimit: 2,
  },
};

export const LOBBY_FIRMWARE_BUDGET = BASE_FIRMWARE_BUDGET;
export const UPGRADE_COSTS = [2, 3] as const;
export const UPGRADE_MULTIPLIERS: Record<UpgradeStat, readonly [number, number, number]> = {
  output: [1, 1.12, 1.24],
  range: [1, 1.08, 1.16],
  speed: [1, 1.08, 1.16],
};

export const ROBOT_CARD_IDS: RobotCardId[] = [
  'zip',
  'swarm',
  'brute',
  'rail',
  'pulse',
  'arc',
  'drone',
  'patch',
  'vector',
];

export const createEmptyRobotUpgrades = (): Record<RobotCardId, RobotUpgradeState> =>
  Object.fromEntries(
    ROBOT_CARD_IDS.map((robotId) => [robotId, { output: 0, range: 0, speed: 0 }]),
  ) as Record<RobotCardId, RobotUpgradeState>;

export const cloneRobotUpgrades = (
  upgrades: Record<RobotCardId, RobotUpgradeState>,
): Record<RobotCardId, RobotUpgradeState> =>
  Object.fromEntries(
    ROBOT_CARD_IDS.map((robotId) => [robotId, { ...upgrades[robotId] }]),
  ) as Record<RobotCardId, RobotUpgradeState>;

export const isUpgradeTier = (value: unknown): value is RobotUpgradeState[UpgradeStat] =>
  value === 0 || value === 1 || value === 2;

const UPGRADE_STATS: UpgradeStat[] = ['output', 'range', 'speed'];
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};
const getOwnEntries = (value: Record<string, unknown>): [string, unknown][] | null => {
  try {
    return Object.entries(value);
  } catch {
    return null;
  }
};

export function normalizePlayerUpgrades(
  value: unknown,
  playerDeck: readonly CardId[],
  firmwareBudget = LOBBY_FIRMWARE_BUDGET,
): Record<RobotCardId, RobotUpgradeState> | null {
  const normalized = createEmptyRobotUpgrades();
  if (value === undefined) return normalized;
  if (!isPlainRecord(value)) return null;
  const robotEntries = getOwnEntries(value);
  if (!robotEntries) return null;

  for (const [robotId, rawState] of robotEntries) {
    if (!ROBOT_CARD_IDS.includes(robotId as RobotCardId)) return null;
    if (rawState === undefined) continue;
    if (!isPlainRecord(rawState)) return null;
    const statEntries = getOwnEntries(rawState);
    if (!statEntries) return null;

    for (const [stat, rawTier] of statEntries) {
      if (!UPGRADE_STATS.includes(stat as UpgradeStat)) return null;
      if (rawTier === undefined) continue;
      if (!isUpgradeTier(rawTier)) return null;
      normalized[robotId as RobotCardId][stat as UpgradeStat] = rawTier;
    }
  }

  let tierPointSpend = 0;
  const playerCards = new Set(playerDeck);
  for (const robotId of ROBOT_CARD_IDS) {
    const state = normalized[robotId];
    const robotSpend = state.output + state.range + state.speed;
    if (robotSpend > 0 && !playerCards.has(robotId)) return null;
    tierPointSpend += robotSpend;
  }
  return tierPointSpend <= firmwareBudget ? normalized : null;
}

export const getUpgradeCost = (tier: RobotUpgradeState[UpgradeStat]): number | null =>
  tier === 0 ? UPGRADE_COSTS[0] : tier === 1 ? UPGRADE_COSTS[1] : null;

export function getLaneX(lane: 'left' | 'right', y: number): number {
  const clampedY = Math.max(0, Math.min(BOARD_HEIGHT, y));
  const spread = clampedY <= RIVER_Y
    ? 95 + (RIVER_Y - clampedY) * 0.18
    : 95 + (clampedY - RIVER_Y) * 0.28;
  return 800 + (lane === 'left' ? -spread : spread);
}

export function getPerspectiveScale(y: number): number {
  const depth = Math.max(0, Math.min(1, y / BOARD_HEIGHT));
  return 0.6 + depth * 0.46;
}

export const ROBOTS: Record<RobotKind, RobotDefinition> = {
  zip: {
    id: 'zip',
    name: 'Bolt Hound',
    shortName: 'ZIP',
    description: 'Fast ground interceptor',
    cost: 2,
    category: 'unit',
    techClass: 'standard',
    sheet: 'robot',
    maxHp: 180,
    damage: 38,
    attackInterval: 0.75,
    range: 38,
    speed: 112,
    frame: 0,
    radius: 28,
    targeting: 'ground',
    projectile: 'bullet',
    abilityName: 'Turbo Pursuit',
    abilityDescription: 'High-speed Ground-Lock interceptor with a rapid 0.75-second strike cycle.',
  },
  swarm: {
    id: 'swarm',
    name: 'Microbit Swarm',
    shortName: 'SWARM',
    description: 'Fast ground burst squad',
    cost: 3,
    category: 'unit',
    techClass: 'standard',
    sheet: 'robot',
    maxHp: 240,
    damage: 58,
    attackInterval: 0.58,
    range: 42,
    speed: 116,
    frame: 1,
    radius: 31,
    targeting: 'ground',
    projectile: 'bullet',
    abilityName: 'Packet Flood',
    abilityDescription: 'Surface-Lock squad with the roster’s quickest 0.58-second strike cycle.',
  },
  brute: {
    id: 'brute',
    name: 'Titan-0',
    shortName: 'BRUTE',
    description: 'Armored structure-priority tank',
    cost: 4,
    category: 'unit',
    techClass: 'advanced',
    sheet: 'robot',
    maxHp: 1050,
    damage: 78,
    attackInterval: 1.4,
    range: 42,
    speed: 48,
    frame: 2,
    radius: 38,
    targeting: 'ground',
    structurePreferred: true,
    projectile: 'rocket',
    abilityName: 'Siege Bias',
    abilityDescription: 'Armored frame uses a short troop leash and favors enemy structures.',
  },
  rail: {
    id: 'rail',
    name: 'Rail Strider',
    shortName: 'RAIL',
    description: 'Long-range structure-locked siege',
    cost: 5,
    category: 'unit',
    techClass: 'prototype',
    sheet: 'robot',
    maxHp: 520,
    damage: 145,
    attackInterval: 1.8,
    range: 220,
    speed: 44,
    frame: 3,
    radius: 34,
    targeting: 'structures',
    structureOnly: true,
    ranged: true,
    projectile: 'rocket',
    abilityName: 'Hardpoint Lock',
    abilityDescription: 'Ignores robots and engages only Installations or Towers from siege range.',
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse Ranger',
    shortName: 'PULSE',
    description: 'Omni-track ranged support',
    cost: 3,
    category: 'unit',
    techClass: 'advanced',
    sheet: 'robot',
    maxHp: 240,
    damage: 52,
    attackInterval: 1,
    range: 160,
    speed: 74,
    frame: 4,
    radius: 29,
    targeting: 'any',
    ranged: true,
    projectile: 'bullet',
    abilityName: 'Omni-Track',
    abilityDescription: 'Ranged targeting engages both ground and flying threats.',
  },
  arc: {
    id: 'arc',
    name: 'Arc Crawler',
    shortName: 'ARC',
    description: 'Omni-track area disruption bot',
    cost: 4,
    category: 'unit',
    techClass: 'prototype',
    sheet: 'robot',
    maxHp: 450,
    damage: 65,
    attackInterval: 1.3,
    range: 120,
    speed: 62,
    frame: 5,
    radius: 32,
    targeting: 'any',
    ranged: true,
    splashRadius: 62,
    projectile: 'rocket',
    abilityName: 'Arc Splash',
    abilityDescription: 'Primary hits arc 58% damage into robots within 62 range.',
  },
  drone: {
    id: 'drone',
    name: 'Jet Drone',
    shortName: 'DRONE',
    description: 'Exotic fast hover attacker',
    cost: 4,
    category: 'unit',
    techClass: 'exotic',
    sheet: 'robot',
    maxHp: 330,
    damage: 48,
    attackInterval: 0.9,
    range: 120,
    speed: 88,
    frame: 6,
    radius: 31,
    targeting: 'any',
    flying: true,
    ranged: true,
    projectile: 'rocket',
    abilityName: 'Aerial Chassis',
    abilityDescription: 'Flying ranged attacker that engages ground and airborne targets.',
  },
  patch: {
    id: 'patch',
    name: 'Patch Bot',
    shortName: 'PATCH',
    description: 'Support protocol repair unit',
    cost: 3,
    category: 'unit',
    techClass: 'advanced',
    sheet: 'robot',
    maxHp: 280,
    damage: 22,
    attackInterval: 1.2,
    range: 108,
    speed: 75,
    frame: 7,
    radius: 30,
    targeting: 'support',
    ranged: true,
    heal: 44,
    projectile: 'bullet',
    abilityName: 'Repair Protocol',
    abilityDescription: 'Repairs allied robots for 44 and Installations for 22 each cycle.',
  },
  vector: {
    id: 'vector',
    name: 'VECTOR-9',
    shortName: 'VECTOR-9',
    description: 'Unique Omni-track Commander',
    cost: 5,
    category: 'commander',
    techClass: 'commander',
    sheet: 'system',
    maxHp: 920,
    damage: 76,
    attackInterval: 1.1,
    range: 150,
    speed: 66,
    frame: 4,
    radius: 38,
    targeting: 'any',
    ranged: true,
    commander: true,
    projectile: 'bullet',
    abilityName: 'Overdrive Aura',
    abilityDescription: 'Spend 2 Charge for 5 seconds of faster movement and attack cycles in a 180-range aura.',
  },
  microbot: {
    id: 'microbot',
    name: 'Foundry Microbot',
    shortName: 'MICRO',
    description: 'Fabricated ground skirmisher',
    cost: 0,
    category: 'unit',
    techClass: 'standard',
    sheet: 'robot',
    maxHp: 60,
    damage: 15,
    attackInterval: 0.65,
    range: 30,
    speed: 108,
    frame: 1,
    radius: 16,
    targeting: 'ground',
    projectile: 'bullet',
    abilityName: 'Fabricated Rush',
    abilityDescription: 'Disposable Surface-Lock pressure unit fabricated in paired waves.',
  },
};

export interface EffectiveRobotStats {
  damage: number;
  heal: number;
  range: number;
  speed: number;
  dps: number;
}

export function getEffectiveRobotStats(
  kind: RobotKind,
  upgrades?: RobotUpgradeState,
): EffectiveRobotStats {
  const robot = ROBOTS[kind];
  const outputTier = upgrades?.output ?? 0;
  const rangeTier = upgrades?.range ?? 0;
  const speedTier = upgrades?.speed ?? 0;
  const damage = robot.damage * UPGRADE_MULTIPLIERS.output[outputTier];
  return {
    damage,
    heal: (robot.heal ?? 0) * UPGRADE_MULTIPLIERS.output[outputTier],
    range: robot.range * UPGRADE_MULTIPLIERS.range[rangeTier],
    speed: robot.speed * UPGRADE_MULTIPLIERS.speed[speedTier],
    dps: damage / robot.attackInterval,
  };
}

export const PROGRAMS: Record<ProgramKind, ProgramDefinition> = {
  emp: {
    id: 'emp',
    name: 'EMP Flash',
    shortName: 'EMP',
    description: 'Instant burst and system disable',
    cost: 2,
    category: 'program',
    techClass: 'advanced',
    sheet: 'system',
    frame: 0,
    effect: 'burst',
    radius: 150,
    damage: 120,
    durationMs: 0,
    tickIntervalMs: 0,
    disableMs: 1_500,
  },
  nano: {
    id: 'nano',
    name: 'Nano Cloud',
    shortName: 'NANO',
    description: 'Persistent corrosive damage field',
    cost: 4,
    category: 'program',
    techClass: 'prototype',
    sheet: 'system',
    frame: 1,
    effect: 'persistent',
    radius: 135,
    damage: 32,
    durationMs: 6_000,
    tickIntervalMs: 1_000,
  },
};

export const INSTALLATIONS: Record<InstallationKind, InstallationDefinition> = {
  sentry: {
    id: 'sentry',
    name: 'Arc Sentry',
    shortName: 'SENTRY',
    description: 'Decaying anti-unit defense',
    cost: 4,
    category: 'installation',
    techClass: 'prototype',
    sheet: 'system',
    frame: 2,
    maxHp: 680,
    lifetimeMs: 32_000,
    radius: 35,
    damage: 46,
    attackInterval: 0.75,
    range: 200,
    activationDelayMs: 500,
    projectile: 'bullet',
  },
  foundry: {
    id: 'foundry',
    name: 'Microbot Foundry',
    shortName: 'FOUNDRY',
    description: 'Fabricates paired pressure waves',
    cost: 5,
    category: 'installation',
    techClass: 'prototype',
    sheet: 'system',
    frame: 3,
    maxHp: 760,
    lifetimeMs: 35_000,
    radius: 46,
    damage: 0,
    attackInterval: 0,
    range: 0,
    spawnIntervalMs: 7_000,
    activationDelayMs: 1_500,
  },
};

export const CARDS = {
  zip: ROBOTS.zip,
  swarm: ROBOTS.swarm,
  brute: ROBOTS.brute,
  rail: ROBOTS.rail,
  pulse: ROBOTS.pulse,
  arc: ROBOTS.arc,
  drone: ROBOTS.drone,
  patch: ROBOTS.patch,
  vector: ROBOTS.vector,
  emp: PROGRAMS.emp,
  nano: PROGRAMS.nano,
  sentry: INSTALLATIONS.sentry,
  foundry: INSTALLATIONS.foundry,
} as Record<CardId, CardDefinition & { id: CardId }>;

// Eight-chip showcase decks. Matches shuffle a private copy before dealing the opening hand.
export const DEFAULT_PLAYER_DECK: CardId[] = ['zip', 'emp', 'sentry', 'vector', 'nano', 'foundry', 'pulse', 'brute'];
export const DEFAULT_ENEMY_DECK: CardId[] = ['zip', 'emp', 'sentry', 'vector', 'nano', 'foundry', 'pulse', 'brute'];

export const isGameModeId = (value: unknown): value is GameModeId =>
  typeof value === 'string' && Object.hasOwn(GAME_MODES, value);

export const isCardId = (value: unknown): value is CardId =>
  typeof value === 'string' && Object.hasOwn(CARDS, value);

export function isValidDeck(value: unknown): value is CardId[] {
  if (!Array.isArray(value) || value.length !== DECK_SIZE) return false;
  if (!value.every(isCardId)) return false;
  return new Set(value).size === DECK_SIZE;
}

export function createDefaultMatchConfig(): MatchConfig {
  return {
    modeId: DEFAULT_GAME_MODE_ID,
    playerDeck: [...DEFAULT_PLAYER_DECK],
    playerUpgrades: createEmptyRobotUpgrades(),
    playerTowerWeapons: createDefaultTowerWeapons(),
  };
}

export function validateMatchConfig(value: unknown): MatchConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  try {
    const candidate = value as {
      modeId?: unknown;
      playerDeck?: unknown;
      playerUpgrades?: unknown;
      playerTowerWeapons?: unknown;
      playerFirmwareBudget?: unknown;
    };
    if (!isGameModeId(candidate.modeId) || !isValidDeck(candidate.playerDeck)) return null;
    const firmwareBudget = candidate.playerFirmwareBudget === undefined
      ? LOBBY_FIRMWARE_BUDGET
      : candidate.playerFirmwareBudget;
    if (
      !Number.isInteger(firmwareBudget) ||
      (firmwareBudget as number) < LOBBY_FIRMWARE_BUDGET ||
      (firmwareBudget as number) > MAX_FIRMWARE_BUDGET
    ) return null;
    const playerUpgrades = normalizePlayerUpgrades(candidate.playerUpgrades, candidate.playerDeck, firmwareBudget as number);
    const playerTowerWeapons = normalizeTowerWeapons(candidate.playerTowerWeapons);
    if (!playerUpgrades || !playerTowerWeapons) return null;
    const config: MatchConfig = {
      modeId: candidate.modeId,
      playerDeck: [...candidate.playerDeck],
      playerUpgrades,
      playerTowerWeapons,
    };
    if (candidate.playerFirmwareBudget !== undefined) config.playerFirmwareBudget = firmwareBudget as number;
    return config;
  } catch {
    return null;
  }
}

const tower = (
  id: string,
  team: Team,
  kind: 'relay' | 'core',
  lane: 'left' | 'right' | 'core',
  x: number,
  y: number,
  relayHpMultiplier: number,
  weaponId: TowerWeaponId,
): TowerState => {
  const core = kind === 'core';
  const maxHp = core ? 3200 : Math.round(2000 * relayHpMultiplier);
  const weapon = TOWER_WEAPONS[weaponId];
  return {
    id,
    team,
    kind,
    lane,
    x,
    y,
    hp: maxHp,
    maxHp,
    cooldown: 0,
    damage: core ? 118 : weapon.damage,
    range: core ? 255 : weapon.range,
    attackInterval: core ? 0.85 : weapon.attackInterval,
    projectile: core ? 'rocket' : weapon.projectile,
    weapon: core ? 'rocket' : weaponId,
    splashRadius: core ? 72 : weapon.splashRadius,
    splashMultiplier: core ? 0.5 : weapon.splashMultiplier,
  };
};

export function createTowers(
  relayHpMultiplier = 1,
  playerWeapons: TowerWeaponLoadout = createDefaultTowerWeapons(),
  enemyWeapons: TowerWeaponLoadout = createDefaultTowerWeapons(),
): TowerState[] {
  // Both networks sit on their rear mounting pads: enemy structures hug the
  // far edge while the player's mirrored line anchors the near edge.
  return [
    tower('enemy-left', 'enemy', 'relay', 'left', getLaneX('left', 118), 118, relayHpMultiplier, enemyWeapons.left),
    tower('enemy-core', 'enemy', 'core', 'core', 800, 92, relayHpMultiplier, 'rocket'),
    tower('enemy-right', 'enemy', 'relay', 'right', getLaneX('right', 118), 118, relayHpMultiplier, enemyWeapons.right),
    tower('player-left', 'player', 'relay', 'left', getLaneX('left', 550), 550, relayHpMultiplier, playerWeapons.left),
    tower('player-core', 'player', 'core', 'core', 800, 575, relayHpMultiplier, 'rocket'),
    tower('player-right', 'player', 'relay', 'right', getLaneX('right', 550), 550, relayHpMultiplier, playerWeapons.right),
  ];
}

export const getOpponent = (team: Team): Team => (team === 'player' ? 'enemy' : 'player');
