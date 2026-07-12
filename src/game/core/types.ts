export type Team = 'player' | 'enemy';
export type Lane = 'left' | 'right';
export type MatchPhase = 'menu' | 'playing' | 'paused' | 'ended';
export type GameModeId = 'core-siege' | 'turbo-grid' | 'relay-rush';

export type TechClass = 'standard' | 'advanced' | 'prototype' | 'exotic' | 'commander';
export type CardCategory = 'unit' | 'program' | 'installation' | 'commander';
export type TargetingType = 'any' | 'ground' | 'structures' | 'support';
export type ProjectileKind = 'bullet' | 'rocket' | 'flame';
export type UpgradeStat = 'output' | 'range' | 'speed';
export type UpgradeTier = 0 | 1 | 2;
export type TowerWeaponId = 'gun' | 'rocket' | 'flame';
export type TowerWeaponLoadout = Record<Lane, TowerWeaponId>;

export type RobotCardId =
  | 'zip'
  | 'swarm'
  | 'brute'
  | 'rail'
  | 'pulse'
  | 'arc'
  | 'drone'
  | 'patch'
  | 'vector';

export type RobotKind = RobotCardId | 'microbot';
export type ProgramKind = 'emp' | 'nano';
export type InstallationKind = 'sentry' | 'foundry';
export type CardId = RobotCardId | ProgramKind | InstallationKind;
export type SpriteSheet = 'robot' | 'system';

export type PlayerUpgradeConfig = Partial<Record<RobotCardId, Partial<RobotUpgradeState>>>;

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  shortName: string;
  description: string;
  durationMs: number;
  startingCharge: number;
  chargeRegenPerSecond: number;
  overclockThresholdMs: number;
  relayHpMultiplier: number;
  relayScoreLimit?: number;
}

export interface MatchConfig {
  modeId: GameModeId;
  playerDeck: CardId[];
  playerUpgrades?: PlayerUpgradeConfig;
  playerTowerWeapons?: TowerWeaponLoadout;
  playerFirmwareBudget?: number;
}

export interface TowerWeaponDefinition {
  id: TowerWeaponId;
  name: string;
  shortName: string;
  description: string;
  damage: number;
  range: number;
  attackInterval: number;
  projectile: ProjectileKind;
  splashRadius: number;
  splashMultiplier: number;
  frame: number;
  accent: string;
}

export interface BaseCardDefinition {
  id: CardId;
  name: string;
  shortName: string;
  description: string;
  cost: number;
  category: CardCategory;
  techClass: TechClass;
  sheet: SpriteSheet;
  frame: number;
}

export interface RobotDefinition {
  id: RobotKind;
  name: string;
  shortName: string;
  description: string;
  cost: number;
  category: 'unit' | 'commander';
  techClass: TechClass;
  sheet: SpriteSheet;
  frame: number;
  maxHp: number;
  damage: number;
  attackInterval: number;
  range: number;
  speed: number;
  radius: number;
  targeting: TargetingType;
  flying?: boolean;
  ranged?: boolean;
  structureOnly?: boolean;
  structurePreferred?: boolean;
  splashRadius?: number;
  heal?: number;
  commander?: boolean;
  projectile: ProjectileKind;
  abilityName: string;
  abilityDescription: string;
}

export interface ProgramDefinition extends BaseCardDefinition {
  id: ProgramKind;
  category: 'program';
  effect: 'burst' | 'persistent';
  radius: number;
  damage: number;
  durationMs: number;
  tickIntervalMs: number;
  disableMs?: number;
}

export interface InstallationDefinition extends BaseCardDefinition {
  id: InstallationKind;
  category: 'installation';
  maxHp: number;
  lifetimeMs: number;
  radius: number;
  damage: number;
  attackInterval: number;
  range: number;
  spawnIntervalMs?: number;
  activationDelayMs: number;
  projectile?: ProjectileKind;
}

export type CardDefinition = RobotDefinition | ProgramDefinition | InstallationDefinition;

export interface UnitState {
  id: string;
  kind: RobotKind;
  team: Team;
  lane: Lane;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  radius: number;
  facing: number;
  disabledMs: number;
  overdriveMs: number;
}

export interface InstallationState {
  id: string;
  kind: InstallationKind;
  team: Team;
  lane: Lane;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  cooldownMs: number;
  remainingMs: number;
  disabledMs: number;
}

export interface ProgramZoneState {
  id: string;
  kind: 'nano';
  team: Team;
  x: number;
  y: number;
  radius: number;
  remainingMs: number;
  tickAccumulatorMs: number;
}

export type TowerKind = 'relay' | 'core';

export interface TowerState {
  id: string;
  team: Team;
  kind: TowerKind;
  lane: Lane | 'core';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  damage: number;
  range: number;
  attackInterval: number;
  projectile: ProjectileKind;
  weapon: TowerWeaponId;
  splashRadius: number;
  splashMultiplier: number;
}

export interface RobotUpgradeState {
  output: UpgradeTier;
  range: UpgradeTier;
  speed: UpgradeTier;
}

export type RobotUpgradeBook = Record<Team, Record<RobotCardId, RobotUpgradeState>>;

export type CombatEntityType = 'unit' | 'installation' | 'tower';

export interface CombatEntityRef {
  id: string;
  entityType: CombatEntityType;
  team: Team;
  x: number;
  y: number;
  radius: number;
}

export interface CommanderAbilityState {
  deployed: boolean;
  available: boolean;
  active: boolean;
  cost: number;
  cooldownMs: number;
  remainingMs: number;
  disabled: boolean;
}

export interface MatchResult {
  winner: Team | 'draw';
  reason: 'core' | 'relay' | 'timer' | 'integrity';
  headline: string;
  detail: string;
}

export interface MatchSnapshot {
  phase: MatchPhase;
  modeId: GameModeId;
  decks: Record<Team, CardId[]>;
  remainingMs: number;
  chargeOverclock: boolean;
  charge: Record<Team, number>;
  score: Record<Team, number>;
  battleScore: Record<Team, number>;
  towers: TowerState[];
  units: UnitState[];
  installations: InstallationState[];
  zones: ProgramZoneState[];
  hands: Record<Team, CardId[]>;
  next: Record<Team, CardId>;
  selected: CardId | null;
  commander: Record<Team, CommanderAbilityState>;
  upgrades: RobotUpgradeBook;
  result: MatchResult | null;
  guidance: string | null;
  revision: number;
}

export type GameCommand =
  | { type: 'start'; config?: MatchConfig }
  | { type: 'restart' }
  | { type: 'returnToLobby' }
  | { type: 'togglePause' }
  | { type: 'select'; cardId: CardId | null }
  | { type: 'playCard'; team: Team; cardId: CardId; x: number; y: number }
  | { type: 'activateOverdrive'; team: Team }
  | { type: 'upgradeRobot'; team: Team; robotId: RobotCardId; stat: UpgradeStat };

export type GameEvent =
  | { type: 'cardPlayed'; team: Team; cardId: CardId; x: number; y: number }
  | { type: 'playRejected'; team: Team; reason: 'phase' | 'charge' | 'hand' | 'zone' | 'unique' | 'disabled' | 'cooldown' }
  | { type: 'programCast'; team: Team; kind: ProgramKind; x: number; y: number; radius: number }
  | { type: 'installationPlaced'; team: Team; kind: InstallationKind; x: number; y: number }
  | { type: 'overdriveActivated'; team: Team; x: number; y: number }
  | { type: 'robotUpgraded'; team: Team; robotId: RobotCardId; stat: UpgradeStat; tier: 1 | 2; cost: number }
  | { type: 'upgradeRejected'; team: Team; robotId: RobotCardId; stat: UpgradeStat; reason: 'phase' | 'charge' | 'maxTier' }
  | {
      type: 'projectileFired';
      attackId: number;
      projectile: ProjectileKind;
      source: CombatEntityRef;
      target: CombatEntityRef;
      amount: number;
      splashRadius?: number;
    }
  | {
      type: 'entityDestroyed';
      entity: CombatEntityRef;
      cause: 'projectile' | 'program' | 'decay';
      byTeam?: Team;
      attackId?: number;
    }
  | { type: 'impact'; x: number; y: number; team: Team; amount: number }
  | { type: 'towerDestroyed'; tower: TowerState }
  | { type: 'matchEnded'; result: MatchResult };
