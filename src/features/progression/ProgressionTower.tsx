import { useEffect, useId, useMemo, useRef, type CSSProperties } from 'react';
import {
  ARENA_BOARD_UNLOCKS,
  getArenaBoardUnlockForLevel,
  type ArenaBoardTheme,
} from '../../game/core/levelMilestones';
import {
  getFirmwareBudgetForLevel,
  getXpForLevel,
  MAX_PLAYER_LEVEL,
} from '../../game/core/progression';
import './progressionTower.css';

interface ProgressionTowerProps {
  playerLevel: number;
  playerXp: number;
  onClose: () => void;
}

interface TowerMilestone {
  level: number;
  side: 'left' | 'right';
  title: string;
  label: string;
  detail?: string;
  boardTheme?: ArenaBoardTheme;
}

const BOARD_PATHS: Readonly<Record<ArenaBoardTheme, string>> = {
  foundry: 'assets/game/arena-board-long.webp',
  sewer: 'assets/game/arena-board-sewer.webp',
  volcanic: 'assets/game/arena-board-volcanic.webp',
  orbital: 'assets/game/arena-board-orbital.webp',
  alien: 'assets/game/arena-board-alien.webp',
};

const TOWER_MILESTONES: readonly TowerMilestone[] = [
  { level: 1, side: 'left', title: 'FOUNDRY GRID', label: 'STARTING ARENA', detail: '6 FIRMWARE', boardTheme: 'foundry' },
  { level: 3, side: 'right', title: '+1 FIRMWARE', label: 'ABILITY CAPACITY', detail: 'Upgrade another robot ability tier.' },
  { level: 5, side: 'left', title: '+1 FIRMWARE', label: 'ABILITY CAPACITY', detail: 'Upgrade another robot ability tier.' },
  { level: 6, side: 'left', title: 'TOXIC CONDUIT', label: 'NEW ARENA', boardTheme: 'sewer' },
  { level: 7, side: 'right', title: '+1 FIRMWARE', label: 'ABILITY CAPACITY', detail: 'Upgrade another robot ability tier.' },
  { level: 9, side: 'right', title: '+1 FIRMWARE', label: 'ABILITY CAPACITY', detail: 'Upgrade another robot ability tier.' },
  { level: 11, side: 'left', title: 'VOLCANIC DEPTHS', label: 'NEW ARENA', detail: '+1 FIRMWARE', boardTheme: 'volcanic' },
  { level: 13, side: 'right', title: '+1 FIRMWARE · MAX 12', label: 'MAX CAPACITY', detail: 'Maximum lobby firmware capacity.' },
  { level: 20, side: 'left', title: 'VOID ASCENT', label: 'NEW ARENA', boardTheme: 'orbital' },
  { level: 40, side: 'left', title: 'XENO OVERGROWTH', label: 'NEW ARENA · MAX LEVEL', detail: 'Ascension Tower complete.', boardTheme: 'alien' },
];

const milestoneByLevel = new Map(TOWER_MILESTONES.map((milestone) => [milestone.level, milestone]));
function TowerIcon() {
  return (
    <svg className="progression-tower-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 42h32M14 42V24h6v18m8 0V14h6v28M20 42V8h8v34M24 3v5" />
    </svg>
  );
}

function FirmwareIcon() {
  return (
    <svg className="progression-firmware-icon" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="12" y="12" width="24" height="24" rx="2" />
      <rect x="18" y="18" width="12" height="12" />
      <path d="M17 5v7m7-7v7m7-7v7M17 36v7m7-7v7m7-7v7M5 17h7m-7 7h7m-7 7h7m24-14h7m-7 7h7m-7 7h7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

function MilestoneCard({ milestone }: { milestone: TowerMilestone }) {
  const base = import.meta.env.BASE_URL;
  return (
    <div className={`progression-milestone${milestone.boardTheme ? ' has-board' : ''}`}>
      {milestone.boardTheme && (
        <img
          src={`${base}${BOARD_PATHS[milestone.boardTheme]}`}
          alt={`${milestone.title} arena`}
        />
      )}
      <span>
        <strong>{milestone.title}</strong>
        <small>{milestone.label}</small>
        {milestone.detail && <em>{milestone.detail}</em>}
      </span>
    </div>
  );
}

export function ProgressionTower({ playerLevel, playerXp, onClose }: ProgressionTowerProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const currentNodeRef = useRef<HTMLDivElement>(null);
  const normalizedLevel = Math.min(MAX_PLAYER_LEVEL, Math.max(1, Math.floor(playerLevel)));
  const currentLevelXp = getXpForLevel(normalizedLevel);
  const nextLevelXp = getXpForLevel(Math.min(MAX_PLAYER_LEVEL, normalizedLevel + 1));
  const earnedThisLevel = Math.max(0, playerXp - currentLevelXp);
  const xpTarget = Math.max(0, nextLevelXp - currentLevelXp);
  const xpProgress = normalizedLevel === MAX_PLAYER_LEVEL
    ? 1
    : Math.min(1, earnedThisLevel / Math.max(1, xpTarget));
  const currentArena = getArenaBoardUnlockForLevel(normalizedLevel);
  const nextMilestone = useMemo(
    () => TOWER_MILESTONES.find((milestone) => milestone.level > normalizedLevel) ?? null,
    [normalizedLevel],
  );
  const visibleLevels = useMemo(() => (
    [...new Set([...TOWER_MILESTONES.map((milestone) => milestone.level), normalizedLevel])]
      .sort((a, b) => b - a)
  ), [normalizedLevel]);
  const currentArenaPath = `${import.meta.env.BASE_URL}${BOARD_PATHS[currentArena.theme]}`;
  const progressStyle = { '--tower-xp-progress': `${xpProgress * 100}%` } as CSSProperties;

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
    const timeline = timelineRef.current;
    const currentNode = currentNodeRef.current;
    if (timeline && currentNode) {
      timeline.scrollTop = Math.max(
        0,
        currentNode.offsetTop - (timeline.clientHeight - currentNode.clientHeight) / 2,
      );
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = closeButtonRef.current?.closest<HTMLElement>('[role="dialog"]');
      const focusable = panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="progression-tower-overlay" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="progression-tower-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="progression-tower-header">
          <TowerIcon />
          <h2 id={titleId}>ASCENSION TOWER</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Ascension Tower">
            <CloseIcon />
          </button>
        </header>

        <div className="progression-tower-xp" style={progressStyle}>
          <strong>LEVEL {normalizedLevel}</strong>
          <span>{normalizedLevel === MAX_PLAYER_LEVEL ? 'MAX LEVEL' : `${earnedThisLevel.toLocaleString()} / ${xpTarget.toLocaleString()} XP`}</span>
          <i aria-hidden="true"><b /></i>
        </div>

        <div className="progression-tower-body">
          <div className="progression-timeline" ref={timelineRef} role="list" aria-label="Player level milestones">
            <div className="progression-timeline-inner">
              {visibleLevels.map((level) => {
                const milestone = milestoneByLevel.get(level);
                const status = level < normalizedLevel ? 'complete' : level === normalizedLevel ? 'current' : 'future';
                return (
                  <div
                    className={`progression-level-row is-${status}${milestone ? ' has-milestone' : ''}`}
                    ref={level === normalizedLevel ? currentNodeRef : undefined}
                    role="listitem"
                    aria-label={`Level ${level}${level === normalizedLevel ? ', current level' : level < normalizedLevel ? ', complete' : ', locked'}`}
                    key={level}
                  >
                    <div className="progression-reward is-left">
                      {milestone?.side === 'left' && <MilestoneCard milestone={milestone} />}
                    </div>
                    <div className="progression-node-column" aria-hidden="true">
                      <span className="progression-level-node">{level}</span>
                    </div>
                    <div className="progression-reward is-right">
                      {level === normalizedLevel && <span className="progression-current-label">CURRENT LEVEL</span>}
                      {milestone?.side === 'right' && <MilestoneCard milestone={milestone} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="progression-tower-summary" aria-label="Current progression status">
            <section className="progression-current-arena">
              <h3>CURRENT ARENA</h3>
              <img src={currentArenaPath} alt={`${currentArena.name} arena board`} />
              <strong>{currentArena.name}</strong>
              <span>UNLOCKED AT LEVEL {currentArena.level}</span>
            </section>

            <section className="progression-capacity">
              <FirmwareIcon />
              <span>
                <strong>{getFirmwareBudgetForLevel(normalizedLevel)} FIRMWARE CAPACITY</strong>
                <small>Upgrade robot Output, Range, and Speed from the lobby Robot Lab.</small>
              </span>
            </section>

            <section className="progression-next-unlock">
              <h3>{nextMilestone ? `NEXT UNLOCK · LEVEL ${nextMilestone.level}` : 'TOWER COMPLETE'}</h3>
              {nextMilestone ? (
                <div>
                  {nextMilestone.boardTheme ? (
                    <img
                      src={`${import.meta.env.BASE_URL}${BOARD_PATHS[nextMilestone.boardTheme]}`}
                      alt=""
                    />
                  ) : <FirmwareIcon />}
                  <span>
                    <strong>{nextMilestone.title}</strong>
                    <small>{nextMilestone.detail ?? nextMilestone.label}</small>
                  </span>
                </div>
              ) : <p>All Ascension Tower milestones reached.</p>}
            </section>

            <span className="progression-arena-count">
              {ARENA_BOARD_UNLOCKS.filter((unlock) => unlock.level <= normalizedLevel).length} / {ARENA_BOARD_UNLOCKS.length} ARENAS ONLINE
            </span>
          </aside>
        </div>

        <footer className="progression-tower-footer"><kbd>ESC</kbd><span>TO CLOSE</span></footer>
      </section>
    </div>
  );
}
