import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../core/content';
import { PROGRAM_TARGET_BOUNDS } from '../core/deployment';
import {
  PORTRAIT_ARENA_LEFT,
  PORTRAIT_ARENA_WIDTH,
  clientPointToArenaPoint,
  createArenaViewport,
} from './arenaViewport';

describe('arena viewport', () => {
  it('keeps the complete board visible in landscape', () => {
    const viewport = createArenaViewport(844, 390);

    expect(viewport).toMatchObject({
      orientation: 'landscape',
      worldX: 0,
      worldY: 0,
      worldWidth: BOARD_WIDTH,
      worldHeight: BOARD_HEIGHT,
    });
    expect(viewport.zoomX).toBeCloseTo(844 / BOARD_WIDTH);
    expect(viewport.zoomY).toBeCloseTo(390 / BOARD_HEIGHT);
  });

  it('uses the centered playable crop in portrait', () => {
    const viewport = createArenaViewport(390, 675);

    expect(viewport).toMatchObject({
      orientation: 'portrait',
      worldX: PORTRAIT_ARENA_LEFT,
      worldWidth: PORTRAIT_ARENA_WIDTH,
      worldHeight: BOARD_HEIGHT,
    });
    expect(viewport.worldX + viewport.worldWidth / 2).toBe(BOARD_WIDTH / 2);
    expect(viewport.worldX).toBeLessThanOrEqual(PROGRAM_TARGET_BOUNDS.minX);
    expect(viewport.worldX + viewport.worldWidth).toBeGreaterThanOrEqual(PROGRAM_TARGET_BOUNDS.maxX);
  });

  it('maps portrait client coordinates through the visible world crop', () => {
    const viewport = createArenaViewport(390, 675);
    const bounds = { left: 10, top: 20, width: 390, height: 675 };

    expect(clientPointToArenaPoint(10, 20, bounds, viewport)).toEqual({
      x: PORTRAIT_ARENA_LEFT,
      y: 0,
    });
    expect(clientPointToArenaPoint(205, 357.5, bounds, viewport)).toEqual({
      x: BOARD_WIDTH / 2,
      y: BOARD_HEIGHT / 2,
    });
    expect(clientPointToArenaPoint(400, 695, bounds, viewport)).toEqual({
      x: PORTRAIT_ARENA_LEFT + PORTRAIT_ARENA_WIDTH,
      y: BOARD_HEIGHT,
    });
  });

  it('maps landscape client coordinates to the complete board', () => {
    const viewport = createArenaViewport(800, 400);
    const point = clientPointToArenaPoint(
      600,
      100,
      { left: 200, top: 0, width: 800, height: 400 },
      viewport,
    );

    expect(point).toEqual({ x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 4 });
  });

  it('rejects points outside the rendered canvas', () => {
    const viewport = createArenaViewport(390, 675);
    const bounds = { left: 10, top: 20, width: 390, height: 675 };

    expect(clientPointToArenaPoint(9, 100, bounds, viewport)).toBeNull();
    expect(clientPointToArenaPoint(100, 696, bounds, viewport)).toBeNull();
    expect(clientPointToArenaPoint(100, 100, { ...bounds, width: 0 }, viewport)).toBeNull();
  });

  it('guards against zero-sized startup measurements', () => {
    expect(createArenaViewport(0, 0)).toMatchObject({
      orientation: 'landscape',
      screenWidth: 1,
      screenHeight: 1,
    });
  });
});
