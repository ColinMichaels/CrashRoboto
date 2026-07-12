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
  ARENA_UNIT_GAIT_FPS,
  ARENA_UNIT_KINDS,
  UNIT_MOVEMENT_GRACE_MS,
  getArenaUnitBodyOriginY,
  getArenaUnitFrame,
  getArenaUnitFrames,
  getArenaUnitGaitFrame,
  getArenaUnitGaitPhaseOffsetMs,
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
};

describe('unit presentation', () => {
  it('maps every robot and direction to the two safe atlas columns', () => {
    expect(ARENA_UNIT_ATLAS_FRAME_SIZE).toBe(170);
    expect(ARENA_UNIT_DIRECTION_COLUMNS.away).toEqual([0, 1]);
    expect(ARENA_UNIT_DIRECTION_COLUMNS.toward).toEqual([3, 4]);

    for (const kind of ARENA_UNIT_KINDS) {
      for (const direction of ['away', 'toward'] as const) {
        const frames = getArenaUnitFrames(kind, direction);
        expect(frames).toEqual([
          getArenaUnitFrame(kind, direction, 0),
          getArenaUnitFrame(kind, direction, 1),
        ]);
        for (const frame of frames) {
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(ARENA_UNIT_ATLAS_FRAME_COUNT);
          expect(frame % ARENA_UNIT_ATLAS_COLUMNS).toBeOneOf(
            direction === 'away' ? [0, 1] : [3, 4],
          );
        }
      }
    }

    expect(getArenaUnitFrames('zip', 'away')).toEqual([0, 1]);
    expect(getArenaUnitFrames('zip', 'toward')).toEqual([3, 4]);
    expect(getArenaUnitFrames('vector', 'away')).toEqual([48, 49]);
    expect(getArenaUnitFrames('vector', 'toward')).toEqual([51, 52]);
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

  it('keeps movement active across snapshot gaps and expires at the grace boundary', () => {
    const movedAt100 = resolveUnitPose({
      ...basePoseInput,
      x: 501,
      nowMs: 100,
    });
    expect(movedAt100.state).toBe('moving');
    expect(movedAt100.movingUntilMs).toBe(100 + UNIT_MOVEMENT_GRACE_MS);

    const stillMoving = resolveUnitPose({
      ...basePoseInput,
      nowMs: movedAt100.movingUntilMs - 1,
      movingUntilMs: movedAt100.movingUntilMs,
    });
    expect(stillMoving.state).toBe('moving');

    const stopped = resolveUnitPose({
      ...basePoseInput,
      nowMs: movedAt100.movingUntilMs,
      movingUntilMs: movedAt100.movingUntilMs,
    });
    expect(stopped.state).toBe('idle');
    expect(stopped.gaitFrame).toBe(0);
  });

  it('alternates between the two safe frames at each robot gait speed', () => {
    for (const kind of ARENA_UNIT_KINDS) {
      const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS[kind];
      expect(getArenaUnitGaitFrame(kind, 0)).toBe(0);
      expect(getArenaUnitGaitFrame(kind, frameDurationMs + 0.001)).toBe(1);
      expect(getArenaUnitGaitFrame(kind, frameDurationMs * 2 + 0.001)).toBe(0);

      const resolved = resolveUnitPose({
        ...basePoseInput,
        kind,
        x: basePoseInput.x + 1,
        nowMs: frameDurationMs + 0.001,
      });
      const expectedGaitFrame = getArenaUnitGaitFrame(
        kind,
        frameDurationMs + 0.001,
        getArenaUnitGaitPhaseOffsetMs(kind, basePoseInput.unitId),
      );
      expect(resolved.gaitFrame).toBe(expectedGaitFrame);
      expect(resolved.frame).toBe(getArenaUnitFrame(kind, 'away', expectedGaitFrame));
    }
  });

  it('uses stable unit-ID phase offsets so same-kind units do not all move in lockstep', () => {
    const unitIds = Array.from({ length: 8 }, (_, index) => `player-zip-${index + 1}`);
    const frameDurationMs = 1_000 / ARENA_UNIT_GAIT_FPS.zip;
    const cycleDurationMs = frameDurationMs * 2;

    for (const unitId of unitIds) {
      const offset = getArenaUnitGaitPhaseOffsetMs('zip', unitId);
      expect(offset).toBe(getArenaUnitGaitPhaseOffsetMs('zip', unitId));
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(cycleDurationMs);
    }

    const frames = unitIds.map((unitId) => resolveUnitPose({
      ...basePoseInput,
      unitId,
      x: basePoseInput.x + 1,
      nowMs: 0,
    }).gaitFrame);
    expect(new Set(frames)).toEqual(new Set([0, 1]));
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
