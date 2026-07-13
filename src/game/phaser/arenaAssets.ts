import { CARDS } from '../core/content';
import { SPRITE_SHEETS } from '../core/spriteSheets';
import type { CardId, MatchSnapshot, RobotKind, SpriteSheet } from '../core/types';
import {
  ARENA_UNIT_ATLAS_FRAME_COUNT,
  ARENA_UNIT_ATLAS_FRAME_SIZE,
  ARENA_UNIT_ATLAS_KEY,
  VAULT_UNIT_ATLAS_FRAME_COUNT,
  VAULT_UNIT_ATLAS_FRAME_HEIGHT,
  VAULT_UNIT_ATLAS_FRAME_WIDTH,
  VAULT_UNIT_ATLAS_KEY,
  VAULT_UNIT_KINDS,
} from './unitPresentation';
import {
  SENTRY_DIRECTION_ATLAS_KEY,
  SENTRY_DIRECTION_ATLAS_PATH,
  SENTRY_DIRECTION_FRAME_COUNT,
  SENTRY_DIRECTION_FRAME_SIZE,
} from './sentryPresentation';

interface ArenaImageAsset {
  type: 'image';
  key: string;
  path: string;
}

interface ArenaSpriteSheetAsset {
  type: 'spritesheet';
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  endFrame: number;
}

export type ArenaAsset = ArenaImageAsset | ArenaSpriteSheetAsset;

const createCardSheetAsset = (sheet: SpriteSheet): ArenaSpriteSheetAsset => {
  const metadata = SPRITE_SHEETS[sheet];
  return {
    type: 'spritesheet',
    key: metadata.textureKey,
    path: metadata.assetPath,
    frameWidth: metadata.frameWidth,
    frameHeight: metadata.frameHeight,
    endFrame: metadata.columns * metadata.rows - 1,
  };
};

const BASE_ARENA_ASSETS: readonly ArenaAsset[] = [
  { type: 'image', key: 'arena-board', path: 'assets/game/arena-board-long.png' },
  {
    type: 'spritesheet',
    key: 'tower-sprites',
    path: 'assets/game/tower-sprites.png',
    frameWidth: 627,
    frameHeight: 627,
    endFrame: 3,
  },
  {
    type: 'spritesheet',
    key: 'relay-weapon-sprites',
    path: 'assets/game/relay-weapon-sprites.png',
    frameWidth: 512,
    frameHeight: 512,
    endFrame: 2,
  },
  createCardSheetAsset('system'),
  {
    type: 'spritesheet',
    key: SENTRY_DIRECTION_ATLAS_KEY,
    path: SENTRY_DIRECTION_ATLAS_PATH,
    frameWidth: SENTRY_DIRECTION_FRAME_SIZE,
    frameHeight: SENTRY_DIRECTION_FRAME_SIZE,
    endFrame: SENTRY_DIRECTION_FRAME_COUNT - 1,
  },
  {
    type: 'spritesheet',
    key: 'combat-vfx-sprites',
    path: 'assets/game/combat-vfx-sprites.png',
    frameWidth: 627,
    frameHeight: 627,
    endFrame: 3,
  },
  {
    type: 'spritesheet',
    key: ARENA_UNIT_ATLAS_KEY,
    path: 'assets/game/arena-robot-move-sprites.png',
    frameWidth: ARENA_UNIT_ATLAS_FRAME_SIZE,
    frameHeight: ARENA_UNIT_ATLAS_FRAME_SIZE,
    endFrame: ARENA_UNIT_ATLAS_FRAME_COUNT - 1,
  },
];

const VAULT_UNIT_ASSET: ArenaSpriteSheetAsset = {
  type: 'spritesheet',
  key: VAULT_UNIT_ATLAS_KEY,
  path: 'assets/game/vault-unit-sprites.png',
  frameWidth: VAULT_UNIT_ATLAS_FRAME_WIDTH,
  frameHeight: VAULT_UNIT_ATLAS_FRAME_HEIGHT,
  endFrame: VAULT_UNIT_ATLAS_FRAME_COUNT - 1,
};

const isVaultUnit = (cardId: CardId): boolean => (
  (VAULT_UNIT_KINDS as readonly RobotKind[]).includes(cardId as RobotKind)
);

export function getArenaAssetManifest(decks: MatchSnapshot['decks']): readonly ArenaAsset[] {
  const activeCardIds = new Set<CardId>([...decks.player, ...decks.enemy]);
  const assets = [...BASE_ARENA_ASSETS];
  const optionalCardSheets = new Set<SpriteSheet>();
  for (const cardId of activeCardIds) {
    const card = CARDS[cardId];
    if (card.category === 'program' || card.category === 'installation') {
      optionalCardSheets.add(card.sheet);
    }
  }

  optionalCardSheets.delete('system');
  for (const sheet of optionalCardSheets) assets.push(createCardSheetAsset(sheet));
  if ([...activeCardIds].some(isVaultUnit)) assets.push(VAULT_UNIT_ASSET);
  return assets;
}
