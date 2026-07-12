import { useCallback, useEffect, useRef, useState } from 'react';
import { readCardCollection, saveCardCollection } from '../../app/cardCollectionStorage';
import { readPlayerProgress, savePlayerProgress } from '../../app/playerProgressStorage';
import {
  applyVictoryChests,
  generateVictoryChests,
  type AppliedVictoryChests,
} from '../../game/core/collection';
import { getMatchProgressAward, type MatchProgressAward } from '../../game/core/progression';
import type { MatchSnapshot } from '../../game/core/types';

const rewardRandom = (): number => (
  window.crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000
);

export function useMatchRewards(snapshot: MatchSnapshot) {
  const [playerProgress, setPlayerProgress] = useState(readPlayerProgress);
  const [lastProgressAward, setLastProgressAward] = useState<MatchProgressAward | null>(null);
  const [cardCollection, setCardCollection] = useState(readCardCollection);
  const [lastCacheReward, setLastCacheReward] = useState<AppliedVictoryChests | null>(null);
  const awardedMatchRevisionRef = useRef(-1);

  const clearMatchRewards = useCallback(() => {
    setLastProgressAward(null);
    setLastCacheReward(null);
  }, []);

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
      saveCardCollection(applied.collection);
      setCardCollection(applied.collection);
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
    clearMatchRewards,
  };
}
