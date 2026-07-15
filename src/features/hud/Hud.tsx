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
  onSelect: (cardId: CardId) => void;
  onBeginDrag: (cardId: CardId, clientX: number, clientY: number) => void;
  onCancelDrag: () => void;
  inspectedRobot: RobotCardId | null;
  onInspectRobot: (robotId: RobotCardId, trigger: HTMLButtonElement) => void;
  onCloseRobotStats: () => void;
  onUpgradeRobot: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onActivateOverdrive: () => void;
  onTogglePause: () => void;
  blocked: boolean;
}

function formatClock(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

const STAGE_LABELS = {
  opening: 'OPENING · CHARGE +25%',
  'relay-war': 'RELAY WAR',
  'core-surge': 'CORE SURGE · CHARGE ×2',
} as const;

export function Hud({
  snapshot,
  pilotId,
  onSelect,
  onBeginDrag,
  onCancelDrag,
  inspectedRobot,
  onInspectRobot,
  onCloseRobotStats,
  onUpgradeRobot,
  onActivateOverdrive,
  onTogglePause,
  blocked,
}: HudProps) {
  const pilot = PILOTS[pilotId];
  const powerDrain = snapshot.phase === 'resolving';
  const powerDrainSeconds = Math.max(1, Math.ceil((snapshot.powerDrain?.remainingMs ?? 0) / 1_000));
  const series = snapshot.series;
  const seriesScore = series ? `${series.wins.player}–${series.wins.enemy}` : null;
  const clockLabel = series
    ? `${powerDrain ? 'Power Drain resolution. ' : `${formatClock(snapshot.remainingMs)} remaining. `}Round ${series.currentRound} of ${series.maxRounds}. Series score ${series.wins.player} to ${series.wins.enemy}.`
    : powerDrain
      ? 'Power Drain resolution'
      : `${formatClock(snapshot.remainingMs)} remaining`;
  const clockStatus = series
    ? powerDrain
      ? `POWER DRAIN · R${series.currentRound}/${series.maxRounds} · ${seriesScore}`
      : `R${series.currentRound}/${series.maxRounds} · ${seriesScore} · ${STAGE_LABELS[snapshot.stage]}`
    : powerDrain
      ? 'POWER DRAIN · NO DRAWS'
      : `${STAGE_LABELS[snapshot.stage]} · ${GAME_MODES[snapshot.modeId].shortName}`;

  return (
    <div className="hud-layer" inert={blocked ? true : undefined} aria-hidden={blocked || undefined}>
      <header className="match-header">
        <div className="pilot pilot-player" style={{ '--pilot-accent': pilot.accent } as CSSProperties}>
          <PilotMark pilotId={pilotId} className="pilot-mark" />
          <strong>{pilot.name}</strong>
          <span key={`player-score-${snapshot.score.player}`} className="score-node" aria-label={`${snapshot.score.player} Data Points`}>{snapshot.score.player}</span>
          <span
            className="match-points"
            aria-label={`${snapshot.battleScore.player} battle score, ${Math.round(snapshot.towerDamage.player)} tower damage`}
          >
            {snapshot.battleScore.player.toLocaleString()} PTS · {Math.round(snapshot.towerDamage.player).toLocaleString()} DMG
          </span>
        </div>

        <div
          className={`match-clock${snapshot.chargeOverclock ? ' is-charge-overclock' : ''}${powerDrain ? ' is-power-drain' : ''}`}
          aria-label={clockLabel}
        >
          <time>{powerDrain ? `DRAIN ${powerDrainSeconds}` : formatClock(snapshot.remainingMs)}</time>
          <span className={series ? 'series-clock-label' : undefined}>{clockStatus}</span>
        </div>

        <div className="pilot pilot-enemy">
          <span key={`enemy-score-${snapshot.score.enemy}`} className="score-node" aria-label={`${snapshot.score.enemy} enemy Data Points`}>{snapshot.score.enemy}</span>
          <span
            className="match-points"
            aria-label={`${snapshot.battleScore.enemy} enemy battle score, ${Math.round(snapshot.towerDamage.enemy)} enemy tower damage`}
          >
            {snapshot.battleScore.enemy.toLocaleString()} PTS · {Math.round(snapshot.towerDamage.enemy).toLocaleString()} DMG
          </span>
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
