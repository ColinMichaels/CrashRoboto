import { useEffect, useRef } from 'react';
import {
  getCardCopyRequirement,
  getCardMasteryBonus,
  type CardCollectionEntry,
} from '../../game/core/collection';
import { CARDS } from '../../game/core/content';
import type { CardId } from '../../game/core/types';
import { getCardSpriteStyle, TECH_CLASS_LABELS } from './cardPresentation';

interface CardCollectionPanelProps {
  cardId: CardId;
  entry: CardCollectionEntry;
  onClose: () => void;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5z" />
      <path d="M12 14v3" />
    </svg>
  );
}

export function CardCollectionPanel({ cardId, entry, onClose }: CardCollectionPanelProps) {
  const card = CARDS[cardId];
  const closeRef = useRef<HTMLButtonElement>(null);
  const requirement = getCardCopyRequirement(entry.level);
  const progress = requirement === null ? 1 : Math.min(1, entry.copies / requirement);
  const masteryBonus = Math.round(getCardMasteryBonus(entry.level) * 100);
  const abilityName = card.abilityName ?? card.description;
  const abilityDescription = card.abilityDescription ?? card.description;
  const locked = entry.level === 0;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [cardId]);

  return (
    <section
      className={`collection-intel-panel category-${card.category}${locked ? ' is-locked' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="collection-intel-title"
      aria-describedby="collection-intel-description"
    >
      <header>
        <span>
          <small>VAULT CARD</small>
          <h2 id="collection-intel-title">{card.shortName}</h2>
        </span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close card intel">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>
        </button>
      </header>

      <div className="collection-intel-status">
        <span className={`collection-intel-lock${locked ? '' : ' is-online'}`}>
          {locked ? <LockIcon /> : <i aria-hidden="true" />}
          {locked ? 'LOCKED' : `MASTERY MK ${entry.level}`}
        </span>
        <span>{TECH_CLASS_LABELS[card.techClass]}</span>
      </div>

      <span
        className={`collection-intel-portrait portrait-${card.sheet}`}
        style={getCardSpriteStyle(card.sheet, card.frame)}
        aria-hidden="true"
      />

      <div className="collection-intel-ability" id="collection-intel-description">
        <small>ABILITY</small>
        <strong>{abilityName.toUpperCase()}</strong>
        <p>{abilityDescription}</p>
      </div>

      <div className="collection-intel-fragments">
        <span><small>FRAGMENTS</small><strong>{requirement === null ? 'MAX' : `${entry.copies} / ${requirement}`}</strong></span>
        <i aria-hidden="true"><b style={{ width: `${progress * 100}%` }} /></i>
        <p>
          {requirement === null
            ? 'MASTERY COMPLETE'
            : locked
              ? `${Math.max(0, requirement - entry.copies)} MORE TO UNLOCK`
              : `${Math.max(0, requirement - entry.copies)} MORE TO MK ${entry.level + 1}`}
        </p>
      </div>

      <div className="collection-intel-mastery">
        <span><small>MASTERY</small><strong>{locked ? 'OFFLINE' : `+${masteryBonus}% OUTPUT / INTEGRITY`}</strong></span>
        <div aria-label={locked ? 'Card locked' : `Mastery Mark ${entry.level} of 5`}>
          {Array.from({ length: 5 }, (_, index) => (
            <i className={entry.level > index ? 'is-active' : ''} key={index}>
              <span aria-hidden="true" />
              <small>MK {index + 1}</small>
            </i>
          ))}
        </div>
      </div>
    </section>
  );
}
