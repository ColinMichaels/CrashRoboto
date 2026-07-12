import { describe, expect, it } from 'vitest';
import { GAME_MODES, getMatchStage } from './content';

describe('match pacing', () => {
  it('moves from the opening window through Relay war into Core surge', () => {
    const mode = GAME_MODES['core-siege'];
    expect(getMatchStage(mode, mode.durationMs)).toBe('opening');
    expect(getMatchStage(mode, mode.durationMs - 15_000)).toBe('relay-war');
    expect(getMatchStage(mode, mode.overclockThresholdMs)).toBe('core-surge');
  });
});
