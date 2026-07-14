import type { MatchPhase, RobotKind, Team } from '../core/types';

export const ARENA_UNIT_ATLAS_KEY = 'arena-robot-move-sprites';
export const ARENA_UNIT_ATLAS_COLUMNS = 6;
export const ARENA_UNIT_ATLAS_ROWS = 9;
export const ARENA_UNIT_ATLAS_FRAME_SIZE = 170;
export const ARENA_UNIT_ATLAS_FRAME_COUNT = ARENA_UNIT_ATLAS_COLUMNS * ARENA_UNIT_ATLAS_ROWS;
export const VAULT_UNIT_ATLAS_KEY = 'vault-unit-sprites';
export const VAULT_UNIT_ATLAS_FRAME_WIDTH = 256;
export const VAULT_UNIT_ATLAS_FRAME_HEIGHT = 341;
export const VAULT_UNIT_ATLAS_FRAME_COUNT = 18;

export const UNIT_MOVEMENT_GRACE_MS = 130;
export const UNIT_MOVEMENT_EPSILON = 0.01;
export const UNIT_DIRECTION_HYSTERESIS = 0.18;
export const UNIT_FLIP_HYSTERESIS = 0.16;

export type ArenaUnitDirection = 'away' | 'toward';
export type ArenaUnitGaitFrame = 0 | 1 | 2;
export type ArenaUnitPoseState = 'moving' | 'settling' | 'idle' | 'paused' | 'disabled' | 'dead';

export interface ArenaUnitFrameOffset {
  x: number;
  y: number;
}

export const ARENA_UNIT_GAIT_FRAME_COUNT = 3;

/**
 * The third render bridges the two key poses in both directions so the loop
 * does not snap directly from one extreme to the other.
 */
export const ARENA_UNIT_GAIT_SEQUENCE: readonly ArenaUnitGaitFrame[] = [0, 2, 1, 2];

export const ARENA_UNIT_KINDS: readonly RobotKind[] = [
  'zip',
  'swarm',
  'brute',
  'rail',
  'pulse',
  'arc',
  'drone',
  'patch',
  'vector',
  'aegis',
  'wraith',
  'viper',
  'microbot',
] as const;

export const VAULT_UNIT_KINDS = ['aegis', 'wraith', 'viper'] as const;

export function getArenaUnitTextureKey(kind: RobotKind): string {
  return (VAULT_UNIT_KINDS as readonly RobotKind[]).includes(kind)
    ? VAULT_UNIT_ATLAS_KEY
    : ARENA_UNIT_ATLAS_KEY;
}

/**
 * The arena atlas has one row per deck robot. Foundry Microbots intentionally
 * reuse the Swarm row because they are rendered as the same chassis family.
 */
export const ARENA_UNIT_ATLAS_ROW: Readonly<Record<RobotKind, number>> = {
  zip: 0,
  swarm: 1,
  brute: 2,
  rail: 3,
  pulse: 4,
  arc: 5,
  drone: 6,
  patch: 7,
  vector: 8,
  aegis: 0,
  wraith: 1,
  viper: 2,
  microbot: 1,
};

/** Two key poses plus one transition render are available for each direction. */
export const ARENA_UNIT_DIRECTION_COLUMNS: Readonly<
  Record<ArenaUnitDirection, readonly [number, number, number]>
> = {
  away: [0, 1, 2],
  toward: [3, 4, 5],
};

/**
 * Displayed frames per second for the four-step gait. The rates preserve the
 * original full-cycle cadence after adding the two transition steps.
 */
export const ARENA_UNIT_GAIT_FPS: Readonly<Record<RobotKind, number>> = {
  zip: 20,
  swarm: 22,
  brute: 10,
  rail: 12,
  pulse: 16,
  arc: 14,
  drone: 18,
  patch: 14,
  vector: 14,
  aegis: 10,
  wraith: 20,
  viper: 18,
  microbot: 22,
};

/**
 * Fraction of displayed sprite height between the arena contact point and the
 * visual body center. BattleScene can use this to lift projectile and explosion
 * origins above the ground coordinate without changing simulation positions.
 */
export const ARENA_UNIT_BODY_HEIGHT_RATIO: Readonly<Record<RobotKind, number>> = {
  zip: 0.3,
  swarm: 0.25,
  brute: 0.32,
  rail: 0.27,
  pulse: 0.33,
  arc: 0.3,
  drone: 0.24,
  patch: 0.27,
  vector: 0.36,
  aegis: 0.36,
  wraith: 0.24,
  viper: 0.23,
  microbot: 0.25,
};

/** Vertical foreshortening used to match the arena board's compressed projection. */
export const ARENA_UNIT_DISPLAY_HEIGHT_RATIO: Readonly<Record<RobotKind, number>> = {
  zip: 0.82,
  swarm: 0.82,
  brute: 0.9,
  rail: 0.82,
  pulse: 0.9,
  arc: 0.84,
  drone: 0.82,
  patch: 0.9,
  vector: 0.9,
  aegis: 0.9,
  wraith: 0.82,
  viper: 0.82,
  microbot: 0.82,
};

type ArenaUnitFrameOffsets = Readonly<Record<
  ArenaUnitDirection,
  readonly [ArenaUnitFrameOffset, ArenaUnitFrameOffset, ArenaUnitFrameOffset]
>>;

const COMMON_ARENA_UNIT_FRAME_OFFSETS: ArenaUnitFrameOffsets = {
  away: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }],
  toward: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }],
};

/**
 * Source-pixel registration corrections for atlas rows whose generated poses
 * do not share a stable chassis center or ground contact. Keeping these as
 * render offsets avoids duplicating texture frames or increasing draw calls.
 */
const ARENA_UNIT_FRAME_OFFSET_OVERRIDES: Partial<
  Readonly<Record<RobotKind, ArenaUnitFrameOffsets>>
> = {
  zip: {
    away: COMMON_ARENA_UNIT_FRAME_OFFSETS.away,
    toward: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 0 }],
  },
  swarm: {
    away: COMMON_ARENA_UNIT_FRAME_OFFSETS.away,
    toward: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 0 }],
  },
  aegis: {
    away: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 36, y: 6 }],
    toward: [{ x: 0, y: 0 }, { x: 17, y: 5 }, { x: 23, y: -1 }],
  },
  wraith: {
    away: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 43, y: 0 }],
    toward: [{ x: 0, y: 0 }, { x: 17, y: 0 }, { x: 23, y: 0 }],
  },
  viper: {
    away: [{ x: 0, y: 0 }, { x: 16, y: -6 }, { x: 39, y: -10 }],
    toward: [{ x: 0, y: 0 }, { x: 13, y: -5 }, { x: 32, y: -5 }],
  },
};

export function getArenaUnitFrameOffset(
  kind: RobotKind,
  direction: ArenaUnitDirection,
  gaitFrame: ArenaUnitGaitFrame,
  displayWidth: number,
  displayHeight: number,
  flipped = false,
): ArenaUnitFrameOffset {
  const sourceOffset = (
    ARENA_UNIT_FRAME_OFFSET_OVERRIDES[kind] ?? COMMON_ARENA_UNIT_FRAME_OFFSETS
  )[direction][gaitFrame];
  const sourceWidth = (VAULT_UNIT_KINDS as readonly RobotKind[]).includes(kind)
    ? VAULT_UNIT_ATLAS_FRAME_WIDTH
    : ARENA_UNIT_ATLAS_FRAME_SIZE;
  const sourceHeight = (VAULT_UNIT_KINDS as readonly RobotKind[]).includes(kind)
    ? VAULT_UNIT_ATLAS_FRAME_HEIGHT
    : ARENA_UNIT_ATLAS_FRAME_SIZE;
  const safeDisplayWidth = Number.isFinite(displayWidth) ? Math.abs(displayWidth) : 0;
  const safeDisplayHeight = Number.isFinite(displayHeight) ? Math.abs(displayHeight) : 0;
  const x = sourceOffset.x * safeDisplayWidth / sourceWidth;

  return {
    x: flipped ? -x : x,
    y: sourceOffset.y * safeDisplayHeight / sourceHeight,
  };
}

export function getInitialArenaUnitDirection(team: Team): ArenaUnitDirection {
  return team === 'player' ? 'away' : 'toward';
}

export function selectArenaUnitDirection(
  facing: number,
  previousDirection: ArenaUnitDirection,
): ArenaUnitDirection {
  if (!Number.isFinite(facing)) return previousDirection;

  const verticalDirection = Math.sin(facing);
  if (verticalDirection <= -UNIT_DIRECTION_HYSTERESIS) return 'away';
  if (verticalDirection >= UNIT_DIRECTION_HYSTERESIS) return 'toward';
  return previousDirection;
}

export function selectArenaUnitFlipX(facing: number, previousFlipX: boolean): boolean {
  if (!Number.isFinite(facing)) return previousFlipX;
  const horizontalDirection = Math.cos(facing);
  if (horizontalDirection <= -UNIT_FLIP_HYSTERESIS) return true;
  if (horizontalDirection >= UNIT_FLIP_HYSTERESIS) return false;
  return previousFlipX;
}

export function getArenaUnitFrame(
  kind: RobotKind,
  direction: ArenaUnitDirection,
  gaitFrame: ArenaUnitGaitFrame,
): number {
  const row = ARENA_UNIT_ATLAS_ROW[kind];
  const column = ARENA_UNIT_DIRECTION_COLUMNS[direction][gaitFrame];
  return row * ARENA_UNIT_ATLAS_COLUMNS + column;
}

export function getArenaUnitFrames(
  kind: RobotKind,
  direction: ArenaUnitDirection,
): readonly [number, number, number] {
  return [
    getArenaUnitFrame(kind, direction, 0),
    getArenaUnitFrame(kind, direction, 1),
    getArenaUnitFrame(kind, direction, 2),
  ];
}

function hashUnitId(unitId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < unitId.length; index += 1) {
    hash ^= unitId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // Avalanche the FNV result so sequential IDs do not cluster in one half of
  // the gait cycle when normalized to a floating-point phase.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Staggers same-kind units by less than one displayed frame without introducing
 * random presentation state or changing their configured gait cadence.
 */
export function getArenaUnitGaitStartDelayMs(kind: RobotKind, unitId: string): number {
  const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS[kind];
  return (hashUnitId(unitId) / 0x1_0000_0000) * frameDurationMs;
}

function getArenaUnitGaitCycleDurationMs(kind: RobotKind): number {
  return (1_000 / ARENA_UNIT_GAIT_FPS[kind]) * ARENA_UNIT_GAIT_SEQUENCE.length;
}

export function getArenaUnitGaitPhase(
  kind: RobotKind,
  nowMs: number,
  phaseOffsetMs = 0,
): number {
  const safeNowMs = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const safePhaseOffsetMs = Number.isFinite(phaseOffsetMs) ? Math.max(0, phaseOffsetMs) : 0;
  const cycleDurationMs = getArenaUnitGaitCycleDurationMs(kind);
  return ((safeNowMs + safePhaseOffsetMs) % cycleDurationMs) / cycleDurationMs;
}

export function getArenaUnitGaitFrame(
  kind: RobotKind,
  nowMs: number,
  phaseOffsetMs = 0,
): ArenaUnitGaitFrame {
  const gaitStep = Math.floor(
    getArenaUnitGaitPhase(kind, nowMs, phaseOffsetMs) * ARENA_UNIT_GAIT_SEQUENCE.length,
  );
  return ARENA_UNIT_GAIT_SEQUENCE[gaitStep] ?? 0;
}

export function getArenaUnitBodyOriginY(
  kind: RobotKind,
  groundY: number,
  displayHeight: number,
): number {
  const safeDisplayHeight = Number.isFinite(displayHeight) ? Math.abs(displayHeight) : 0;
  return groundY - safeDisplayHeight * ARENA_UNIT_BODY_HEIGHT_RATIO[kind];
}

export function hasArenaUnitMoved(
  x: number,
  y: number,
  previousX: number,
  previousY: number,
): boolean {
  const dx = x - previousX;
  const dy = y - previousY;
  return dx * dx + dy * dy > UNIT_MOVEMENT_EPSILON * UNIT_MOVEMENT_EPSILON;
}

export interface ResolveUnitPoseInput {
  unitId: string;
  kind: RobotKind;
  team: Team;
  facing: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  previousDirection?: ArenaUnitDirection;
  movingUntilMs: number;
  nowMs: number;
  phase: MatchPhase;
  hp: number;
  disabledMs: number;
  previousState?: ArenaUnitPoseState;
  gaitStartedAtMs?: number;
  gaitStopsAtMs?: number;
}

export interface ResolvedUnitPose {
  state: ArenaUnitPoseState;
  direction: ArenaUnitDirection;
  gaitFrame: ArenaUnitGaitFrame;
  gaitPhase: number;
  frame: number;
  movingUntilMs: number;
  gaitStartedAtMs: number;
  gaitStopsAtMs: number;
  gaitFps: number;
  bodyHeightRatio: number;
}

/**
 * Resolves presentation state only. It never mutates UnitState and uses a short
 * grace window so a 20 Hz engine snapshot does not flicker the gait at 60 Hz.
 */
export function resolveUnitPose(input: ResolveUnitPoseInput): ResolvedUnitPose {
  const fallbackDirection = input.previousDirection ?? getInitialArenaUnitDirection(input.team);
  const moved = hasArenaUnitMoved(input.x, input.y, input.previousX, input.previousY);
  // Combat targeting also updates `facing`, including while a unit is standing
  // still. Front/back gait artwork should follow actual travel so a deployed
  // player bot keeps looking upfield unless it physically retreats downfield.
  const movementFacing = moved
    ? Math.atan2(input.y - input.previousY, input.x - input.previousX)
    : Number.NaN;
  const direction = selectArenaUnitDirection(movementFacing, fallbackDirection);
  const movingUntilMs = moved
    ? input.nowMs + UNIT_MOVEMENT_GRACE_MS
    : input.movingUntilMs;
  const withinMovementGrace = input.nowMs < movingUntilMs;

  const continuingGait = input.previousState === 'moving' || input.previousState === 'settling';
  const previousGaitStartedAtMs = Number.isFinite(input.gaitStartedAtMs)
    ? Math.min(input.gaitStartedAtMs ?? input.nowMs, input.nowMs)
    : input.nowMs;
  const gaitStartedAtMs = input.phase === 'playing' && withinMovementGrace && !continuingGait
    ? input.nowMs
    : previousGaitStartedAtMs;
  const gaitElapsedMs = Math.max(0, input.nowMs - gaitStartedAtMs);
  const gaitTimeMs = Math.max(
    0,
    gaitElapsedMs - getArenaUnitGaitStartDelayMs(input.kind, input.unitId),
  );
  const cycleDurationMs = getArenaUnitGaitCycleDurationMs(input.kind);
  const currentGaitPhase = getArenaUnitGaitPhase(input.kind, gaitTimeMs);
  const previousGaitStopsAtMs = Number.isFinite(input.gaitStopsAtMs)
    ? Math.max(0, input.gaitStopsAtMs ?? 0)
    : 0;

  let state: ArenaUnitPoseState;
  let gaitStopsAtMs = previousGaitStopsAtMs;
  if (input.hp <= 0) state = 'dead';
  else if (input.disabledMs > 0) state = 'disabled';
  else if (input.phase === 'paused') state = 'paused';
  else if (input.phase === 'playing' && withinMovementGrace) {
    state = 'moving';
    gaitStopsAtMs = 0;
  } else if (
    input.phase === 'playing' &&
    input.previousState === 'settling' &&
    input.nowMs < previousGaitStopsAtMs
  ) {
    state = 'settling';
  } else if (
    input.phase === 'playing' &&
    input.previousState === 'moving' &&
    currentGaitPhase > Number.EPSILON
  ) {
    state = 'settling';
    gaitStopsAtMs = input.nowMs + (1 - currentGaitPhase) * cycleDurationMs;
  } else {
    state = 'idle';
    gaitStopsAtMs = 0;
  }

  const gaitActive = state === 'moving' || state === 'settling';
  const gaitFrame: ArenaUnitGaitFrame = gaitActive
    ? getArenaUnitGaitFrame(input.kind, gaitTimeMs)
    : 0;
  const gaitPhase = gaitActive
    ? currentGaitPhase
    : 0;

  return {
    state,
    direction,
    gaitFrame,
    gaitPhase,
    frame: getArenaUnitFrame(input.kind, direction, gaitFrame),
    movingUntilMs,
    gaitStartedAtMs,
    gaitStopsAtMs,
    gaitFps: ARENA_UNIT_GAIT_FPS[input.kind],
    bodyHeightRatio: ARENA_UNIT_BODY_HEIGHT_RATIO[input.kind],
  };
}
