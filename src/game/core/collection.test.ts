import { describe, expect, it } from 'vitest';
import { CARDS } from './content';
import {
  ALL_COLLECTION_CARD_IDS,
  CARD_MASTERY_BONUSES,
  STARTER_CARD_IDS,
  VAULT_CARD_IDS,
  applyVictoryChests,
  createDefaultCardCollection,
  generateVictoryChests,
  getCardCopyRequirement,
  getCardMasteryBonus,
  getCollectionCardLevels,
  getUnlockedCardIds,
  isCardUnlocked,
  normalizeCardCollection,
  type ChestTier,
  type RewardRng,
  type VictoryChest,
} from './collection';

const sequenceRng = (...values: number[]): RewardRng => {
  let index = 0;
  return () => values[index++] ?? 0;
};

const minimumCopiesForTier = (tier: ChestTier): number =>
  tier === 'cache' ? 2 : tier === 'vault' ? 3 : 5;

const maximumCopiesForTier = (tier: ChestTier): number =>
  tier === 'cache' ? 4 : tier === 'vault' ? 6 : 9;

describe('card collection', () => {
  it('starts the original roster at Level 1 and locks the five Vault cards', () => {
    const collection = createDefaultCardCollection();

    expect(ALL_COLLECTION_CARD_IDS).toHaveLength(18);
    expect(new Set(ALL_COLLECTION_CARD_IDS)).toEqual(new Set(Object.keys(CARDS)));
    expect(getUnlockedCardIds(collection)).toEqual(STARTER_CARD_IDS);
    for (const cardId of STARTER_CARD_IDS) {
      expect(collection[cardId]).toEqual({ level: 1, copies: 0 });
      expect(isCardUnlocked(collection, cardId)).toBe(true);
    }
    for (const cardId of VAULT_CARD_IDS) {
      expect(collection[cardId]).toEqual({ level: 0, copies: 0 });
      expect(isCardUnlocked(collection, cardId)).toBe(false);
    }
    expect(getCollectionCardLevels(collection)).toMatchObject({ zip: 1, foundry: 1 });
    expect(getCollectionCardLevels(collection)).not.toHaveProperty('aegis');
  });

  it('uses the fixed unlock and promotion thresholds with modest mastery bonuses', () => {
    expect([0, 1, 2, 3, 4, 5].map((level) =>
      getCardCopyRequirement(level as 0 | 1 | 2 | 3 | 4 | 5),
    )).toEqual([8, 12, 20, 32, 48, null]);
    expect(CARD_MASTERY_BONUSES).toEqual({
      0: 0,
      1: 0,
      2: 0.04,
      3: 0.08,
      4: 0.12,
      5: 0.16,
    });
    expect(getCardMasteryBonus(5)).toBe(0.16);
  });

  it('normalizes partial and corrupt entries without ever relocking a starter', () => {
    const collection = normalizeCardCollection({
      zip: { level: 0, copies: -7 },
      aegis: { level: 0, copies: 40 },
      wraith: null,
      viper: { level: 5, copies: 99 },
      gravity: { level: 2, copies: 3.9 },
      firewall: { level: 99, copies: Number.POSITIVE_INFINITY },
      unknown: { level: 5, copies: 0 },
    });

    expect(collection.zip).toEqual({ level: 1, copies: 0 });
    expect(collection.aegis).toEqual({ level: 3, copies: 0 });
    expect(collection.wraith).toEqual({ level: 0, copies: 0 });
    expect(collection.viper).toEqual({ level: 5, copies: 0 });
    expect(collection.gravity).toEqual({ level: 2, copies: 3 });
    expect(collection.firewall).toEqual({ level: 0, copies: 0 });
    expect(Object.keys(collection)).toHaveLength(ALL_COLLECTION_CARD_IDS.length);
  });

  it('auto-promotes through multiple levels and returns before/after reveal metadata', () => {
    const collection = createDefaultCardCollection();
    collection.aegis = { level: 0, copies: 7 };
    const chests: VictoryChest[] = [{
      tier: 'cache',
      fragments: [{ cardId: 'aegis', copies: 53 }],
    }];

    const applied = applyVictoryChests(collection, chests);

    expect(applied.collection.aegis).toEqual({ level: 3, copies: 20 });
    expect(applied.reveals[0].rewards[0]).toEqual({
      kind: 'fragments',
      cardId: 'aegis',
      copiesAwarded: 53,
      before: { level: 0, copies: 7 },
      after: { level: 3, copies: 20 },
      levelsGained: 3,
      unlocked: true,
    });
    expect(collection.aegis).toEqual({ level: 0, copies: 7 });
  });

  it('preserves copies on direct upgrades and clamps max-level copies to zero', () => {
    const collection = createDefaultCardCollection();
    collection.viper = { level: 2, copies: 7 };
    collection.wraith = { level: 4, copies: 47 };
    const chests: VictoryChest[] = [
      {
        tier: 'vault',
        fragments: [{ cardId: 'wraith', copies: 2 }],
        directUpgrade: { cardId: 'viper' },
      },
      {
        tier: 'core',
        fragments: [{ cardId: 'viper', copies: 0 }],
        directUpgrade: { cardId: 'wraith' },
      },
    ];

    const applied = applyVictoryChests(collection, chests);

    expect(applied.collection.viper).toEqual({ level: 3, copies: 7 });
    expect(applied.collection.wraith).toEqual({ level: 5, copies: 0 });
    expect(applied.reveals[0].rewards.at(-1)).toMatchObject({
      kind: 'direct-upgrade',
      cardId: 'viper',
      before: { level: 2, copies: 7 },
      after: { level: 3, copies: 7 },
    });
    expect(applied.reveals[1].rewards).toHaveLength(1);
  });
});

describe('victory chests', () => {
  it('uses exact chest-count boundaries from the single opening roll', () => {
    const collection = createDefaultCardCollection();

    expect(generateVictoryChests(collection, sequenceRng(0.679_999)).length).toBe(1);
    expect(generateVictoryChests(collection, sequenceRng(0.68)).length).toBe(2);
    expect(generateVictoryChests(collection, sequenceRng(0.939_999)).length).toBe(2);
    expect(generateVictoryChests(collection, sequenceRng(0.94)).length).toBe(3);
  });

  it('uses exact Cache, Vault, and Core tier boundaries', () => {
    const collection = createDefaultCardCollection();

    expect(generateVictoryChests(collection, sequenceRng(0, 0.679_999))[0].tier).toBe('cache');
    expect(generateVictoryChests(collection, sequenceRng(0, 0.68))[0].tier).toBe('vault');
    expect(generateVictoryChests(collection, sequenceRng(0, 0.949_999))[0].tier).toBe('vault');
    expect(generateVictoryChests(collection, sequenceRng(0, 0.95))[0].tier).toBe('core');
  });

  it('emits the required number of drops and inclusive integer copy ranges', () => {
    const collection = createDefaultCardCollection();
    const minimumRoll = generateVictoryChests(collection, () => 0);
    const maximumRoll = generateVictoryChests(collection, () => 1);

    expect(minimumRoll).toHaveLength(1);
    expect(minimumRoll[0].tier).toBe('cache');
    expect(minimumRoll[0].fragments).toHaveLength(2);
    expect(minimumRoll[0].fragments.every((drop) => drop.copies === 2)).toBe(true);

    expect(maximumRoll).toHaveLength(3);
    for (const chest of maximumRoll) {
      expect(chest.tier).toBe('core');
      expect(chest.fragments).toHaveLength(4);
      expect(chest.fragments.every((drop) => drop.copies === 9)).toBe(true);
    }
  });

  it('guarantees a Vault card in Vault/Core chests and weights locked Vault cards', () => {
    const collection = createDefaultCardCollection();
    const vault = generateVictoryChests(collection, sequenceRng(0, 0.68))[0];
    const core = generateVictoryChests(collection, sequenceRng(0, 0.95))[0];
    const weightedCache = generateVictoryChests(
      collection,
      sequenceRng(0, 0, 0.4),
    )[0];

    expect(VAULT_CARD_IDS).toContain(vault.fragments[0].cardId);
    expect(VAULT_CARD_IDS).toContain(core.fragments[0].cardId);
    expect(VAULT_CARD_IDS).toContain(weightedCache.fragments[0].cardId);
  });

  it('applies direct-upgrade chance boundaries and omits upgrades with no eligible card', () => {
    const collection = createDefaultCardCollection();
    const cacheHit = generateVictoryChests(
      collection,
      sequenceRng(0, 0, 0, 0, 0, 0, 0.149_999, 0),
    )[0];
    const cacheMiss = generateVictoryChests(
      collection,
      sequenceRng(0, 0, 0, 0, 0, 0, 0.15),
    )[0];
    const vaultHit = generateVictoryChests(
      collection,
      sequenceRng(0, 0.68, 0, 0, 0, 0, 0, 0, 0.349_999, 0),
    )[0];
    const vaultMiss = generateVictoryChests(
      collection,
      sequenceRng(0, 0.68, 0, 0, 0, 0, 0, 0, 0.35),
    )[0];
    const coreHit = generateVictoryChests(
      collection,
      sequenceRng(0, 0.95),
    )[0];
    const allMaxed = normalizeCardCollection(Object.fromEntries(
      ALL_COLLECTION_CARD_IDS.map((cardId) => [cardId, { level: 5, copies: 100 }]),
    ));
    const maxedCore = generateVictoryChests(allMaxed, sequenceRng(0, 0.95))[0];

    expect(cacheHit.directUpgrade).toBeDefined();
    expect(cacheMiss).not.toHaveProperty('directUpgrade');
    expect(vaultHit.directUpgrade).toBeDefined();
    expect(vaultMiss).not.toHaveProperty('directUpgrade');
    expect(coreHit.directUpgrade).toBeDefined();
    expect(maxedCore).not.toHaveProperty('directUpgrade');
  });

  it('normalizes invalid RNG values without leaving valid reward ranges', () => {
    const values = [
      Number.NaN,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      -3,
      2,
    ];
    let index = 0;
    const chests = generateVictoryChests(
      createDefaultCardCollection(),
      () => values[index++ % values.length],
    );

    expect(chests.length).toBeGreaterThanOrEqual(1);
    expect(chests.length).toBeLessThanOrEqual(3);
    for (const chest of chests) {
      const expectedDrops = chest.tier === 'cache' ? 2 : chest.tier === 'vault' ? 3 : 4;
      expect(chest.fragments).toHaveLength(expectedDrops);
      for (const drop of chest.fragments) {
        expect(Number.isInteger(drop.copies)).toBe(true);
        expect(drop.copies).toBeGreaterThanOrEqual(minimumCopiesForTier(chest.tier));
        expect(drop.copies).toBeLessThanOrEqual(maximumCopiesForTier(chest.tier));
      }
    }

    expect(generateVictoryChests(createDefaultCardCollection(), () => {
      throw new Error('broken random source');
    })).toHaveLength(1);
  });
});
