import { BOARD_HEIGHT, BOARD_WIDTH } from '../core/content';

export const PORTRAIT_ARENA_LEFT = 480;
export const PORTRAIT_ARENA_WIDTH = 640;

export type ArenaOrientation = 'landscape' | 'portrait';

export interface ArenaViewport {
  orientation: ArenaOrientation;
  screenWidth: number;
  screenHeight: number;
  worldX: number;
  worldY: number;
  worldWidth: number;
  worldHeight: number;
  zoomX: number;
  zoomY: number;
}

export interface ClientBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ArenaPoint {
  x: number;
  y: number;
}

const safeDimension = (value: number) => Math.max(1, Math.round(value));

/**
 * Describes which part of the deterministic arena is visible in a canvas.
 * Landscape preserves the existing full-board presentation. Portrait crops
 * decorative side gutters while retaining the complete vertical playfield.
 */
export function createArenaViewport(width: number, height: number): ArenaViewport {
  const screenWidth = safeDimension(width);
  const screenHeight = safeDimension(height);
  const orientation: ArenaOrientation = screenHeight > screenWidth ? 'portrait' : 'landscape';
  const worldX = orientation === 'portrait' ? PORTRAIT_ARENA_LEFT : 0;
  const worldWidth = orientation === 'portrait' ? PORTRAIT_ARENA_WIDTH : BOARD_WIDTH;

  return {
    orientation,
    screenWidth,
    screenHeight,
    worldX,
    worldY: 0,
    worldWidth,
    worldHeight: BOARD_HEIGHT,
    zoomX: screenWidth / worldWidth,
    zoomY: screenHeight / BOARD_HEIGHT,
  };
}

/** Converts browser client coordinates into the currently visible arena crop. */
export function clientPointToArenaPoint(
  clientX: number,
  clientY: number,
  bounds: ClientBounds,
  viewport: ArenaViewport,
): ArenaPoint | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const normalizedX = (clientX - bounds.left) / bounds.width;
  const normalizedY = (clientY - bounds.top) / bounds.height;
  if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) return null;

  return {
    x: viewport.worldX + normalizedX * viewport.worldWidth,
    y: viewport.worldY + normalizedY * viewport.worldHeight,
  };
}
