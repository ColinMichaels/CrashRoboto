import { describe, expect, it } from 'vitest';
import { DEFAULT_ENEMY_DECK, DEFAULT_PLAYER_DECK } from '../core/content';
import type { CardId, MatchSnapshot } from '../core/types';
import { getArenaAssetManifest } from './arenaAssets';

const createDecks = (player: CardId[]): MatchSnapshot['decks'] => ({
  player,
  enemy: [...DEFAULT_ENEMY_DECK],
});

const getKeys = (decks: MatchSnapshot['decks']): string[] => (
  getArenaAssetManifest(decks).map((asset) => asset.key)
);

describe('arena asset manifest', () => {
  it('keeps portrait-only and inactive Vault textures out of a standard match', () => {
    const keys = getKeys(createDecks([...DEFAULT_PLAYER_DECK]));

    expect(keys).toContain('arena-robot-move-sprites');
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
