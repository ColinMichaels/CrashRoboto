import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { getCardSpriteStyle } from '../cards/cardPresentation';
import { CardCollectionPanel } from '../cards/CardCollectionPanel';
import { getRobotUpgradeBadgeInfo, UpgradeBadge } from '../cards/UpgradeBadge';
import {
  CARDS,
  DECK_SIZE,
  GAME_MODE_IDS,
  GAME_MODES,
  TOWER_WEAPONS,
  TOWER_WEAPON_IDS,
} from '../../game/core/content';
import { getXpForLevel, MAX_PLAYER_LEVEL } from '../../game/core/progression';
import {
  getCardCopyRequirement,
  isCardUnlocked,
  type CardCollection,
  type CardCollectionEntry,
} from '../../game/core/collection';
import { DECK_PRESETS, getDeckGuidance, type DeckPresetId } from '../../game/core/deckGuidance';
import { PILOTS, PILOT_IDS, type PilotId } from '../../game/core/pilots';
import type {
  CardCategory,
  CardDefinition,
  CardId,
  GameModeId,
  Lane,
  RobotCardId,
  RobotUpgradeState,
  TowerWeaponId,
  TowerWeaponLoadout,
  UpgradeStat,
} from '../../game/core/types';
import { RobotStatsDialog } from '../hud/RobotStatsDialog';
import { PilotMark } from '../pilots/PilotMark';
import { ProgressionTower } from '../progression/ProgressionTower';
import './lobby.css';

export interface LobbyProps {
  selectedMode: GameModeId;
  selectedDeck: CardId[];
  selectedPilot: PilotId;
  upgrades: Record<RobotCardId, RobotUpgradeState>;
  towerWeapons: TowerWeaponLoadout;
  firmwareRemaining: number;
  firmwareBudget: number;
  playerLevel: number;
  playerXp: number;
  collection: CardCollection;
  onSelectMode: (mode: GameModeId) => void;
  onSelectPilot: (pilotId: PilotId) => void;
  onSelectTowerWeapon: (lane: Lane, weaponId: TowerWeaponId) => void;
  onToggleCard: (cardId: CardId) => void;
  onRemoveCard: (cardId: CardId) => void;
  onUpgradeRobot: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onDowngradeRobot: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onApplyDeckPreset: (presetId: DeckPresetId) => void;
  onStartTutorial: () => void;
  tutorialCompleted: boolean;
  onReset: () => void;
  launchPreparing: boolean;
  onPrepareLaunch: () => void;
  onLaunch: () => void;
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
  'best-of-three': 'FIRST TO 2',
};

const LOBBY_CARDS = Object.values(CARDS);
const RELAY_LANES: Lane[] = ['left', 'right'];

function formatDuration(durationMs: number): string {
  const seconds = Math.round(durationMs / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatModeDuration(modeId: GameModeId): string {
  const mode = GAME_MODES[modeId];
  const duration = formatDuration(mode.durationMs);
  return mode.series ? `${mode.series.maxRounds} × ${duration}` : duration;
}

function LogoMark() {
  return (
    <svg className="lobby-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M23 8h18l10 10v28L41 56H23L13 46V18z" />
      <path d="M32 12v19m-10-8a15 15 0 1 0 20 0" />
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

  if (mode === 'best-of-three') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="13" cy="24" r="6" />
        <circle cx="24" cy="13" r="6" />
        <circle cx="35" cy="24" r="6" />
        <path d="M13 30v8h22v-8M24 19v19" />
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
  upgrades?: RobotUpgradeState;
  collectionEntry: CardCollectionEntry;
  locked?: boolean;
  selected?: boolean;
  selectedIndex?: number;
  deckActionDisabled?: boolean;
  variant: 'loadout' | 'archive';
  onOpen: (trigger: HTMLButtonElement) => void;
  onDeckAction?: (trigger: HTMLButtonElement) => void;
  deckAction?: 'add' | 'remove';
}

function CardChip({ card, upgrades, collectionEntry, locked = false, selected = false, selectedIndex, deckActionDisabled = false, variant, onOpen, onDeckAction, deckAction }: CardChipProps) {
  const upgradeBadge = getRobotUpgradeBadgeInfo(upgrades);
  const copyRequirement = getCardCopyRequirement(collectionEntry.level);
  const masteryCopy = collectionEntry.level > 0 ? ` Permanent Mastery Mark ${collectionEntry.level}.` : '';
  const upgradeCopy = upgradeBadge
    ? ` Upgraded to Mark ${upgradeBadge.mark} with ${upgradeBadge.tierPoints} installed ${upgradeBadge.tierPoints === 1 ? 'tier' : 'tiers'}.`
    : '';
  const selectionCopy = selectedIndex === undefined ? '' : ` Selected in loadout slot ${selectedIndex + 1}.`;
  const actionCopy = locked
    ? ` Locked with ${collectionEntry.copies} of ${copyRequirement ?? 0} fragments. Activate to inspect.`
    : ' Activate to open card stats and mastery details.';
  const deckActionLabel = deckAction === 'remove'
    ? `Remove ${card.name} from the active loadout`
    : `Add ${card.name} to the active loadout`;

  return (
    <div className={`lobby-card-shell lobby-card-shell-${variant}${onDeckAction ? ' has-deck-action' : ''} category-${card.category}`}>
      <button
        className={`lobby-card lobby-card-${variant} category-${card.category}${selected ? ' is-selected' : ''}${locked ? ' is-vault-locked' : ''}`}
        type="button"
        onClick={(event) => onOpen(event.currentTarget)}
        aria-label={`${card.name}, ${CATEGORY_LABELS[card.category].toLowerCase()}, costs ${card.cost} charge.${masteryCopy}${upgradeCopy}${selectionCopy}${actionCopy}`}
        title={`${card.name} — ${card.description}`}
      >
        <span className="lobby-card-cost" aria-hidden="true">{card.cost}</span>
        <UpgradeBadge info={upgradeBadge} className="lobby-card-upgrade-badge" />
        {collectionEntry.level > 1 && <span className="lobby-card-mastery-badge" aria-hidden="true">MK {collectionEntry.level}</span>}
        {variant === 'loadout' && selectedIndex !== undefined && (
          <span className="lobby-card-order" aria-hidden="true">{String(selectedIndex + 1).padStart(2, '0')}</span>
        )}
        <span
          className={`lobby-card-portrait portrait-${card.sheet}`}
          style={getCardSpriteStyle(card.sheet, card.frame)}
          aria-hidden="true"
        />
        <span className="lobby-card-name">{card.shortName}</span>
        {locked && (
          <span className="lobby-card-lock" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5z" /><path d="M12 14v3" /></svg>
            <small>{collectionEntry.copies} / {copyRequirement}</small>
          </span>
        )}
      </button>
      {onDeckAction && deckAction && (
        <button
          className="lobby-card-deck-button"
          type="button"
          onClick={(event) => onDeckAction(event.currentTarget)}
          aria-label={deckActionLabel}
          disabled={deckActionDisabled}
        >
          {deckAction === 'remove' ? 'REMOVE' : 'ADD'}
        </button>
      )}
      {!onDeckAction && <span className="lobby-card-action-spacer" aria-hidden="true" />}
    </div>
  );
}

function EmptyLoadoutSlot({ index }: { index: number }) {
  return (
    <div className="lobby-card-shell lobby-card-shell-loadout">
      <div className="lobby-card lobby-card-loadout is-empty" aria-label={`Loadout slot ${index + 1}, empty`}>
        <span className="empty-slot-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="empty-slot-mark" aria-hidden="true" />
        <span className="lobby-card-name">EMPTY</span>
      </div>
      <span className="lobby-card-action-spacer" aria-hidden="true" />
    </div>
  );
}

function TowerWeaponButton({
  lane,
  weaponId,
  selected,
  onSelect,
}: {
  lane: Lane;
  weaponId: TowerWeaponId;
  selected: boolean;
  onSelect: () => void;
}) {
  const weapon = TOWER_WEAPONS[weaponId];
  const frameX = weapon.frame % 2 === 0 ? '0%' : '100%';
  const frameY = weapon.frame < 2 ? '0%' : '100%';
  const style = {
    '--tower-weapon-accent': weapon.accent,
    '--tower-frame-x': frameX,
    '--tower-frame-y': frameY,
  } as CSSProperties;

  return (
    <button
      className={`lobby-tower-weapon${selected ? ' is-selected' : ''}`}
      style={style}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${lane} Relay ${weapon.name}. ${weapon.damage} damage every ${weapon.attackInterval.toFixed(2)} seconds. ${weapon.range} range. ${weapon.description}`}
      title={`${weapon.name} — ${weapon.description}`}
      onClick={onSelect}
    >
      <span className="lobby-tower-sprite" aria-hidden="true" />
      <span className="lobby-tower-weapon-copy">
        <strong>{weapon.shortName}</strong>
        <small>{weapon.damage} DMG · {weapon.attackInterval.toFixed(2)}s</small>
      </span>
    </button>
  );
}

export function Lobby({
  selectedMode,
  selectedDeck,
  selectedPilot,
  upgrades,
  towerWeapons,
  firmwareRemaining,
  firmwareBudget,
  playerLevel,
  playerXp,
  collection,
  onSelectMode,
  onSelectPilot,
  onSelectTowerWeapon,
  onToggleCard,
  onRemoveCard,
  onUpgradeRobot,
  onDowngradeRobot,
  onApplyDeckPreset,
  onStartTutorial,
  tutorialCompleted,
  onReset,
  launchPreparing,
  onPrepareLaunch,
  onLaunch,
}: LobbyProps) {
  const modeHeadingId = useId();
  const launchHintId = useId();
  const pilotHeadingId = useId();
  const towerHeadingId = useId();
  const pilotTriggerRef = useRef<HTMLButtonElement>(null);
  const labTriggerRef = useRef<HTMLButtonElement | null>(null);
  const collectionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const progressionTriggerRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [pilotMenuOpen, setPilotMenuOpen] = useState(false);
  const [inspectedRobot, setInspectedRobot] = useState<RobotCardId | null>(null);
  const [inspectedCollectionCard, setInspectedCollectionCard] = useState<CardId | null>(null);
  const [progressionOpen, setProgressionOpen] = useState(false);
  const deckFull = selectedDeck.length === DECK_SIZE;
  const currentLevelXp = getXpForLevel(playerLevel);
  const nextLevelXp = getXpForLevel(Math.min(MAX_PLAYER_LEVEL, playerLevel + 1));
  const levelXp = playerXp - currentLevelXp;
  const levelXpTarget = Math.max(0, nextLevelXp - currentLevelXp);
  const deckGuidance = getDeckGuidance(selectedDeck);
  const collectionSummary = useMemo(() => {
    let unlocked = 0;
    let fragments = 0;
    let masteryMarks = 0;
    for (const cardId of Object.keys(collection) as CardId[]) {
      const entry = collection[cardId];
      if (entry.level > 0) unlocked += 1;
      fragments += entry.copies;
      masteryMarks += entry.level;
    }
    return { unlocked, fragments, masteryMarks };
  }, [collection]);
  const selectedModeDefinition = GAME_MODES[selectedMode];
  const selectedPilotDefinition = PILOTS[selectedPilot];
  const lobbyStyle = {
    '--lobby-arena': `url("${import.meta.env.BASE_URL}assets/game/arena-board-long.webp")`,
    '--tower-weapon-sprites': `url("${import.meta.env.BASE_URL}assets/game/relay-weapon-sprites.webp")`,
  } as CSSProperties;

  const closeProgression = useCallback(() => {
    setProgressionOpen(false);
    window.requestAnimationFrame(() => progressionTriggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const openProgression = () => {
    setPilotMenuOpen(false);
    setInspectedRobot(null);
    setInspectedCollectionCard(null);
    setProgressionOpen(true);
    setAnnouncement('Ascension Tower opened.');
  };

  useEffect(() => {
    if (!pilotMenuOpen && !inspectedRobot && !inspectedCollectionCard) return undefined;
    const closeOverlay = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (inspectedRobot) {
        setInspectedRobot(null);
        window.requestAnimationFrame(() => labTriggerRef.current?.focus({ preventScroll: true }));
      } else if (inspectedCollectionCard) {
        setInspectedCollectionCard(null);
        window.requestAnimationFrame(() => collectionTriggerRef.current?.focus({ preventScroll: true }));
      } else {
        setPilotMenuOpen(false);
        window.requestAnimationFrame(() => pilotTriggerRef.current?.focus({ preventScroll: true }));
      }
    };
    window.addEventListener('keydown', closeOverlay);
    return () => window.removeEventListener('keydown', closeOverlay);
  }, [inspectedCollectionCard, inspectedRobot, pilotMenuOpen]);

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

  const chooseTowerWeapon = (lane: Lane, weaponId: TowerWeaponId) => {
    onSelectTowerWeapon(lane, weaponId);
    setAnnouncement(`${lane === 'left' ? 'Left' : 'Right'} Relay upgraded to ${TOWER_WEAPONS[weaponId].name}.`);
  };

  const inspectRobot = (robotId: RobotCardId, trigger: HTMLButtonElement) => {
    labTriggerRef.current = trigger;
    setPilotMenuOpen(false);
    setInspectedCollectionCard(null);
    setInspectedRobot(robotId);
    setAnnouncement(`${CARDS[robotId].name} opened in the lobby Robot Lab.`);
  };

  const inspectCollectionCard = (cardId: CardId, trigger: HTMLButtonElement) => {
    collectionTriggerRef.current = trigger;
    setPilotMenuOpen(false);
    setInspectedRobot(null);
    setInspectedCollectionCard(cardId);
    const entry = collection[cardId];
    setAnnouncement(`${CARDS[cardId].name} card intel opened. ${entry.level === 0 ? `${entry.copies} fragments recovered.` : `Mastery Mark ${entry.level}.`}`);
  };

  const closeRobotLab = () => {
    setInspectedRobot(null);
    window.requestAnimationFrame(() => labTriggerRef.current?.focus({ preventScroll: true }));
  };

  const closeCollectionIntel = () => {
    setInspectedCollectionCard(null);
    window.requestAnimationFrame(() => collectionTriggerRef.current?.focus({ preventScroll: true }));
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
    if (!isCardUnlocked(collection, cardId)) return;
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
          <button className="lobby-training-button" type="button" onClick={onStartTutorial}>
            TRAINING{tutorialCompleted ? ' ✓' : ''}
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
            const durationLabel = formatModeDuration(modeId);
            return (
              <button
                key={modeId}
                className={`lobby-mode${selected ? ' is-selected' : ''}`}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                aria-label={`${mode.name}. ${durationLabel}. ${MODE_META[modeId]}. ${mode.description}`}
                onClick={() => chooseMode(modeId)}
                onKeyDown={(event) => navigateModes(event, index)}
              >
                <span className="lobby-mode-icon"><ModeIcon mode={modeId} /></span>
                <span className="lobby-mode-copy">
                  <strong>{mode.name}</strong>
                  <span>{durationLabel} <i>•</i> {MODE_META[modeId]}</span>
                </span>
                <span className="lobby-mode-chevron" aria-hidden="true">
                  <svg viewBox="0 0 18 30"><path d="m3 3 11 12L3 27" /></svg>
                </span>
              </button>
            );
          })}
        </div>
        <section className="lobby-tower-bay" aria-labelledby={towerHeadingId}>
          <div className="lobby-tower-bay-heading">
            <h2 id={towerHeadingId}>TOWER BAY</h2>
            <span>POWER ↑ · CYCLE ↓</span>
          </div>
          <div className="lobby-tower-loadout">
            {RELAY_LANES.map((lane) => (
              <div className="lobby-tower-row" key={lane}>
                <span className="lobby-tower-lane" aria-hidden="true">{lane === 'left' ? 'L' : 'R'}</span>
                <div className="lobby-tower-options" role="radiogroup" aria-label={`${lane} Relay weapon package`}>
                  {TOWER_WEAPON_IDS.map((weaponId) => (
                    <TowerWeaponButton
                      key={weaponId}
                      lane={lane}
                      weaponId={weaponId}
                      selected={towerWeapons[lane] === weaponId}
                      onSelect={() => chooseTowerWeapon(lane, weaponId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <div className="lobby-workspace">
        <section className="lobby-panel lobby-loadout-panel" aria-labelledby="active-loadout-title">
          <div className="lobby-panel-heading">
            <h2 id="active-loadout-title">ACTIVE LOADOUT</h2>
            <div className="lobby-deck-tools">
              <span className={deckGuidance[0].includes('READY') ? 'is-ready' : ''}>{deckGuidance[0]}</span>
              <div role="group" aria-label="Starter deck presets">
                {(Object.entries(DECK_PRESETS) as [DeckPresetId, (typeof DECK_PRESETS)[DeckPresetId]][]).map(([presetId, preset]) => (
                  <button key={presetId} type="button" onClick={() => onApplyDeckPreset(presetId)}>{preset.name}</button>
                ))}
              </div>
            </div>
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
                      collectionEntry={collection[cardId]}
                      upgrades={card.category === 'unit' || card.category === 'commander'
                        ? upgrades[cardId as RobotCardId]
                        : undefined}
                      selected
                      selectedIndex={index}
                      variant="loadout"
                      onOpen={(trigger) => card.category === 'unit' || card.category === 'commander'
                        ? inspectRobot(cardId as RobotCardId, trigger)
                        : inspectCollectionCard(cardId, trigger)}
                      deckAction="remove"
                      onDeckAction={() => removeLoadoutCard(cardId, index)}
                    />
                  ) : <EmptyLoadoutSlot index={index} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="lobby-panel lobby-archive-panel" aria-labelledby="chip-archive-title">
          <div className="lobby-panel-heading lobby-collection-heading">
            <div className="lobby-collection-heading-copy">
              <h2 id="chip-archive-title">CHIP COLLECTION</h2>
              <small>CARD ART OPENS INTEL · DECK BUTTON EDITS LOADOUT</small>
            </div>
            <div
              className="lobby-collection-ledger"
              aria-label={`${collectionSummary.unlocked} of ${LOBBY_CARDS.length} cards unlocked. ${collectionSummary.fragments} fragments banked. ${firmwareRemaining} of ${firmwareBudget} firmware available. ${collectionSummary.masteryMarks} total mastery marks.`}
            >
              <span><small>CARDS</small><strong>{collectionSummary.unlocked}/{LOBBY_CARDS.length}</strong></span>
              <span><small>FRAGMENTS</small><strong>{collectionSummary.fragments}</strong></span>
              <span className="is-firmware"><small>FIRMWARE READY</small><strong>{firmwareRemaining}/{firmwareBudget}</strong></span>
              <span><small>MASTERY</small><strong>{collectionSummary.masteryMarks}</strong></span>
            </div>
          </div>
          <div className="lobby-archive-grid" role="list" aria-label="Available command chips">
            {LOBBY_CARDS.map((card) => {
              const selectedIndex = selectedDeck.indexOf(card.id);
              const selected = selectedIndex >= 0;
              const locked = !isCardUnlocked(collection, card.id);
              const deckActionDisabled = deckFull && !selected && !locked;
              return (
                <div className="lobby-archive-item" role="listitem" key={card.id}>
                  <CardChip
                    card={card}
                    collectionEntry={collection[card.id]}
                    locked={locked}
                    upgrades={card.category === 'unit' || card.category === 'commander'
                      ? upgrades[card.id as RobotCardId]
                      : undefined}
                    selected={selected}
                    selectedIndex={selected ? selectedIndex : undefined}
                    deckActionDisabled={deckActionDisabled}
                    variant="archive"
                    onOpen={(trigger) => !locked && (card.category === 'unit' || card.category === 'commander')
                      ? inspectRobot(card.id as RobotCardId, trigger)
                      : inspectCollectionCard(card.id, trigger)}
                    deckAction={selected ? 'remove' : 'add'}
                    onDeckAction={locked ? undefined : () => toggleArchiveCard(card.id)}
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
        <button
          ref={progressionTriggerRef}
          className="lobby-average"
          type="button"
          onClick={openProgression}
          aria-haspopup="dialog"
          aria-expanded={progressionOpen}
          aria-label={`Player level ${playerLevel}. ${levelXp} of ${levelXpTarget} experience toward the next level. ${firmwareBudget - firmwareRemaining} of ${firmwareBudget} lobby firmware points allocated. Firmware capacity increases by one every two levels.`}
        >
          <span className="lobby-metric is-level"><small>LEVEL PATH</small><strong>{playerLevel}</strong></span>
          <span className="lobby-metric is-xp"><small>XP TO NEXT</small><strong>{playerLevel === MAX_PLAYER_LEVEL ? 'MAX' : `${levelXp}/${levelXpTarget}`}</strong></span>
          <span className="lobby-metric is-firmware"><small>FIRMWARE · +1/2 LVL</small><strong>{firmwareBudget - firmwareRemaining}/{firmwareBudget}</strong></span>
        </button>
        <button className="lobby-reset-button" type="button" onClick={resetLoadout}>
          <ResetIcon />
          RESET
        </button>
        <button
          className="lobby-launch-button"
          type="button"
          onPointerEnter={onPrepareLaunch}
          onFocus={onPrepareLaunch}
          onClick={onLaunch}
          disabled={!deckFull || launchPreparing}
          aria-busy={launchPreparing}
          aria-describedby={!deckFull ? launchHintId : undefined}
        >
          <span>{launchPreparing ? 'STAGING GRID…' : 'DEPLOY LOADOUT'}</span>
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
          cardLevel={collection[inspectedRobot].level || 1}
          firmwareRemaining={firmwareRemaining}
          inLoadout={selectedDeck.includes(inspectedRobot)}
          onClose={closeRobotLab}
          onUpgrade={onUpgradeRobot}
          onDowngrade={onDowngradeRobot}
        />
      )}

      {inspectedCollectionCard && (
        <CardCollectionPanel
          cardId={inspectedCollectionCard}
          entry={collection[inspectedCollectionCard]}
          onClose={closeCollectionIntel}
        />
      )}

      {progressionOpen && (
        <ProgressionTower
          playerLevel={playerLevel}
          playerXp={playerXp}
          onClose={closeProgression}
        />
      )}

      <div className="lobby-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </section>
  );
}
