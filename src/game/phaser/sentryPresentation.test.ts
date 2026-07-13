import { describe, expect, it } from 'vitest';
import { getSentryDirectionFrame } from './sentryPresentation';

describe('Sentry presentation', () => {
  it.each([
    [0, 0],
    [Math.PI / 4, 1],
    [Math.PI / 2, 2],
    [(Math.PI * 3) / 4, 3],
    [Math.PI, 4],
    [(-Math.PI * 3) / 4, 5],
    [-Math.PI / 2, 6],
    [-Math.PI / 4, 7],
  ])('maps screen-space angle %s to directional frame %s', (facing, frame) => {
    expect(getSentryDirectionFrame(facing)).toBe(frame);
  });

  it('wraps equivalent angles to the same frame', () => {
    expect(getSentryDirectionFrame(Math.PI * 2)).toBe(0);
    expect(getSentryDirectionFrame(-Math.PI)).toBe(4);
  });
});
