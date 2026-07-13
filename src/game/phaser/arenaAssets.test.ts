import { describe, expect, it } from 'vitest';
import { DEFAULT_ENEMY_DECK, DEFAULT_PLAYER_DECK } from '../core/content';
import type { CardId, MatchSnapshot } from '../core/types';
import {
  getArenaAssetManifest,
  getArenaBoardThemeForLevel,
} from './arenaAssets';

const createDecks = (player: CardId[]): MatchSnapshot['decks'] => ({
  player,
  enemy: [...DEFAULT_ENEMY_DECK],
});

const getKeys = (decks: MatchSnapshot['decks']): string[] => (
  getArenaAssetManifest(decks).map((asset) => asset.key)
);

describe('arena asset manifest', () => {
  it('assigns arena themes to non-overlapping player-level ranges', () => {
    expect(getArenaBoardThemeForLevel(1)).toBe('foundry');
    expect(getArenaBoardThemeForLevel(5)).toBe('foundry');
    expect(getArenaBoardThemeForLevel(6)).toBe('sewer');
    expect(getArenaBoardThemeForLevel(10)).toBe('sewer');
    expect(getArenaBoardThemeForLevel(11)).toBe('volcanic');
    expect(getArenaBoardThemeForLevel(19)).toBe('volcanic');
    expect(getArenaBoardThemeForLevel(20)).toBe('orbital');
    expect(getArenaBoardThemeForLevel(39)).toBe('orbital');
    expect(getArenaBoardThemeForLevel(40)).toBe('alien');
  });

  it('loads only the board assigned to the current player level', () => {
    const decks = createDecks([...DEFAULT_PLAYER_DECK]);
    const boardPath = (level: number) => getArenaAssetManifest(decks, level)
      .find((asset) => asset.key === 'arena-board')?.path;

    expect(boardPath(1)).toBe('assets/game/arena-board-long.png');
    expect(boardPath(6)).toBe('assets/game/arena-board-sewer.png');
    expect(boardPath(11)).toBe('assets/game/arena-board-volcanic.png');
    expect(boardPath(20)).toBe('assets/game/arena-board-orbital.png');
    expect(boardPath(40)).toBe('assets/game/arena-board-alien.png');
  });

  it('keeps portrait-only and inactive Vault textures out of a standard match', () => {
    const keys = getKeys(createDecks([...DEFAULT_PLAYER_DECK]));

    expect(keys).toContain('arena-robot-move-sprites');
    expect(keys).toContain('sentry-directional-sprites');
    expect(keys).not.toContain('robot-sprites');
    expect(keys).not.toContain('vault-sprites');
    expect(keys).not.toContain('vault-unit-sprites');
  });

  it('loads the Vault card sheet only for active Vault programs or installations', () => {
    const keys = getKeys(createDecks([...DEFAULT_PLAYER_DECK.slice(1), 'gravity']));

    expect(keys).toContain('vault-sprites');
    expect(keys).not.toContain('vault-unit-sprites');
  });

  it('loads the Vault unit atlas only for active Vault robots', () => {
    const keys = getKeys(createDecks([...DEFAULT_PLAYER_DECK.slice(1), 'aegis']));

    expect(keys).toContain('vault-unit-sprites');
    expect(keys).not.toContain('vault-sprites');
  });
});
