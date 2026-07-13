export const SENTRY_DIRECTION_ATLAS_KEY = 'sentry-directional-sprites';
export const SENTRY_DIRECTION_ATLAS_PATH = 'assets/game/sentry-directional-sprites.webp';
export const SENTRY_DIRECTION_FRAME_SIZE = 384;
export const SENTRY_DIRECTION_FRAME_COUNT = 8;

const SENTRY_DIRECTION_STEP = Math.PI / 4;

/** Maps a screen-space aim angle to the nearest upright directional sprite. */
export function getSentryDirectionFrame(facing: number): number {
  const direction = Math.round(facing / SENTRY_DIRECTION_STEP);
  return ((direction % SENTRY_DIRECTION_FRAME_COUNT) + SENTRY_DIRECTION_FRAME_COUNT)
    % SENTRY_DIRECTION_FRAME_COUNT;
}
