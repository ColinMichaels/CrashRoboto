import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  TOWER_PAD_POSITIONS,
  TOWER_VISUAL_SIZE,
} from '../core/content';
import { PROGRAM_TARGET_BOUNDS } from '../core/deployment';
import {
  PORTRAIT_ARENA_LEFT,
  PORTRAIT_ARENA_ASPECT_RATIO,
  PORTRAIT_ARENA_WIDTH,
  DESKTOP_ARENA_HEIGHT_RATIO,
  clientPointToArenaPoint,
  createArenaViewport,
  getPortraitArenaHeight,
} from './arenaViewport';

describe('arena viewport', () => {
  it('reserves the exact native board height above the desktop HUD band', () => {
    expect(DESKTOP_ARENA_HEIGHT_RATIO).toBeCloseTo(684 / 900);

    const viewport = createArenaViewport(1600, 684);
    expect(viewport.zoomX).toBe(1);
    expect(viewport.zoomY).toBe(1);
    expect(viewport.worldHeight).toBe(BOARD_HEIGHT);
  });

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

  it('contains the centered playable crop without changing its aspect ratio', () => {
    const viewport = createArenaViewport(390, 675);
    const expectedZoom = 390 / PORTRAIT_ARENA_WIDTH;

    expect(viewport).toMatchObject({
      orientation: 'portrait',
      worldX: PORTRAIT_ARENA_LEFT,
      worldWidth: PORTRAIT_ARENA_WIDTH,
      worldHeight: BOARD_HEIGHT,
    });
    expect(viewport.worldX + viewport.worldWidth / 2).toBe(BOARD_WIDTH / 2);
    expect(viewport.zoomX).toBeCloseTo(expectedZoom);
    expect(viewport.zoomY).toBeCloseTo(expectedZoom);
    expect(viewport.renderWidth / viewport.renderHeight).toBeCloseTo(
      PORTRAIT_ARENA_WIDTH / BOARD_HEIGHT,
    );
    expect(viewport.renderY).toBeGreaterThan(0);
  });

  it('keeps full tower sprites and program targets visible on an iPhone XR arena', () => {
    const viewport = createArenaViewport(414, getPortraitArenaHeight(414));
    const right = viewport.worldX + viewport.worldWidth;

    expect(viewport.zoomX).toBe(viewport.zoomY);
    expect(viewport.renderWidth).toBeCloseTo(viewport.screenWidth);
    expect(viewport.renderHeight).toBeCloseTo(viewport.screenHeight, 0);
    expect(PROGRAM_TARGET_BOUNDS.minX).toBeGreaterThan(viewport.worldX);
    expect(PROGRAM_TARGET_BOUNDS.maxX).toBeLessThan(right);

    const relayPositions = Object.entries(TOWER_PAD_POSITIONS)
      .filter(([id]) => !id.endsWith('core'))
      .map(([, position]) => position);
    const corePositions = Object.entries(TOWER_PAD_POSITIONS)
      .filter(([id]) => id.endsWith('core'))
      .map(([, position]) => position);
    expect(Math.min(...relayPositions.map(({ x }) => x - TOWER_VISUAL_SIZE.relay / 2)))
      .toBeGreaterThan(viewport.worldX);
    expect(Math.max(...relayPositions.map(({ x }) => x + TOWER_VISUAL_SIZE.relay / 2)))
      .toBeLessThan(right);
    expect(Math.min(...corePositions.map(({ x }) => x - TOWER_VISUAL_SIZE.core / 2)))
      .toBeGreaterThan(viewport.worldX);
    expect(Math.max(...corePositions.map(({ x }) => x + TOWER_VISUAL_SIZE.core / 2)))
      .toBeLessThan(right);
  });

  it('exposes the portrait canvas aspect for the surrounding command-deck layout', () => {
    expect(PORTRAIT_ARENA_ASPECT_RATIO).toBeCloseTo(548 / 684);
    expect(getPortraitArenaHeight(414)).toBeCloseTo(516.74, 1);
  });

  it('maps portrait client coordinates through the visible world crop', () => {
    const viewport = createArenaViewport(390, 675);
    const bounds = { left: 10, top: 20, width: 390, height: 675 };
    const renderTop = bounds.top + viewport.renderY;
    const renderBottom = renderTop + viewport.renderHeight;

    expect(clientPointToArenaPoint(10, renderTop, bounds, viewport)).toEqual({
      x: viewport.worldX,
      y: 0,
    });
    expect(clientPointToArenaPoint(205, (renderTop + renderBottom) / 2, bounds, viewport)).toEqual({
      x: BOARD_WIDTH / 2,
      y: BOARD_HEIGHT / 2,
    });
    expect(clientPointToArenaPoint(400, renderBottom, bounds, viewport)).toEqual({
      x: viewport.worldX + viewport.worldWidth,
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
    expect(clientPointToArenaPoint(100, bounds.top + viewport.renderY - 1, bounds, viewport)).toBeNull();
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
