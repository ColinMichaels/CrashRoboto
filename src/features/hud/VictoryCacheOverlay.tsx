import { useEffect, useRef, useState } from 'react';
import {
  getCardCopyRequirement,
  type AppliedVictoryChests,
  type CardRewardReveal,
  type ChestTier,
} from '../../game/core/collection';
import { CARDS } from '../../game/core/content';
import { getCardSpriteStyle } from '../cards/cardPresentation';

interface VictoryCacheOverlayProps {
  reward: AppliedVictoryChests;
  collectedCount: number;
  onCollect: (cacheIndex: number) => void;
  onCollectAll: () => void;
  onContinue: () => void;
}

const TIER_LABELS: Record<ChestTier, string> = {
  cache: 'BONUS CACHE',
  vault: 'VAULT CACHE',
  core: 'CORE CACHE',
};

function rewardStatus(reward: CardRewardReveal): string {
  if (reward.unlocked) return `UNLOCKED · MK ${reward.after.level}`;
  if (reward.levelsGained > 0) return `UPGRADED · MK ${reward.after.level}`;
  return `+${reward.copiesAwarded} FRAGMENTS`;
}

function rewardProgress(reward: CardRewardReveal): string {
  if (reward.kind === 'direct-upgrade') return `MK ${reward.before.level} → MK ${reward.after.level}`;
  const beforeRequirement = getCardCopyRequirement(reward.before.level);
  const afterRequirement = getCardCopyRequirement(reward.after.level);
  if (reward.levelsGained > 0) return `MK ${reward.before.level} → MK ${reward.after.level}`;
  if (afterRequirement === null) return 'MASTERY MAX';
  return `${reward.before.copies} / ${beforeRequirement ?? afterRequirement} → ${reward.after.copies} / ${afterRequirement}`;
}

export function VictoryCacheOverlay({ reward, collectedCount, onCollect, onCollectAll, onContinue }: VictoryCacheOverlayProps) {
  const [chestIndex, setChestIndex] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const chest = reward.reveals[chestIndex];
  const finalChest = chestIndex >= reward.reveals.length - 1;
  const nextChest = reward.reveals[chestIndex + 1];
  const collected = chestIndex < collectedCount;

  useEffect(() => {
    setChestIndex(0);
  }, [reward]);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [chestIndex]);

  if (!chest) return null;

  const performPrimaryAction = () => {
    if (!collected) {
      onCollect(chestIndex);
      return;
    }
    if (finalChest) onContinue();
    else setChestIndex((current) => Math.min(reward.reveals.length - 1, current + 1));
  };

  const collectAllAndContinue = () => {
    onCollectAll();
    onContinue();
  };

  return (
    <section
      className={`victory-cache-overlay cache-tier-${chest.tier}${collected ? ' is-collected' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-cache-title"
      aria-describedby="victory-cache-summary"
    >
      <header>
        <span>
          <h2 id="victory-cache-title">VICTORY CACHE</h2>
          <p id="victory-cache-summary">{reward.reveals.length} BONUS {reward.reveals.length === 1 ? 'CHEST' : 'CHESTS'} RECOVERED</p>
        </span>
        <strong>{TIER_LABELS[chest.tier]}</strong>
      </header>

      <div className="victory-cache-hero" aria-hidden="true">
        <i />
        <img src={`${import.meta.env.BASE_URL}assets/game/bonus-cache-open.webp`} alt="" />
        {nextChest && (
          <span className="victory-cache-queue">
            <small>NEXT · {TIER_LABELS[nextChest.tier]}</small>
            <i style={getCardSpriteStyle('vault', 5)} />
          </span>
        )}
        <span>{chestIndex + 1} / {reward.reveals.length}</span>
      </div>

      <div className="victory-cache-rewards" aria-live="polite" aria-label={`${TIER_LABELS[chest.tier]} rewards`}>
        <h3>
          <span>CACHE REWARDS</span>
          <strong>{collected ? 'ITEMS SECURED' : 'AWAITING COLLECTION'}</strong>
        </h3>
        {chest.rewards.map((item, index) => {
          const card = CARDS[item.cardId];
          const requirement = getCardCopyRequirement(item.after.level);
          const fill = requirement === null ? 1 : Math.min(1, item.after.copies / requirement);
          return (
            <article className={`victory-cache-reward category-${card.category}`} key={`${item.kind}-${item.cardId}-${index}`}>
              <span
                className={`victory-cache-card-art portrait-${card.sheet}`}
                style={getCardSpriteStyle(card.sheet, card.frame)}
                aria-hidden="true"
              />
              <span className="victory-cache-card-copy">
                <strong>{card.shortName}</strong>
                <small className={item.levelsGained > 0 ? 'is-upgrade' : ''}>{rewardStatus(item)}</small>
              </span>
              <span className="victory-cache-progress">
                <strong>{rewardProgress(item)}</strong>
                <i aria-hidden="true"><b style={{ width: `${fill * 100}%` }} /></i>
              </span>
            </article>
          );
        })}
      </div>

      <footer>
        <button ref={primaryRef} className="primary-action compact" type="button" onClick={performPrimaryAction} data-testid="collect-cache">
          {!collected ? 'COLLECT ITEMS' : finalChest ? 'CONTINUE TO LOBBY' : 'OPEN NEXT CACHE'}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg>
        </button>
        <button className="secondary-action" type="button" onClick={collectAllAndContinue}>COLLECT ALL & CONTINUE</button>
      </footer>
    </section>
  );
}
