import type { CSSProperties } from 'react';
import type { CardId, MatchSnapshot, RobotCardId, UpgradeStat } from '../../game/core/types';
import { GAME_MODES } from '../../game/core/content';
import { PILOTS, type PilotId } from '../../game/core/pilots';
import { PilotMark } from '../pilots/PilotMark';
import { CardHand } from './CardHand';
import { RobotStatsDialog } from './RobotStatsDialog';

interface HudProps {
  snapshot: MatchSnapshot;
  pilotId: PilotId;
  sfxMuted: boolean;
  onSelect: (cardId: CardId) => void;
  onBeginDrag: (cardId: CardId, clientX: number, clientY: number) => void;
  onCancelDrag: () => void;
  inspectedRobot: RobotCardId | null;
  onInspectRobot: (robotId: RobotCardId, trigger: HTMLButtonElement) => void;
  onCloseRobotStats: () => void;
  onUpgradeRobot: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onActivateOverdrive: () => void;
  onTogglePause: () => void;
  onToggleSfxMute: () => void;
  blocked: boolean;
}

function formatClock(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function SoundIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="m17 9 4 6m0-6-4 6" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9c1.4 1.6 1.4 4.4 0 6m2.8-8.8c3 3.2 3 8.4 0 11.6" /></svg>
  );
}

const STAGE_LABELS = {
  opening: 'OPENING · CHARGE +25%',
  'relay-war': 'RELAY WAR',
  'core-surge': 'CORE SURGE · CHARGE ×2',
} as const;

export function Hud({
  snapshot,
  pilotId,
  sfxMuted,
  onSelect,
  onBeginDrag,
  onCancelDrag,
  inspectedRobot,
  onInspectRobot,
  onCloseRobotStats,
  onUpgradeRobot,
  onActivateOverdrive,
  onTogglePause,
  onToggleSfxMute,
  blocked,
}: HudProps) {
  const pilot = PILOTS[pilotId];

  return (
    <div className="hud-layer" inert={blocked ? true : undefined} aria-hidden={blocked || undefined}>
      <header className="match-header">
        <div className="pilot pilot-player" style={{ '--pilot-accent': pilot.accent } as CSSProperties}>
          <PilotMark pilotId={pilotId} className="pilot-mark" />
          <strong>{pilot.name}</strong>
          <span className="score-node" aria-label={`${snapshot.score.player} Data Points`}>{snapshot.score.player}</span>
          <span className="match-points" aria-label={`${snapshot.battleScore.player} battle score`}>{snapshot.battleScore.player.toLocaleString()} PTS</span>
        </div>

        <div className={`match-clock${snapshot.chargeOverclock ? ' is-charge-overclock' : ''}`} aria-label={`${formatClock(snapshot.remainingMs)} remaining`}>
          <time>{formatClock(snapshot.remainingMs)}</time>
          <span>{STAGE_LABELS[snapshot.stage]} · {GAME_MODES[snapshot.modeId].shortName}</span>
        </div>

        <div className="pilot pilot-enemy">
          <span className="score-node" aria-label={`${snapshot.score.enemy} enemy Data Points`}>{snapshot.score.enemy}</span>
          <span className="match-points" aria-label={`${snapshot.battleScore.enemy} enemy battle score`}>{snapshot.battleScore.enemy.toLocaleString()} PTS</span>
          <strong>KERNEL-X</strong>
          <span className="pilot-mark"><i /></span>
        </div>
      </header>

      {snapshot.guidance && snapshot.phase === 'playing' && (
        <div className="guidance-toast" role="status">{snapshot.guidance}</div>
      )}

      {inspectedRobot && (
        <RobotStatsDialog
          snapshot={snapshot}
          robotId={inspectedRobot}
          onClose={onCloseRobotStats}
          onUpgrade={onUpgradeRobot}
        />
      )}

      <CardHand
        snapshot={snapshot}
        onSelect={onSelect}
        onBeginDrag={onBeginDrag}
        onCancelDrag={onCancelDrag}
        onInspectRobot={onInspectRobot}
        onActivateOverdrive={onActivateOverdrive}
      />

      <button
        className="utility-button sound-button"
        type="button"
        onClick={onToggleSfxMute}
        aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
        aria-pressed={sfxMuted}
        title="Sound effects mute (Shift+M)"
        data-testid="sfx-mute-toggle"
      >
        <SoundIcon muted={sfxMuted} />
      </button>
      <button className="utility-button pause-button" type="button" onClick={onTogglePause} disabled={snapshot.phase === 'menu' || snapshot.phase === 'ended'} aria-label={snapshot.phase === 'paused' ? 'Resume game' : 'Pause game'}>
        {snapshot.phase === 'paused' ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" /></svg>
        )}
      </button>
    </div>
  );
}
