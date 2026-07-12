import type { MatchPhase, RobotKind, Team } from '../core/types';

export const ARENA_UNIT_ATLAS_KEY = 'arena-robot-move-sprites';
export const ARENA_UNIT_ATLAS_COLUMNS = 6;
export const ARENA_UNIT_ATLAS_ROWS = 9;
export const ARENA_UNIT_ATLAS_FRAME_SIZE = 170;
export const ARENA_UNIT_ATLAS_FRAME_COUNT = ARENA_UNIT_ATLAS_COLUMNS * ARENA_UNIT_ATLAS_ROWS;

export const UNIT_MOVEMENT_GRACE_MS = 130;
export const UNIT_MOVEMENT_EPSILON = 0.01;
export const UNIT_DIRECTION_HYSTERESIS = 0.18;
export const UNIT_FLIP_HYSTERESIS = 0.16;

export type ArenaUnitDirection = 'away' | 'toward';
export type ArenaUnitGaitFrame = 0 | 1;
export type ArenaUnitPoseState = 'moving' | 'idle' | 'paused' | 'disabled' | 'dead';

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
  'microbot',
] as const;

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
  microbot: 1,
};

/**
 * Columns 2 and 5 contain less stable transition renders and are deliberately
 * excluded. Each direction alternates only between its two production frames.
 */
export const ARENA_UNIT_DIRECTION_COLUMNS: Readonly<
  Record<ArenaUnitDirection, readonly [number, number]>
> = {
  away: [0, 1],
  toward: [3, 4],
};

/** Frames per second for the two-frame gait. Faster chassis cycle more often. */
export const ARENA_UNIT_GAIT_FPS: Readonly<Record<RobotKind, number>> = {
  zip: 10,
  swarm: 11,
  brute: 5,
  rail: 6,
  pulse: 8,
  arc: 7,
  drone: 9,
  patch: 7,
  vector: 7,
  microbot: 11,
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
  microbot: 0.82,
};

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
): readonly [number, number] {
  return [
    getArenaUnitFrame(kind, direction, 0),
    getArenaUnitFrame(kind, direction, 1),
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
 * Spreads same-kind units across the two-frame gait without introducing random
 * presentation state. The offset is stable for a unit ID and bounded to one
 * complete gait cycle.
 */
export function getArenaUnitGaitPhaseOffsetMs(kind: RobotKind, unitId: string): number {
  const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS[kind];
  const cycleDurationMs = frameDurationMs * 2;
  return (hashUnitId(unitId) / 0x1_0000_0000) * cycleDurationMs;
}

export function getArenaUnitGaitFrame(
  kind: RobotKind,
  nowMs: number,
  phaseOffsetMs = 0,
): ArenaUnitGaitFrame {
  const safeNowMs = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const safePhaseOffsetMs = Number.isFinite(phaseOffsetMs) ? Math.max(0, phaseOffsetMs) : 0;
  const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS[kind];
  return (Math.floor((safeNowMs + safePhaseOffsetMs) / frameDurationMs) % 2) as ArenaUnitGaitFrame;
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
}

export interface ResolvedUnitPose {
  state: ArenaUnitPoseState;
  direction: ArenaUnitDirection;
  gaitFrame: ArenaUnitGaitFrame;
  frame: number;
  movingUntilMs: number;
  gaitFps: number;
  bodyHeightRatio: number;
}

/**
 * Resolves presentation state only. It never mutates UnitState and uses a short
 * grace window so a 20 Hz engine snapshot does not flicker the gait at 60 Hz.
 */
export function resolveUnitPose(input: ResolveUnitPoseInput): ResolvedUnitPose {
  const fallbackDirection = input.previousDirection ?? getInitialArenaUnitDirection(input.team);
  const direction = selectArenaUnitDirection(input.facing, fallbackDirection);
  const moved = hasArenaUnitMoved(input.x, input.y, input.previousX, input.previousY);
  const movingUntilMs = moved
    ? input.nowMs + UNIT_MOVEMENT_GRACE_MS
    : input.movingUntilMs;
  const withinMovementGrace = input.nowMs < movingUntilMs;

  let state: ArenaUnitPoseState;
  if (input.hp <= 0) state = 'dead';
  else if (input.disabledMs > 0) state = 'disabled';
  else if (input.phase === 'paused') state = 'paused';
  else if (input.phase === 'playing' && withinMovementGrace) state = 'moving';
  else state = 'idle';

  const gaitFrame: ArenaUnitGaitFrame = state === 'moving'
    ? getArenaUnitGaitFrame(
      input.kind,
      input.nowMs,
      getArenaUnitGaitPhaseOffsetMs(input.kind, input.unitId),
    )
    : 0;

  return {
    state,
    direction,
    gaitFrame,
    frame: getArenaUnitFrame(input.kind, direction, gaitFrame),
    movingUntilMs,
    gaitFps: ARENA_UNIT_GAIT_FPS[input.kind],
    bodyHeightRatio: ARENA_UNIT_BODY_HEIGHT_RATIO[input.kind],
  };
}
