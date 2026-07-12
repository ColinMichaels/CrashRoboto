import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { getCardSpriteStyle } from '../cards/cardPresentation';
import { CARDS, DECK_SIZE, GAME_MODE_IDS, GAME_MODES, LOBBY_FIRMWARE_BUDGET } from '../../game/core/content';
import { PILOTS, PILOT_IDS, type PilotId } from '../../game/core/pilots';
import type {
  CardCategory,
  CardDefinition,
  CardId,
  GameModeId,
  RobotCardId,
  RobotUpgradeState,
  UpgradeStat,
} from '../../game/core/types';
import { RobotStatsDialog } from '../hud/RobotStatsDialog';
import { PilotMark } from '../pilots/PilotMark';
import './lobby.css';

export interface LobbyProps {
  selectedMode: GameModeId;
  selectedDeck: CardId[];
  selectedPilot: PilotId;
  upgrades: Record<RobotCardId, RobotUpgradeState>;
  firmwareRemaining: number;
  onSelectMode: (mode: GameModeId) => void;
  onSelectPilot: (pilotId: PilotId) => void;
  onToggleCard: (cardId: CardId) => void;
  onRemoveCard: (cardId: CardId) => void;
  onUpgradeRobot: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onDowngradeRobot: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onReset: () => void;
  onLaunch: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const CATEGORY_LABELS: Record<CardCategory, string> = {
  unit: 'UNITS',
  program: 'PROGRAMS',
  installation: 'INSTALLATIONS',
  commander: 'COMMANDER',
};

const MODE_META: Record<GameModeId, string> = {
  'core-siege': 'BALANCED',
  'turbo-grid': 'HIGH CHARGE',
  'relay-rush': 'FIRST TO 2',
};

const LOBBY_CARDS = Object.values(CARDS);

function formatDuration(durationMs: number): string {
  const seconds = Math.round(durationMs / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function LogoMark() {
  return (
    <svg className="lobby-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M23 8h18l10 10v28L41 56H23L13 46V18z" />
      <path d="M32 12v19m-10-8a15 15 0 1 0 20 0" />
    </svg>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="m17 9 4 6m0-6-4 6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16 9c1.4 1.6 1.4 4.4 0 6m2.8-8.8c3 3.2 3 8.4 0 11.6" />
    </svg>
  );
}

function ModeIcon({ mode }: { mode: GameModeId }) {
  if (mode === 'turbo-grid') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="m28 4-17 24h11l-2 16 17-25H26z" />
      </svg>
    );
  }

  if (mode === 'relay-rush') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M14 43V7m1 2c10-7 13 7 23 0v20c-10 7-13-7-23 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="13" />
      <circle cx="24" cy="24" r="4" />
      <path d="M24 3v9m0 24v9M3 24h9m24 0h9" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8V3m0 0h5M5 3l3.4 3.4A7 7 0 1 1 5 12" />
    </svg>
  );
}

interface CardChipProps {
  card: CardDefinition;
  selected?: boolean;
  selectedIndex?: number;
  disabled?: boolean;
  variant: 'loadout' | 'archive';
  onClick: () => void;
  onInspect?: (trigger: HTMLButtonElement) => void;
}

function CardChip({ card, selected = false, selectedIndex, disabled = false, variant, onClick, onInspect }: CardChipProps) {
  const selectionCopy = selectedIndex === undefined ? '' : ` Selected in loadout slot ${selectedIndex + 1}.`;
  const actionCopy = variant === 'loadout'
    ? ' Activate to remove from the loadout.'
    : selected
      ? ' Activate to remove from the loadout.'
      : disabled
        ? ' Loadout is full.'
        : ' Activate to add to the loadout.';

  return (
    <div className={`lobby-card-shell lobby-card-shell-${variant} category-${card.category}`}>
      <button
        className={`lobby-card lobby-card-${variant} category-${card.category}${selected ? ' is-selected' : ''}`}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={variant === 'archive' ? selected : undefined}
        aria-label={`${card.name}, ${CATEGORY_LABELS[card.category].toLowerCase()}, costs ${card.cost} charge.${selectionCopy}${actionCopy}`}
        title={`${card.name} — ${card.description}`}
      >
        <span className="lobby-card-cost" aria-hidden="true">{card.cost}</span>
        {variant === 'loadout' && selectedIndex !== undefined && (
          <span className="lobby-card-order" aria-hidden="true">{String(selectedIndex + 1).padStart(2, '0')}</span>
        )}
        <span
          className={`lobby-card-portrait portrait-${card.sheet}`}
          style={getCardSpriteStyle(card.sheet, card.frame)}
          aria-hidden="true"
        />
        <span className="lobby-card-name">{card.shortName}</span>
        {selected && variant === 'archive' && !onInspect && <span className="lobby-card-check" aria-hidden="true">✓</span>}
      </button>
      {onInspect && (
        <button
          className="lobby-card-lab-button"
          type="button"
          onClick={(event) => onInspect(event.currentTarget)}
          aria-label={`Open lobby Robot Lab for ${card.name}`}
        >
          LAB
        </button>
      )}
    </div>
  );
}

function EmptyLoadoutSlot({ index }: { index: number }) {
  return (
    <div className="lobby-card lobby-card-loadout is-empty" aria-label={`Loadout slot ${index + 1}, empty`}>
      <span className="empty-slot-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="empty-slot-mark" aria-hidden="true" />
      <span className="lobby-card-name">EMPTY</span>
    </div>
  );
}

export function Lobby({
  selectedMode,
  selectedDeck,
  selectedPilot,
  upgrades,
  firmwareRemaining,
  onSelectMode,
  onSelectPilot,
  onToggleCard,
  onRemoveCard,
  onUpgradeRobot,
  onDowngradeRobot,
  onReset,
  onLaunch,
  muted,
  onToggleMute,
}: LobbyProps) {
  const modeHeadingId = useId();
  const launchHintId = useId();
  const pilotHeadingId = useId();
  const pilotTriggerRef = useRef<HTMLButtonElement>(null);
  const labTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [pilotMenuOpen, setPilotMenuOpen] = useState(false);
  const [inspectedRobot, setInspectedRobot] = useState<RobotCardId | null>(null);
  const deckFull = selectedDeck.length === DECK_SIZE;
  const averageCharge = useMemo(() => {
    if (selectedDeck.length === 0) return '0.0';
    const total = selectedDeck.reduce((sum, cardId) => sum + CARDS[cardId].cost, 0);
    return (total / selectedDeck.length).toFixed(1);
  }, [selectedDeck]);
  const selectedModeDefinition = GAME_MODES[selectedMode];
  const selectedPilotDefinition = PILOTS[selectedPilot];
  const lobbyStyle = {
    '--lobby-arena': `url("${import.meta.env.BASE_URL}assets/game/arena-board-perspective.png")`,
  } as CSSProperties;

  useEffect(() => {
    if (!pilotMenuOpen && !inspectedRobot) return undefined;
    const closeOverlay = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (inspectedRobot) {
        setInspectedRobot(null);
        window.requestAnimationFrame(() => labTriggerRef.current?.focus({ preventScroll: true }));
      } else {
        setPilotMenuOpen(false);
        window.requestAnimationFrame(() => pilotTriggerRef.current?.focus({ preventScroll: true }));
      }
    };
    window.addEventListener('keydown', closeOverlay);
    return () => window.removeEventListener('keydown', closeOverlay);
  }, [inspectedRobot, pilotMenuOpen]);

  const chooseMode = (modeId: GameModeId) => {
    onSelectMode(modeId);
    setAnnouncement(`${GAME_MODES[modeId].name} selected.`);
  };

  const choosePilot = (pilotId: PilotId) => {
    onSelectPilot(pilotId);
    setPilotMenuOpen(false);
    setAnnouncement(`${PILOTS[pilotId].name} selected as active pilot.`);
    window.requestAnimationFrame(() => pilotTriggerRef.current?.focus({ preventScroll: true }));
  };

  const inspectRobot = (robotId: RobotCardId, trigger: HTMLButtonElement) => {
    labTriggerRef.current = trigger;
    setPilotMenuOpen(false);
    setInspectedRobot(robotId);
    setAnnouncement(`${CARDS[robotId].name} opened in the lobby Robot Lab.`);
  };

  const closeRobotLab = () => {
    setInspectedRobot(null);
    window.requestAnimationFrame(() => labTriggerRef.current?.focus({ preventScroll: true }));
  };

  const navigateModes = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = GAME_MODE_IDS.length - 1;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;
    if (nextIndex === null) return;

    event.preventDefault();
    const group = event.currentTarget.parentElement;
    chooseMode(GAME_MODE_IDS[nextIndex]);
    window.requestAnimationFrame(() => {
      group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
    });
  };

  const toggleArchiveCard = (cardId: CardId) => {
    const selectedIndex = selectedDeck.indexOf(cardId);
    const card = CARDS[cardId];
    onToggleCard(cardId);
    setAnnouncement(selectedIndex >= 0
      ? `${card.name} removed. ${Math.max(0, selectedDeck.length - 1)} of ${DECK_SIZE} chips selected.`
      : `${card.name} added to slot ${selectedDeck.length + 1}. ${selectedDeck.length + 1} of ${DECK_SIZE} chips selected.`);
  };

  const removeLoadoutCard = (cardId: CardId, index: number) => {
    const card = CARDS[cardId];
    onRemoveCard(cardId);
    setAnnouncement(`${card.name} removed from slot ${index + 1}. ${Math.max(0, selectedDeck.length - 1)} of ${DECK_SIZE} chips selected.`);
  };

  const resetLoadout = () => {
    onReset();
    setAnnouncement('Loadout reset to the standard eight-chip configuration.');
  };

  return (
    <section className="lobby-screen" style={lobbyStyle} aria-labelledby="lobby-title">
      <div className="lobby-header">
        <div className="lobby-brand">
          <LogoMark />
          <h1 id="lobby-title">CRASH ROBOTO</h1>
        </div>
        <div className="lobby-pilot">
          <button
            className="lobby-sound-button"
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            aria-pressed={muted}
          >
            <SoundIcon muted={muted} />
          </button>
          <button
            ref={pilotTriggerRef}
            className="lobby-pilot-selector"
            style={{ '--pilot-accent': selectedPilotDefinition.accent } as CSSProperties}
            type="button"
            onClick={() => setPilotMenuOpen((open) => !open)}
            aria-expanded={pilotMenuOpen}
            aria-haspopup="dialog"
            aria-controls="lobby-pilot-menu"
            aria-label={`Active pilot ${selectedPilotDefinition.name}. Choose a pilot.`}
          >
            <span className="lobby-pilot-copy">
              <small>ACTIVE PILOT</small>
              <strong>{selectedPilotDefinition.name}</strong>
            </span>
            <PilotMark pilotId={selectedPilot} className="lobby-pilot-mark" />
            <svg className="lobby-pilot-chevron" viewBox="0 0 18 12" aria-hidden="true"><path d="m2 2 7 7 7-7" /></svg>
          </button>
        </div>

        {pilotMenuOpen && (
          <section
            id="lobby-pilot-menu"
            className="lobby-pilot-menu"
            role="dialog"
            aria-modal="false"
            aria-labelledby={pilotHeadingId}
          >
            <div className="lobby-pilot-menu-heading">
              <span>
                <small>COMMAND CREW</small>
                <strong id={pilotHeadingId}>SELECT PILOT</strong>
              </span>
              <button type="button" onClick={() => setPilotMenuOpen(false)} aria-label="Close pilot selector">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>
              </button>
            </div>
            <div className="lobby-pilot-grid" role="radiogroup" aria-labelledby={pilotHeadingId}>
              {PILOT_IDS.map((pilotId) => {
                const pilot = PILOTS[pilotId];
                const selected = pilotId === selectedPilot;
                return (
                  <button
                    className={`lobby-pilot-option${selected ? ' is-selected' : ''}`}
                    style={{ '--pilot-accent': pilot.accent } as CSSProperties}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choosePilot(pilotId)}
                    key={pilotId}
                  >
                    <PilotMark pilotId={pilotId} className="lobby-pilot-option-mark" />
                    <span><strong>{pilot.name}</strong><small>{pilot.specialty}</small></span>
                    <i aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <aside className="lobby-protocol-panel" aria-labelledby={modeHeadingId}>
        <h2 id={modeHeadingId}>SELECT PROTOCOL</h2>
        <div className="lobby-mode-list" role="radiogroup" aria-labelledby={modeHeadingId}>
          {GAME_MODE_IDS.map((modeId, index) => {
            const mode = GAME_MODES[modeId];
            const selected = selectedMode === modeId;
            return (
              <button
                key={modeId}
                className={`lobby-mode${selected ? ' is-selected' : ''}`}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                aria-label={`${mode.name}. ${formatDuration(mode.durationMs)}. ${MODE_META[modeId]}. ${mode.description}`}
                onClick={() => chooseMode(modeId)}
                onKeyDown={(event) => navigateModes(event, index)}
              >
                <span className="lobby-mode-icon"><ModeIcon mode={modeId} /></span>
                <span className="lobby-mode-copy">
                  <strong>{mode.name}</strong>
                  <span>{formatDuration(mode.durationMs)} <i>•</i> {MODE_META[modeId]}</span>
                </span>
                <span className="lobby-mode-chevron" aria-hidden="true">
                  <svg viewBox="0 0 18 30"><path d="m3 3 11 12L3 27" /></svg>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="lobby-workspace">
        <section className="lobby-panel lobby-loadout-panel" aria-labelledby="active-loadout-title">
          <div className="lobby-panel-heading">
            <h2 id="active-loadout-title">ACTIVE LOADOUT</h2>
            <span>4 ONLINE <i>•</i> SHUFFLED ROTATION</span>
          </div>
          <div className="lobby-loadout-grid" role="list" aria-label={`Active loadout, ${selectedDeck.length} of ${DECK_SIZE} chips selected`}>
            {Array.from({ length: DECK_SIZE }, (_, index) => {
              const cardId = selectedDeck[index];
              const card = cardId ? CARDS[cardId] : null;
              return (
                <div className="lobby-loadout-item" role="listitem" key={cardId ?? `empty-${index}`}>
                  {cardId && card ? (
                    <CardChip
                      card={card}
                      selected
                      selectedIndex={index}
                      variant="loadout"
                      onClick={() => removeLoadoutCard(cardId, index)}
                      onInspect={card.category === 'unit' || card.category === 'commander'
                        ? (trigger) => inspectRobot(cardId as RobotCardId, trigger)
                        : undefined}
                    />
                  ) : <EmptyLoadoutSlot index={index} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="lobby-panel lobby-archive-panel" aria-labelledby="chip-archive-title">
          <div className="lobby-panel-heading">
            <h2 id="chip-archive-title">CHIP ARCHIVE</h2>
            <span>{LOBBY_CARDS.length} AVAILABLE</span>
          </div>
          <div className="lobby-archive-grid" role="list" aria-label="Available command chips">
            {LOBBY_CARDS.map((card) => {
              const selectedIndex = selectedDeck.indexOf(card.id);
              const selected = selectedIndex >= 0;
              const disabled = deckFull && !selected;
              return (
                <div className="lobby-archive-item" role="listitem" key={card.id}>
                  <CardChip
                    card={card}
                    selected={selected}
                    selectedIndex={selected ? selectedIndex : undefined}
                    disabled={disabled}
                    variant="archive"
                    onClick={() => toggleArchiveCard(card.id)}
                    onInspect={card.category === 'unit' || card.category === 'commander'
                      ? (trigger) => inspectRobot(card.id as RobotCardId, trigger)
                      : undefined}
                  />
                </div>
              );
            })}
          </div>
          <div className="lobby-category-legend" aria-label="Card category colors">
            {(Object.entries(CATEGORY_LABELS) as [CardCategory, string][]).map(([category, label]) => (
              <span className={`category-${category}`} key={category}><i />{label}</span>
            ))}
          </div>
        </section>
      </div>

      <footer className="lobby-command-bar">
        <div className="lobby-deck-count" aria-live="polite">
          <span className="lobby-online-mark" aria-hidden="true"><i /></span>
          <strong>{selectedDeck.length} / {DECK_SIZE}</strong>
          <span>CHIPS ONLINE</span>
        </div>
        <div
          className="lobby-average"
          aria-label={`Average card charge ${averageCharge}. ${LOBBY_FIRMWARE_BUDGET - firmwareRemaining} of ${LOBBY_FIRMWARE_BUDGET} lobby firmware points allocated.`}
        >
          <span className="lobby-metric"><small>AVG CHARGE</small><strong>{averageCharge}</strong></span>
          <span className="lobby-metric is-firmware"><small>FIRMWARE</small><strong>{LOBBY_FIRMWARE_BUDGET - firmwareRemaining}/{LOBBY_FIRMWARE_BUDGET}</strong></span>
        </div>
        <button className="lobby-reset-button" type="button" onClick={resetLoadout}>
          <ResetIcon />
          RESET
        </button>
        <button
          className="lobby-launch-button"
          type="button"
          onClick={onLaunch}
          disabled={!deckFull}
          aria-describedby={!deckFull ? launchHintId : undefined}
        >
          <span>DEPLOY LOADOUT</span>
          <ForwardIcon />
        </button>
        <span id={launchHintId} className="lobby-sr-only">
          {deckFull
            ? `${selectedModeDefinition.name} is ready to launch.`
            : `Select ${DECK_SIZE - selectedDeck.length} more ${DECK_SIZE - selectedDeck.length === 1 ? 'chip' : 'chips'} before launching.`}
        </span>
      </footer>

      {inspectedRobot && (
        <RobotStatsDialog
          context="lobby"
          robotId={inspectedRobot}
          upgrades={upgrades[inspectedRobot]}
          firmwareRemaining={firmwareRemaining}
          inLoadout={selectedDeck.includes(inspectedRobot)}
          onClose={closeRobotLab}
          onUpgrade={onUpgradeRobot}
          onDowngrade={onDowngradeRobot}
        />
      )}

      <div className="lobby-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </section>
  );
}
