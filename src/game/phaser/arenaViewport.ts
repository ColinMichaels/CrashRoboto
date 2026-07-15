import { BOARD_HEIGHT, BOARD_WIDTH } from '../core/content';

export const DESKTOP_BATTLE_FRAME_ASPECT_RATIO = 16 / 9;
export const DESKTOP_ARENA_HEIGHT_RATIO = (
  BOARD_HEIGHT / BOARD_WIDTH
) * DESKTOP_BATTLE_FRAME_ASPECT_RATIO;

// Smallest centered crop that contains the complete program target bounds and
// the outside edges of both relay tower sprites.
export const PORTRAIT_ARENA_LEFT = 526;
export const PORTRAIT_ARENA_WIDTH = 548;
export const PORTRAIT_ARENA_ASPECT_RATIO = PORTRAIT_ARENA_WIDTH / BOARD_HEIGHT;

export const getPortraitArenaHeight = (width: number): number =>
  width / PORTRAIT_ARENA_ASPECT_RATIO;

export type ArenaOrientation = 'landscape' | 'portrait';

export interface ArenaViewport {
  orientation: ArenaOrientation;
  screenWidth: number;
  screenHeight: number;
  renderX: number;
  renderY: number;
  renderWidth: number;
  renderHeight: number;
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
  const portraitZoom = Math.min(screenWidth / worldWidth, screenHeight / BOARD_HEIGHT);
  const zoomX = orientation === 'portrait' ? portraitZoom : screenWidth / worldWidth;
  const zoomY = orientation === 'portrait' ? portraitZoom : screenHeight / BOARD_HEIGHT;
  const renderWidth = orientation === 'portrait' ? worldWidth * portraitZoom : screenWidth;
  const renderHeight = orientation === 'portrait' ? BOARD_HEIGHT * portraitZoom : screenHeight;

  return {
    orientation,
    screenWidth,
    screenHeight,
    renderX: (screenWidth - renderWidth) / 2,
    renderY: (screenHeight - renderHeight) / 2,
    renderWidth,
    renderHeight,
    worldX,
    worldY: 0,
    worldWidth,
    worldHeight: BOARD_HEIGHT,
    zoomX,
    zoomY,
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

  const screenX = ((clientX - bounds.left) / bounds.width) * viewport.screenWidth;
  const screenY = ((clientY - bounds.top) / bounds.height) * viewport.screenHeight;
  const normalizedX = (screenX - viewport.renderX) / viewport.renderWidth;
  const normalizedY = (screenY - viewport.renderY) / viewport.renderHeight;
  const edgeEpsilon = 1e-9;
  if (
    normalizedX < -edgeEpsilon ||
    normalizedX > 1 + edgeEpsilon ||
    normalizedY < -edgeEpsilon ||
    normalizedY > 1 + edgeEpsilon
  ) return null;
  const arenaX = Math.min(1, Math.max(0, normalizedX));
  const arenaY = Math.min(1, Math.max(0, normalizedY));

  return {
    x: viewport.worldX + arenaX * viewport.worldWidth,
    y: viewport.worldY + arenaY * viewport.worldHeight,
  };
}
