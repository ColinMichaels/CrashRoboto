import { describe, expect, it } from 'vitest';
import {
  getArenaAmbientMotionSample,
  getArenaAmbientPresentation,
  getRouteChevronProgress,
  getStageTransitionPresentation,
  getTowerDamageBand,
} from './arenaEffects';

describe('arena effects presentation', () => {
  it('provides distinct lightweight ambience for every arena theme', () => {
    const themes = ['foundry', 'sewer', 'volcanic', 'orbital', 'alien'] as const;
    const presentations = themes.map(getArenaAmbientPresentation);

    expect(presentations.every((presentation) => presentation.points.length >= 6)).toBe(true);
    expect(new Set(presentations.map((presentation) => presentation.primary)).size).toBeGreaterThan(3);
    expect(getArenaAmbientPresentation('sewer').intensity).toBeLessThan(1);
  });

  it('keeps sewer flow effects inside open water and away from both bridge spans', () => {
    const bridgeSpans = [
      { left: 670, right: 765 },
      { left: 885, right: 975 },
    ];
    const flowPoints = getArenaAmbientPresentation('sewer').points.filter(
      (point) => point.kind === 'flow',
    );

    expect(flowPoints).toHaveLength(3);
    for (const point of flowPoints) {
      const left = point.x - point.radius;
      const right = point.x + point.radius;
      expect(bridgeSpans.every((bridge) => right < bridge.left || left > bridge.right)).toBe(true);
      expect(point.opacity).toBeLessThanOrEqual(0.72);
      expect(point.direction).toBe(1);
    }
  });

  it('moves ambient samples over time and freezes them for reduced motion', () => {
    const point = getArenaAmbientPresentation('sewer').points.find((candidate) => candidate.kind === 'flow');
    expect(point).toBeDefined();
    if (!point) return;

    const start = getArenaAmbientMotionSample(point, 0);
    const later = getArenaAmbientMotionSample(point, 600);
    const reducedStart = getArenaAmbientMotionSample(point, 0, false);
    const reducedLater = getArenaAmbientMotionSample(point, 600, false);

    expect(later.flowProgress).not.toBe(start.flowProgress);
    expect(later.pulse).not.toBe(start.pulse);
    expect(reducedLater).toEqual(reducedStart);
  });

  it('classifies tower damage at readable health thresholds', () => {
    expect(getTowerDamageBand(100, 100)).toBe('stable');
    expect(getTowerDamageBand(50, 100)).toBe('damaged');
    expect(getTowerDamageBand(25, 100)).toBe('critical');
    expect(getTowerDamageBand(0, 100)).toBe('destroyed');
    expect(getTowerDamageBand(10, 0)).toBe('destroyed');
  });

  it('maps match stages to concise visual announcements', () => {
    expect(getStageTransitionPresentation('opening').label).toBe('OPENING WINDOW');
    expect(getStageTransitionPresentation('relay-war').label).toBe('RELAY WAR');
    expect(getStageTransitionPresentation('core-surge').detail).toContain('×2');
  });

  it('spaces animated route chevrons across the route', () => {
    expect(getRouteChevronProgress(0, 0, 4)).toBe(0);
    expect(getRouteChevronProgress(0, 1, 4)).toBe(0.25);
    expect(getRouteChevronProgress(900, 0, 4)).toBe(0);
    expect(getRouteChevronProgress(Number.NaN, 0, 4)).toBe(0);
  });
});
