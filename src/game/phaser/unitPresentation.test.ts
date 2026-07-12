import { describe, expect, it } from 'vitest';
import type { RobotKind } from '../core/types';
import {
  ARENA_UNIT_ATLAS_COLUMNS,
  ARENA_UNIT_ATLAS_FRAME_COUNT,
  ARENA_UNIT_ATLAS_FRAME_SIZE,
  ARENA_UNIT_ATLAS_ROW,
  ARENA_UNIT_BODY_HEIGHT_RATIO,
  ARENA_UNIT_DISPLAY_HEIGHT_RATIO,
  ARENA_UNIT_DIRECTION_COLUMNS,
  ARENA_UNIT_GAIT_FRAME_COUNT,
  ARENA_UNIT_GAIT_FPS,
  ARENA_UNIT_GAIT_SEQUENCE,
  ARENA_UNIT_KINDS,
  VAULT_UNIT_ATLAS_FRAME_COUNT,
  VAULT_UNIT_ATLAS_FRAME_HEIGHT,
  VAULT_UNIT_ATLAS_FRAME_WIDTH,
  VAULT_UNIT_ATLAS_KEY,
  UNIT_MOVEMENT_GRACE_MS,
  getArenaUnitBodyOriginY,
  getArenaUnitFrame,
  getArenaUnitFrames,
  getArenaUnitGaitFrame,
  getArenaUnitGaitPhase,
  getArenaUnitGaitStartDelayMs,
  getArenaUnitTextureKey,
  resolveUnitPose,
  selectArenaUnitDirection,
  selectArenaUnitFlipX,
  type ResolveUnitPoseInput,
} from './unitPresentation';

const basePoseInput: ResolveUnitPoseInput = {
  unitId: 'player-zip-1',
  kind: 'zip',
  team: 'player',
  facing: -Math.PI / 2,
  x: 500,
  y: 500,
  previousX: 500,
  previousY: 500,
  previousDirection: 'away',
  movingUntilMs: 0,
  nowMs: 1_000,
  phase: 'playing',
  hp: 100,
  disabledMs: 0,
  previousState: 'idle',
  gaitStartedAtMs: 0,
  gaitStopsAtMs: 0,
};

describe('unit presentation', () => {
  it('maps every robot and direction to two key poses plus a transition frame', () => {
    expect(ARENA_UNIT_ATLAS_FRAME_SIZE).toBe(170);
    expect(VAULT_UNIT_ATLAS_FRAME_WIDTH).toBe(256);
    expect(VAULT_UNIT_ATLAS_FRAME_HEIGHT).toBe(341);
    expect(VAULT_UNIT_ATLAS_FRAME_COUNT).toBe(18);
    expect(ARENA_UNIT_GAIT_FRAME_COUNT).toBe(3);
    expect(ARENA_UNIT_GAIT_SEQUENCE).toEqual([0, 2, 1, 2]);
    expect(new Set(ARENA_UNIT_GAIT_SEQUENCE).size).toBe(ARENA_UNIT_GAIT_FRAME_COUNT);
    expect(ARENA_UNIT_DIRECTION_COLUMNS.away).toEqual([0, 1, 2]);
    expect(ARENA_UNIT_DIRECTION_COLUMNS.toward).toEqual([3, 4, 5]);

    for (const kind of ARENA_UNIT_KINDS) {
      for (const direction of ['away', 'toward'] as const) {
        const frames = getArenaUnitFrames(kind, direction);
        expect(frames).toEqual([
          getArenaUnitFrame(kind, direction, 0),
          getArenaUnitFrame(kind, direction, 1),
          getArenaUnitFrame(kind, direction, 2),
        ]);
        for (const frame of frames) {
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(ARENA_UNIT_ATLAS_FRAME_COUNT);
          expect(frame % ARENA_UNIT_ATLAS_COLUMNS).toBeOneOf(
            direction === 'away' ? [0, 1, 2] : [3, 4, 5],
          );
        }
      }
    }

    expect(getArenaUnitFrames('zip', 'away')).toEqual([0, 1, 2]);
    expect(getArenaUnitFrames('zip', 'toward')).toEqual([3, 4, 5]);
    expect(getArenaUnitFrames('vector', 'away')).toEqual([48, 49, 50]);
    expect(getArenaUnitFrames('vector', 'toward')).toEqual([51, 52, 53]);
    expect(getArenaUnitFrames('aegis', 'away')).toEqual([0, 1, 2]);
    expect(getArenaUnitFrames('wraith', 'toward')).toEqual([9, 10, 11]);
    expect(getArenaUnitFrames('viper', 'away')).toEqual([12, 13, 14]);
    expect(getArenaUnitTextureKey('aegis')).toBe(VAULT_UNIT_ATLAS_KEY);
    expect(getArenaUnitTextureKey('wraith')).toBe(VAULT_UNIT_ATLAS_KEY);
    expect(getArenaUnitTextureKey('viper')).toBe(VAULT_UNIT_ATLAS_KEY);
    expect(getArenaUnitTextureKey('zip')).toBe('arena-robot-move-sprites');
    expect(getArenaUnitFrames('microbot', 'away')).toEqual(getArenaUnitFrames('swarm', 'away'));
    expect(ARENA_UNIT_ATLAS_ROW.microbot).toBe(ARENA_UNIT_ATLAS_ROW.swarm);
  });

  it('selects away for north, toward for south, and preserves direction near horizontal', () => {
    expect(selectArenaUnitDirection(-Math.PI / 2, 'toward')).toBe('away');
    expect(selectArenaUnitDirection(Math.PI / 2, 'away')).toBe('toward');
    expect(selectArenaUnitDirection(0, 'away')).toBe('away');
    expect(selectArenaUnitDirection(Math.PI, 'toward')).toBe('toward');
    expect(selectArenaUnitDirection(Number.NaN, 'away')).toBe('away');
  });

  it('mirrors lateral travel without flickering on near-vertical headings', () => {
    expect(selectArenaUnitFlipX(Math.PI, false)).toBe(true);
    expect(selectArenaUnitFlipX(0, true)).toBe(false);
    expect(selectArenaUnitFlipX(-Math.PI / 2, true)).toBe(true);
    expect(selectArenaUnitFlipX(Math.PI / 2, false)).toBe(false);
    expect(selectArenaUnitFlipX(Number.NaN, true)).toBe(true);
  });

  it('keeps movement active across snapshot gaps and finishes the gait after grace expires', () => {
    const movedAt100 = resolveUnitPose({
      ...basePoseInput,
      x: 501,
      nowMs: 100,
    });
    expect(movedAt100.state).toBe('moving');
    expect(movedAt100.movingUntilMs).toBe(100 + UNIT_MOVEMENT_GRACE_MS);
    expect(movedAt100.gaitStartedAtMs).toBe(100);
    expect(movedAt100.gaitFrame).toBe(0);
    expect(movedAt100.gaitPhase).toBe(0);

    const stillMoving = resolveUnitPose({
      ...basePoseInput,
      nowMs: movedAt100.movingUntilMs - 1,
      movingUntilMs: movedAt100.movingUntilMs,
      previousState: movedAt100.state,
      gaitStartedAtMs: movedAt100.gaitStartedAtMs,
    });
    expect(stillMoving.state).toBe('moving');

    const settling = resolveUnitPose({
      ...basePoseInput,
      nowMs: movedAt100.movingUntilMs,
      movingUntilMs: movedAt100.movingUntilMs,
      previousState: stillMoving.state,
      gaitStartedAtMs: stillMoving.gaitStartedAtMs,
      gaitStopsAtMs: stillMoving.gaitStopsAtMs,
    });
    expect(settling.state).toBe('settling');
    expect(settling.gaitStopsAtMs).toBeGreaterThan(movedAt100.movingUntilMs);

    const stopped = resolveUnitPose({
      ...basePoseInput,
      nowMs: settling.gaitStopsAtMs + 0.001,
      movingUntilMs: movedAt100.movingUntilMs,
      previousState: settling.state,
      gaitStartedAtMs: settling.gaitStartedAtMs,
      gaitStopsAtMs: settling.gaitStopsAtMs,
    });
    expect(stopped.state).toBe('idle');
    expect(stopped.gaitFrame).toBe(0);
    expect(stopped.gaitPhase).toBe(0);
  });

  it('places the transition frame between both key poses at each robot gait speed', () => {
    for (const kind of ARENA_UNIT_KINDS) {
      const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS[kind];
      expect(getArenaUnitGaitFrame(kind, 0)).toBe(0);
      expect(getArenaUnitGaitFrame(kind, frameDurationMs + 0.001)).toBe(2);
      expect(getArenaUnitGaitFrame(kind, frameDurationMs * 2 + 0.001)).toBe(1);
      expect(getArenaUnitGaitFrame(kind, frameDurationMs * 3 + 0.001)).toBe(2);
      expect(getArenaUnitGaitFrame(kind, frameDurationMs * 4 + 0.001)).toBe(0);

      expect(getArenaUnitGaitPhase(kind, 0)).toBe(0);
      expect(getArenaUnitGaitPhase(kind, frameDurationMs * 2)).toBeCloseTo(0.5);
      expect(getArenaUnitGaitPhase(kind, frameDurationMs * 4)).toBeCloseTo(0);

      const cycleDurationMs = frameDurationMs * ARENA_UNIT_GAIT_SEQUENCE.length;
      const nowMs = cycleDurationMs + frameDurationMs + 0.001;
      const resolved = resolveUnitPose({
        ...basePoseInput,
        kind,
        previousState: 'moving',
        gaitStartedAtMs: 0,
        movingUntilMs: nowMs + UNIT_MOVEMENT_GRACE_MS,
        nowMs,
      });
      const expectedGaitFrame = getArenaUnitGaitFrame(
        kind,
        nowMs - getArenaUnitGaitStartDelayMs(kind, basePoseInput.unitId),
      );
      expect(resolved.gaitFrame).toBe(expectedGaitFrame);
      expect(resolved.frame).toBe(getArenaUnitFrame(kind, 'away', expectedGaitFrame));
    }
  });

  it('uses stable sub-frame start delays so same-kind units do not all move in lockstep', () => {
    const unitIds = Array.from({ length: 8 }, (_, index) => `player-zip-${index + 1}`);
    const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS.zip;
    const cycleDurationMs = frameDurationMs * ARENA_UNIT_GAIT_SEQUENCE.length;
    const delays = unitIds.map((unitId) => getArenaUnitGaitStartDelayMs('zip', unitId));

    for (const [index, unitId] of unitIds.entries()) {
      const delay = delays[index];
      expect(delay).toBe(getArenaUnitGaitStartDelayMs('zip', unitId));
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(frameDurationMs);
    }
    expect(new Set(delays).size).toBe(unitIds.length);

    const nowMs = cycleDurationMs + frameDurationMs / 2;
    const frames = unitIds.map((unitId) => resolveUnitPose({
      ...basePoseInput,
      unitId,
      previousState: 'moving',
      gaitStartedAtMs: 0,
      movingUntilMs: nowMs + UNIT_MOVEMENT_GRACE_MS,
      nowMs,
    }).gaitFrame);
    expect(new Set(frames).size).toBeGreaterThan(1);
  });

  it('lifts unit effect origins from the ground coordinate to the rendered chassis body', () => {
    expect(getArenaUnitBodyOriginY('zip', 500, 100)).toBe(470);
    expect(getArenaUnitBodyOriginY('zip', 500, -100)).toBe(470);
    expect(getArenaUnitBodyOriginY('zip', 500, Number.NaN)).toBe(500);
    expect(getArenaUnitBodyOriginY('vector', 500, 100)).toBe(464);
  });

  it.each([
    ['paused', { phase: 'paused' as const }, 'paused'],
    ['disabled', { disabledMs: 500 }, 'disabled'],
    ['dead', { hp: 0 }, 'dead'],
    ['ended', { phase: 'ended' as const }, 'idle'],
  ])('freezes a %s unit on its idle frame', (_label, overrides, expectedState) => {
    const pose = resolveUnitPose({
      ...basePoseInput,
      ...overrides,
      x: basePoseInput.x + 1,
      movingUntilMs: basePoseInput.nowMs + UNIT_MOVEMENT_GRACE_MS,
    });
    expect(pose.state).toBe(expectedState);
    expect(pose.gaitFrame).toBe(0);
    expect(pose.gaitPhase).toBe(0);
    expect(pose.frame).toBe(getArenaUnitFrame('zip', 'away', 0));
  });

  it('defines sensible body-center height ratios for every chassis family', () => {
    for (const kind of ARENA_UNIT_KINDS) {
      expect(ARENA_UNIT_BODY_HEIGHT_RATIO[kind]).toBeGreaterThan(0);
      expect(ARENA_UNIT_BODY_HEIGHT_RATIO[kind]).toBeLessThan(0.5);
    }

    expect(ARENA_UNIT_BODY_HEIGHT_RATIO.vector).toBeGreaterThan(ARENA_UNIT_BODY_HEIGHT_RATIO.rail);
    expect(ARENA_UNIT_BODY_HEIGHT_RATIO.brute).toBeGreaterThan(ARENA_UNIT_BODY_HEIGHT_RATIO.swarm);
    expect(ARENA_UNIT_BODY_HEIGHT_RATIO.microbot).toBe(ARENA_UNIT_BODY_HEIGHT_RATIO.swarm);
  });

  it('keeps every RobotKind covered by gait and body-height metadata', () => {
    for (const kind of ARENA_UNIT_KINDS as readonly RobotKind[]) {
      expect(ARENA_UNIT_GAIT_FPS[kind]).toBeGreaterThan(0);
      expect(ARENA_UNIT_BODY_HEIGHT_RATIO[kind]).toBeDefined();
      expect(ARENA_UNIT_DISPLAY_HEIGHT_RATIO[kind]).toBeGreaterThanOrEqual(0.8);
      expect(ARENA_UNIT_DISPLAY_HEIGHT_RATIO[kind]).toBeLessThanOrEqual(0.92);
    }
  });
});
