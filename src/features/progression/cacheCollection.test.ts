import { describe, expect, it } from 'vitest';
import {
  createDefaultCardCollection,
  type AppliedVictoryChests,
} from '../../game/core/collection';
import { collectVictoryCaches } from './cacheCollection';

const reward: AppliedVictoryChests = {
  collection: createDefaultCardCollection(),
  reveals: [
    {
      tier: 'cache',
      rewards: [{
        kind: 'fragments',
        cardId: 'aegis',
        copiesAwarded: 4,
        before: { level: 0, copies: 0 },
        after: { level: 0, copies: 4 },
        levelsGained: 0,
        unlocked: false,
      }],
    },
    {
      tier: 'vault',
      rewards: [{
        kind: 'fragments',
        cardId: 'aegis',
        copiesAwarded: 4,
        before: { level: 0, copies: 4 },
        after: { level: 1, copies: 0 },
        levelsGained: 1,
        unlocked: true,
      }],
    },
  ],
};

describe('Victory Cache collection transitions', () => {
  it('claims generated reveals sequentially without applying later caches early', () => {
    const collection = createDefaultCardCollection();
    const first = collectVictoryCaches(collection, reward, 0, 1);

    expect(first.collectedCount).toBe(1);
    expect(first.collection.aegis).toEqual({ level: 0, copies: 4 });
    expect(collection.aegis).toEqual({ level: 0, copies: 0 });

    const second = collectVictoryCaches(first.collection, reward, first.collectedCount, 2);
    expect(second.collectedCount).toBe(2);
    expect(second.collection.aegis).toEqual({ level: 1, copies: 0 });
  });

  it('supports collect-all and ignores stale or out-of-range targets', () => {
    const collection = createDefaultCardCollection();
    const all = collectVictoryCaches(collection, reward, 0, 99);

    expect(all.collectedCount).toBe(2);
    expect(all.collection.aegis).toEqual({ level: 1, copies: 0 });

    const stale = collectVictoryCaches(all.collection, reward, all.collectedCount, 1);
    expect(stale).toEqual({ collection: all.collection, collectedCount: 2 });
  });
});
