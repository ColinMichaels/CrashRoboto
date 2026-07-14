import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AppliedVictoryChests } from '../../game/core/collection';
import { PILOTS, type PilotId } from '../../game/core/pilots';
import type { MatchSnapshot, Team } from '../../game/core/types';
import type { MatchProgressAward } from '../../game/core/progression';
import { VictoryCacheOverlay } from './VictoryCacheOverlay';

interface GameOverlayProps {
  snapshot: MatchSnapshot;
  pilotId: PilotId;
  onRestart: () => void;
  onResume: () => void;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  progressAward: MatchProgressAward | null;
  cacheReward: AppliedVictoryChests | null;
  collectedCacheCount: number;
  onCollectCache: (cacheIndex: number) => void;
  onCollectAllCaches: () => void;
}

function getLowestTowerPower(snapshot: MatchSnapshot, team: Team): number {
  let lowest = 1;
  let found = false;
  for (const tower of snapshot.towers) {
    if (tower.team !== team || tower.hp <= 0) continue;
    found = true;
    lowest = Math.min(lowest, tower.hp / tower.maxHp);
  }
  return found ? Math.max(0, Math.min(1, lowest)) : 0;
}

export function GameOverlay({ snapshot, pilotId, onRestart, onResume, onNextRound, onReturnToLobby, progressAward, cacheReward, collectedCacheCount, onCollectCache, onCollectAllCaches }: GameOverlayProps) {
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const [showCache, setShowCache] = useState(false);

  useEffect(() => {
    if (
      snapshot.phase !== 'paused' &&
      snapshot.phase !== 'round-ended' &&
      snapshot.phase !== 'ended'
    ) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => primaryActionRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [snapshot.phase]);

  useEffect(() => {
    setShowCache(false);
  }, [snapshot.phase]);

  if (snapshot.phase === 'playing') return null;
  if (snapshot.phase === 'menu') return null;

  if (snapshot.phase === 'resolving') {
    const drain = snapshot.powerDrain;
    const playerPower = getLowestTowerPower(snapshot, 'player');
    const enemyPower = getLowestTowerPower(snapshot, 'enemy');
    const stage = drain?.stage ?? 'warning';
    const stageLabel = stage === 'warning'
      ? 'ROUND TIMER EXPIRED'
      : stage === 'critical'
        ? 'GRID COLLAPSE IMMINENT'
        : 'TOWER NETWORK OVERRIDE';
    const secondsRemaining = Math.max(1, Math.ceil((drain?.remainingMs ?? 0) / 1_000));
    return (
      <section
        className={`power-drain-overlay is-${stage}`}
        role="status"
        aria-live="assertive"
        aria-label="Power Drain. The round timer has expired. Tower power drains for eight seconds, and the first tower to reach zero loses the round."
      >
        <div className="power-drain-panel" aria-hidden="true">
          <span className="power-drain-kicker">{stageLabel}</span>
          <h2><i />POWER DRAIN<i /></h2>
          <p>LOWEST TOWER POWER · FIRST GRID TO 0% LOSES</p>
          <div className="power-drain-readout">
            <div className={`power-drain-team is-player${playerPower <= enemyPower ? ' is-lowest' : ''}`}>
              <span><small>{PILOTS[pilotId].name} GRID</small><strong>{Math.ceil(playerPower * 100)}%</strong></span>
              <div className="power-drain-bar" style={{ '--tower-power': `${playerPower * 100}%` } as CSSProperties}><i /></div>
            </div>
            <div className="power-drain-countdown">
              <strong>{secondsRemaining}</strong>
              <small>SEC</small>
            </div>
            <div className={`power-drain-team is-enemy${enemyPower <= playerPower ? ' is-lowest' : ''}`}>
              <span><small>KERNEL-X GRID</small><strong>{Math.ceil(enemyPower * 100)}%</strong></span>
              <div className="power-drain-bar" style={{ '--tower-power': `${enemyPower * 100}%` } as CSSProperties}><i /></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (snapshot.phase === 'round-ended' && snapshot.series?.roundResult) {
    const roundResult = snapshot.series.roundResult;
    const playerWon = roundResult.winner === 'player';
    return (
      <section
        className={`game-overlay result-overlay round-overlay result-${roundResult.winner}`}
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
        aria-labelledby="round-result-title"
        aria-describedby="round-result-description"
      >
        <div className="result-signal" aria-hidden="true"><i /></div>
        <h2 id="round-result-title">
          {playerWon ? `ROUND ${snapshot.series.currentRound} SECURED` : `ROUND ${snapshot.series.currentRound} LOST`}
        </h2>
        <p id="round-result-description">{roundResult.detail}</p>
        <div
          className="final-score"
          aria-label={`Round score ${snapshot.series.wins.player} to ${snapshot.series.wins.enemy}.`}
        >
          <span>
            <small>{PILOTS[pilotId].name}</small>
            <strong>{snapshot.series.wins.player}</strong>
            <em>ROUNDS WON</em>
          </span>
          <i />
          <span>
            <small>KERNEL-X</small>
            <strong>{snapshot.series.wins.enemy}</strong>
            <em>ROUNDS WON</em>
          </span>
        </div>
        <div className="overlay-actions">
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={onNextRound} data-testid="next-round">
            START ROUND {snapshot.series.currentRound + 1}
          </button>
          <button className="secondary-action" type="button" onClick={onRestart}>RESTART SERIES</button>
          <button className="secondary-action" type="button" onClick={onReturnToLobby}>COMMAND LOBBY</button>
        </div>
      </section>
    );
  }

  if (snapshot.phase === 'ended' && showCache && cacheReward) {
    return (
      <VictoryCacheOverlay
        reward={cacheReward}
        collectedCount={collectedCacheCount}
        onCollect={onCollectCache}
        onCollectAll={onCollectAllCaches}
        onContinue={onReturnToLobby}
      />
    );
  }

  if (snapshot.phase === 'paused') {
    return (
      <section className="game-overlay pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" aria-describedby="pause-description">
        <div className="pause-symbol" aria-hidden="true"><i /><i /></div>
        <h2 id="pause-title">SYSTEM PAUSED</h2>
        <p id="pause-description">The arena signal is safely suspended.</p>
        <div className="overlay-actions">
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={onResume}>RESUME</button>
          <button className="secondary-action" type="button" onClick={onRestart}>{snapshot.series ? 'RESTART SERIES' : 'RESTART MATCH'}</button>
          <button className="secondary-action" type="button" onClick={onReturnToLobby}>COMMAND LOBBY</button>
        </div>
      </section>
    );
  }

  const finalPlayerScore = snapshot.series?.wins.player ?? snapshot.score.player;
  const finalEnemyScore = snapshot.series?.wins.enemy ?? snapshot.score.enemy;
  const finalBattleScore = snapshot.series?.battleScore.player ?? snapshot.battleScore.player;
  const finalScoreLabel = snapshot.series
    ? `Final series score ${finalPlayerScore} to ${finalEnemyScore}.`
    : `Final score ${finalPlayerScore} to ${finalEnemyScore}. Tower damage ${Math.round(snapshot.towerDamage.player)} to ${Math.round(snapshot.towerDamage.enemy)}.`;

  return (
    <section
      className={`game-overlay result-overlay result-${snapshot.result?.winner ?? 'draw'}`}
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      aria-labelledby="result-title"
      aria-describedby="result-description"
    >
      <div className="result-signal" aria-hidden="true"><i /></div>
      <h2 id="result-title">{snapshot.result?.headline ?? 'SIGNAL ENDED'}</h2>
      <p id="result-description">{snapshot.result?.detail}</p>
      <div
        className="final-score"
        aria-label={finalScoreLabel}
      >
        <span>
          <small>{PILOTS[pilotId].name}</small>
          <strong>{finalPlayerScore}</strong>
          <em>{snapshot.series ? 'ROUNDS WON' : `${Math.round(snapshot.towerDamage.player).toLocaleString()} DMG`}</em>
        </span>
        <i />
        <span>
          <small>KERNEL-X</small>
          <strong>{finalEnemyScore}</strong>
          <em>{snapshot.series ? 'ROUNDS WON' : `${Math.round(snapshot.towerDamage.enemy).toLocaleString()} DMG`}</em>
        </span>
      </div>
      <div className="result-rewards" aria-label={`Battle score ${finalBattleScore}. ${progressAward?.xp ?? 0} experience earned.`}>
        <span><small>{snapshot.series ? 'SERIES SCORE' : 'BATTLE SCORE'}</small><strong>{finalBattleScore.toLocaleString()}</strong></span>
        <i />
        <span><small>XP EARNED</small><strong>+{progressAward?.xp ?? 0}</strong></span>
      </div>
      {cacheReward && (
        <div className="result-cache-teaser" aria-label={`${cacheReward.reveals.length} bonus ${cacheReward.reveals.length === 1 ? 'chest' : 'chests'} recovered`}>
          <span className="result-cache-icon" style={{ '--cache-art': `url("${import.meta.env.BASE_URL}assets/game/vault-sprites.webp")` } as CSSProperties} aria-hidden="true" />
          <span><small>VICTORY DROP</small><strong>{cacheReward.reveals.length} BONUS {cacheReward.reveals.length === 1 ? 'CACHE' : 'CACHES'}</strong></span>
        </div>
      )}
      <div className="overlay-actions">
        {cacheReward ? (
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={() => setShowCache(true)}>OPEN {cacheReward.reveals.length} {cacheReward.reveals.length === 1 ? 'CACHE' : 'CACHES'}</button>
        ) : (
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={onRestart} data-testid="restart-match">RUN IT BACK</button>
        )}
        {cacheReward && <button className="secondary-action" type="button" onClick={onRestart} data-testid="restart-match">COLLECT ALL & RUN IT BACK</button>}
        <button className="secondary-action" type="button" onClick={onReturnToLobby}>
          {cacheReward ? 'COLLECT ALL & EDIT LOADOUT' : 'EDIT LOADOUT'}
        </button>
      </div>
    </section>
  );
}
