import type { SpriteSheet } from './types';

export interface SpriteSheetMetadata {
  assetPath: string;
  textureKey: string;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
}

export const SPRITE_SHEETS = {
  robot: {
    assetPath: 'assets/game/robot-sprites.webp',
    textureKey: 'robot-sprites',
    columns: 4,
    rows: 2,
    frameWidth: 443,
    frameHeight: 443,
  },
  system: {
    assetPath: 'assets/game/system-sprites.webp',
    textureKey: 'system-sprites',
    columns: 3,
    rows: 2,
    frameWidth: 512,
    frameHeight: 512,
  },
  vault: {
    assetPath: 'assets/game/vault-sprites.webp',
    textureKey: 'vault-sprites',
    columns: 3,
    rows: 2,
    frameWidth: 512,
    frameHeight: 512,
  },
} as const satisfies Record<SpriteSheet, SpriteSheetMetadata>;
