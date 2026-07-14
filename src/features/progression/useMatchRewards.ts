import { useCallback, useEffect, useRef, useState } from 'react';
import { readCardCollection, saveCardCollection } from '../../persistence/cardCollectionStorage';
import { readPlayerProgress, savePlayerProgress } from '../../persistence/playerProgressStorage';
import {
  applyVictoryChests,
  generateVictoryChests,
  type AppliedVictoryChests,
} from '../../game/core/collection';
import { getMatchProgressAward, type MatchProgressAward } from '../../game/core/progression';
import type { MatchSnapshot } from '../../game/core/types';
import { collectVictoryCaches } from './cacheCollection';

const rewardRandom = (): number => (
  window.crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000
);

export function useMatchRewards(snapshot: MatchSnapshot) {
  const [playerProgress, setPlayerProgress] = useState(readPlayerProgress);
  const [lastProgressAward, setLastProgressAward] = useState<MatchProgressAward | null>(null);
  const [cardCollection, setCardCollection] = useState(readCardCollection);
  const [lastCacheReward, setLastCacheReward] = useState<AppliedVictoryChests | null>(null);
  const [collectedCacheCount, setCollectedCacheCount] = useState(0);
  const awardedMatchRevisionRef = useRef(-1);
  const cardCollectionRef = useRef(cardCollection);
  const collectedCacheCountRef = useRef(0);

  useEffect(() => {
    cardCollectionRef.current = cardCollection;
  }, [cardCollection]);

  const clearMatchRewards = useCallback(() => {
    setLastProgressAward(null);
    setLastCacheReward(null);
    collectedCacheCountRef.current = 0;
    setCollectedCacheCount(0);
  }, []);

  const commitCacheCollection = useCallback((requestedCount: number): boolean => {
    if (!lastCacheReward) return false;
    const transition = collectVictoryCaches(
      cardCollectionRef.current,
      lastCacheReward,
      collectedCacheCountRef.current,
      requestedCount,
    );
    if (transition.collectedCount === collectedCacheCountRef.current) return false;

    saveCardCollection(transition.collection);
    cardCollectionRef.current = transition.collection;
    setCardCollection(transition.collection);
    collectedCacheCountRef.current = transition.collectedCount;
    setCollectedCacheCount(transition.collectedCount);
    return true;
  }, [lastCacheReward]);

  const collectCache = useCallback((cacheIndex: number): boolean => {
    if (!lastCacheReward || cacheIndex !== collectedCacheCountRef.current) return false;
    return commitCacheCollection(cacheIndex + 1);
  }, [commitCacheCollection, lastCacheReward]);

  const collectAllCaches = useCallback((): boolean => {
    if (!lastCacheReward) return false;
    return commitCacheCollection(lastCacheReward.reveals.length);
  }, [commitCacheCollection, lastCacheReward]);

  useEffect(() => {
    if (
      snapshot.phase !== 'ended' ||
      !snapshot.result ||
      awardedMatchRevisionRef.current === snapshot.revision
    ) return;

    awardedMatchRevisionRef.current = snapshot.revision;
    const rewardBattleScore = snapshot.series?.battleScore ?? snapshot.battleScore;
    const award = getMatchProgressAward(rewardBattleScore, snapshot.result);
    const nextProgress = {
      xp: playerProgress.xp + award.xp,
      matches: playerProgress.matches + 1,
    };
    savePlayerProgress(nextProgress);
    setPlayerProgress(nextProgress);
    setLastProgressAward(award);

    if (snapshot.result.winner === 'player') {
      const chests = generateVictoryChests(cardCollection, rewardRandom);
      const applied = applyVictoryChests(cardCollection, chests);
      collectedCacheCountRef.current = 0;
      setCollectedCacheCount(0);
      setLastCacheReward(applied);
    } else {
      setLastCacheReward(null);
    }
  }, [
    cardCollection,
    playerProgress.matches,
    playerProgress.xp,
    snapshot.battleScore,
    snapshot.phase,
    snapshot.result,
    snapshot.revision,
    snapshot.series,
  ]);

  return {
    playerProgress,
    cardCollection,
    lastProgressAward,
    lastCacheReward,
    collectedCacheCount,
    collectCache,
    collectAllCaches,
    clearMatchRewards,
  };
}
