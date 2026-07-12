import type { CSSProperties } from 'react';
import { getCardSpriteStyle, TECH_CLASS_LABELS } from '../cards/cardPresentation';
import { getRobotUpgradeBadgeInfo, UpgradeBadge } from '../cards/UpgradeBadge';
import { CARDS, MAX_CHARGE } from '../../game/core/content';
import type {
  CardCategory,
  CardDefinition,
  CardId,
  MatchSnapshot,
  RobotCardId,
} from '../../game/core/types';

interface CardHandProps {
  snapshot: MatchSnapshot;
  onSelect: (cardId: CardId) => void;
  onBeginDrag: (cardId: CardId, clientX: number, clientY: number) => void;
  onCancelDrag: () => void;
  onInspectRobot: (robotId: RobotCardId, trigger: HTMLButtonElement) => void;
  onActivateOverdrive: () => void;
}

const CATEGORY_LABELS: Record<CardCategory, string> = {
  unit: 'UNIT',
  program: 'PROGRAM',
  installation: 'INSTALL',
  commander: 'COMMANDER',
};

function cardClass(card: CardDefinition): string {
  return `category-${card.category} tech-${card.techClass}`;
}

type OverdrivePresentation = {
  state: 'ready' | 'active' | 'cooldown' | 'disabled' | 'locked' | 'charging' | 'standby';
  status: string;
  detail: string;
};

function getOverdrivePresentation(snapshot: MatchSnapshot): OverdrivePresentation {
  const commander = snapshot.commander.player;
  if (commander.active) {
    const seconds = Math.max(1, Math.ceil(commander.remainingMs / 1000));
    return { state: 'active', status: `ACTIVE ${seconds}S`, detail: `${seconds} seconds remaining` };
  }
  if (commander.disabled) return { state: 'disabled', status: 'EMP LOCK', detail: 'Commander systems disabled' };
  if (!commander.deployed) return { state: 'locked', status: 'DEPLOY CMD', detail: 'Deploy VECTOR-9 first' };
  if (commander.cooldownMs > 0) {
    const seconds = Math.max(1, Math.ceil(commander.cooldownMs / 1000));
    return { state: 'cooldown', status: `COOLDOWN ${seconds}S`, detail: `${seconds} seconds of cooldown remaining` };
  }
  if (snapshot.charge.player + 0.001 < commander.cost) {
    return { state: 'charging', status: `NEED ${commander.cost} CHARGE`, detail: `Requires ${commander.cost} charge` };
  }
  if (commander.available) return { state: 'ready', status: 'SYSTEM READY', detail: 'Ready to activate' };
  return { state: 'standby', status: 'STANDBY', detail: 'Currently unavailable' };
}

export function CardHand({ snapshot, onSelect, onBeginDrag, onCancelDrag, onInspectRobot, onActivateOverdrive }: CardHandProps) {
  const charge = snapshot.charge.player;
  const interactive = snapshot.phase === 'playing';
  const nextCard = CARDS[snapshot.next.player];
  const nextIsRobot = nextCard.category === 'unit' || nextCard.category === 'commander';
  const nextUpgradeBadge = getRobotUpgradeBadgeInfo(
    nextIsRobot ? snapshot.upgrades.player[nextCard.id as RobotCardId] : undefined,
  );
  const nextUpgradeCopy = nextUpgradeBadge
    ? ` Upgraded to Mark ${nextUpgradeBadge.mark} with ${nextUpgradeBadge.tierPoints} installed ${nextUpgradeBadge.tierPoints === 1 ? 'tier' : 'tiers'}.`
    : '';
  const overdrive = getOverdrivePresentation(snapshot);
  const overdriveEnabled = interactive && snapshot.commander.player.available;

  return (
    <section className="command-rail" aria-label="Command card hand">
      <div className="cards">
        {snapshot.hands.player.map((cardId, index) => {
          const card = CARDS[cardId];
          const affordable = charge + 0.001 >= card.cost;
          const uniqueBlocked = card.category === 'commander' && snapshot.commander.player.deployed;
          const selected = snapshot.selected === cardId;
          const playable = interactive && affordable && !uniqueBlocked;
          const isRobot = card.category === 'unit' || card.category === 'commander';
          const upgradeBadge = getRobotUpgradeBadgeInfo(
            isRobot ? snapshot.upgrades.player[cardId as RobotCardId] : undefined,
          );
          const upgradeCopy = upgradeBadge
            ? ` Upgraded to Mark ${upgradeBadge.mark} with ${upgradeBadge.tierPoints} installed ${upgradeBadge.tierPoints === 1 ? 'tier' : 'tiers'}.`
            : '';
          const availability = uniqueBlocked
            ? ' Commander already deployed.'
            : affordable
              ? ''
              : ' Insufficient charge.';

          return (
            <article
              key={`${cardId}-${index}`}
              className={`command-card-slot ${cardClass(card)}${selected ? ' is-selected' : ''}`}
              data-card={cardId}
              data-category={card.category}
              data-tech={card.techClass}
            >
              <button
                className={`command-card${playable ? '' : ' is-locked'}`}
                type="button"
                onClick={() => onSelect(cardId)}
                onPointerDown={(event) => {
                  if (!playable) return;
                  onBeginDrag(cardId, event.clientX, event.clientY);
                }}
                disabled={!interactive || uniqueBlocked}
                aria-pressed={selected}
                aria-label={`${index + 1}. ${card.name}, ${CATEGORY_LABELS[card.category].toLowerCase()}, ${TECH_CLASS_LABELS[card.techClass].toLowerCase()} tech, costs ${card.cost} charge.${upgradeCopy} ${card.description}.${availability}`}
              >
                <span className="card-cost" aria-hidden="true">{card.cost}</span>
                <UpgradeBadge info={upgradeBadge} className="card-upgrade-badge" />
                <span className="card-tech">{TECH_CLASS_LABELS[card.techClass]}</span>
                <span className={`card-portrait portrait-${card.sheet}`} style={getCardSpriteStyle(card.sheet, card.frame)} aria-hidden="true" />
                <span className="card-meta">
                  <strong>{card.shortName}</strong>
                  <span className="card-category">{CATEGORY_LABELS[card.category]}</span>
                </span>
              </button>
              {isRobot && (
                <button
                  className="card-lab-button"
                  type="button"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onCancelDrag();
                  }}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => onInspectRobot(cardId as RobotCardId, event.currentTarget)}
                  aria-label={`Open Robot Lab for ${card.name}`}
                >
                  LAB
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div
        className={`next-card ${cardClass(nextCard)}`}
        aria-label={`Next card: ${nextCard.name}, ${CATEGORY_LABELS[nextCard.category].toLowerCase()}, ${TECH_CLASS_LABELS[nextCard.techClass].toLowerCase()} tech.${nextUpgradeCopy}`}
      >
        <span className="next-label">NEXT</span>
        <UpgradeBadge info={nextUpgradeBadge} className="next-card-upgrade-badge" />
        <span className="next-tech">{TECH_CLASS_LABELS[nextCard.techClass]}</span>
        <i className={`card-portrait next-portrait portrait-${nextCard.sheet}`} style={getCardSpriteStyle(nextCard.sheet, nextCard.frame)} aria-hidden="true" />
        <span className="next-meta">
          <strong>{nextCard.shortName}</strong>
          <span className="card-category">{CATEGORY_LABELS[nextCard.category]}</span>
        </span>
      </div>

      <button
        className={`overdrive-control is-${overdrive.state}`}
        type="button"
        onClick={onActivateOverdrive}
        disabled={!overdriveEnabled}
        aria-label={`Commander Overdrive, costs ${snapshot.commander.player.cost} charge. ${overdrive.detail}.`}
        data-testid="commander-overdrive"
      >
        <span className="overdrive-cost" aria-hidden="true">{snapshot.commander.player.cost}</span>
        <span className="overdrive-portrait" style={getCardSpriteStyle('system', 5)} aria-hidden="true" />
        <strong>OVERDRIVE</strong>
        <span className="overdrive-status">{overdrive.status}</span>
      </button>

      <div
        className={`charge-bank${snapshot.chargeOverclock ? ' is-overclocked' : ''}`}
        role="meter"
        aria-label="Player charge"
        aria-valuemin={0}
        aria-valuemax={MAX_CHARGE}
        aria-valuenow={Number(charge.toFixed(2))}
        aria-valuetext={`${charge.toFixed(1)} of ${MAX_CHARGE} charge${snapshot.chargeOverclock ? ', double regeneration active' : ''}`}
      >
        <div className="charge-copy">
          <strong>CHARGE {snapshot.chargeOverclock && <em>×2</em>}</strong>
          <span>{Math.floor(charge)}</span>
        </div>
        <div className="charge-segments" aria-hidden="true">
          {Array.from({ length: MAX_CHARGE }, (_, index) => {
            const amount = Math.max(0, Math.min(1, charge - index));
            return <i key={index} style={{ '--fill': amount } as CSSProperties} />;
          })}
        </div>
      </div>
    </section>
  );
}
