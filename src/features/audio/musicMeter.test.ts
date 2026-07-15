import { describe, expect, it } from 'vitest';
import { getMusicOutputLevel, MUSIC_WAVEFORM_BARS } from './musicMeter';

describe('music waveform presentation', () => {
  it('tracks audible playback rather than merely loaded music', () => {
    expect(getMusicOutputLevel(true, false, 0.62)).toBe(0.62);
    expect(getMusicOutputLevel(false, false, 0.62)).toBe(0);
    expect(getMusicOutputLevel(true, true, 0.62)).toBe(0);
  });

  it('clamps invalid levels and provides a varied meter profile', () => {
    expect(getMusicOutputLevel(true, false, 3)).toBe(1);
    expect(getMusicOutputLevel(true, false, -2)).toBe(0);
    expect(getMusicOutputLevel(true, false, Number.NaN)).toBe(0);
    expect(new Set(MUSIC_WAVEFORM_BARS).size).toBeGreaterThan(6);
  });
});
