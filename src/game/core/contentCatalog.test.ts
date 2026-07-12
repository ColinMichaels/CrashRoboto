import { describe, expect, it } from 'vitest';
import { ALL_COLLECTION_CARD_IDS, STARTER_CARD_IDS, VAULT_CARD_IDS } from './collection';
import { CARDS, ROBOTS, ROBOT_CARD_IDS } from './content';
import { SPRITE_SHEETS } from './spriteSheets';
import type { RobotKind } from './types';
import { getArenaUnitTextureKey, VAULT_UNIT_ATLAS_KEY } from '../phaser/unitPresentation';

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('content catalog integrity', () => {
  it('keeps collection groups complete, unique, and aligned with the card catalog', () => {
    expect(new Set(STARTER_CARD_IDS).size).toBe(STARTER_CARD_IDS.length);
    expect(new Set(VAULT_CARD_IDS).size).toBe(VAULT_CARD_IDS.length);
    expect(new Set(ALL_COLLECTION_CARD_IDS).size).toBe(ALL_COLLECTION_CARD_IDS.length);
    expect(sorted(ALL_COLLECTION_CARD_IDS)).toEqual(sorted(Object.keys(CARDS)));
  });

  it('keeps playable robot IDs aligned with robot definitions', () => {
    const playableRobotIds = Object.keys(ROBOTS).filter((robotId) => robotId !== 'microbot');
    expect(sorted(ROBOT_CARD_IDS)).toEqual(sorted(playableRobotIds));
  });

  it('keeps card keys, frames, and sprite-sheet capacity aligned', () => {
    for (const [cardId, card] of Object.entries(CARDS)) {
      const sheet = SPRITE_SHEETS[card.sheet];
      expect(card.id).toBe(cardId);
      expect(card.frame).toBeGreaterThanOrEqual(0);
      expect(card.frame).toBeLessThan(sheet.columns * sheet.rows);
    }
  });

  it('routes every Vault robot to the Vault movement atlas', () => {
    const vaultRobots = VAULT_CARD_IDS.filter((cardId) => {
      const card = CARDS[cardId];
      return card.category === 'unit' || card.category === 'commander';
    });

    for (const robotId of vaultRobots) {
      expect(getArenaUnitTextureKey(robotId as RobotKind)).toBe(VAULT_UNIT_ATLAS_KEY);
    }
  });
});
