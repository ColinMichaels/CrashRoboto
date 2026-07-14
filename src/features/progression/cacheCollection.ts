import type {
  AppliedVictoryChests,
  CardCollection,
} from '../../game/core/collection';

export interface CacheCollectionTransition {
  collection: CardCollection;
  collectedCount: number;
}

/**
 * Applies immutable reward reveals from the current collection cursor up to a
 * requested count. Reveal generation remains in game/core; this transition is
 * the feature-level rule for when those already-generated rewards are claimed.
 */
export function collectVictoryCaches(
  collection: CardCollection,
  reward: AppliedVictoryChests,
  collectedCount: number,
  requestedCount: number,
): CacheCollectionTransition {
  const normalizedCollectedCount = Number.isFinite(collectedCount) ? Math.floor(collectedCount) : 0;
  const normalizedRequestedCount = Number.isFinite(requestedCount)
    ? Math.floor(requestedCount)
    : normalizedCollectedCount;
  const currentCount = Math.min(
    reward.reveals.length,
    Math.max(0, normalizedCollectedCount),
  );
  const nextCount = Math.min(
    reward.reveals.length,
    Math.max(currentCount, normalizedRequestedCount),
  );
  if (nextCount === currentCount) return { collection, collectedCount: currentCount };

  const nextCollection = { ...collection };
  for (let cacheIndex = currentCount; cacheIndex < nextCount; cacheIndex += 1) {
    for (const item of reward.reveals[cacheIndex].rewards) {
      nextCollection[item.cardId] = { ...item.after };
    }
  }

  return { collection: nextCollection, collectedCount: nextCount };
}
