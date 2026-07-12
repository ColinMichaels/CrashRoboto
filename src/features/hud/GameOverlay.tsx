import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AppliedVictoryChests } from '../../game/core/collection';
import { PILOTS, type PilotId } from '../../game/core/pilots';
import type { MatchSnapshot } from '../../game/core/types';
import type { MatchProgressAward } from '../../game/core/progression';
import { VictoryCacheOverlay } from './VictoryCacheOverlay';

interface GameOverlayProps {
  snapshot: MatchSnapshot;
  pilotId: PilotId;
  onRestart: () => void;
  onResume: () => void;
  onReturnToLobby: () => void;
  progressAward: MatchProgressAward | null;
  cacheReward: AppliedVictoryChests | null;
}

export function GameOverlay({ snapshot, pilotId, onRestart, onResume, onReturnToLobby, progressAward, cacheReward }: GameOverlayProps) {
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const [showCache, setShowCache] = useState(false);

  useEffect(() => {
    if (snapshot.phase !== 'paused' && snapshot.phase !== 'ended') return;
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

  if (snapshot.phase === 'ended' && showCache && cacheReward) {
    return <VictoryCacheOverlay reward={cacheReward} onContinue={onReturnToLobby} />;
  }

  if (snapshot.phase === 'paused') {
    return (
      <section className="game-overlay pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" aria-describedby="pause-description">
        <div className="pause-symbol" aria-hidden="true"><i /><i /></div>
        <h2 id="pause-title">SYSTEM PAUSED</h2>
        <p id="pause-description">The arena signal is safely suspended.</p>
        <div className="overlay-actions">
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={onResume}>RESUME</button>
          <button className="secondary-action" type="button" onClick={onRestart}>RESTART MATCH</button>
          <button className="secondary-action" type="button" onClick={onReturnToLobby}>COMMAND LOBBY</button>
        </div>
      </section>
    );
  }

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
      <div className="final-score" aria-label={`Final score ${snapshot.score.player} to ${snapshot.score.enemy}`}>
        <span><small>{PILOTS[pilotId].name}</small><strong>{snapshot.score.player}</strong></span>
        <i />
        <span><small>KERNEL-X</small><strong>{snapshot.score.enemy}</strong></span>
      </div>
      <div className="result-rewards" aria-label={`Battle score ${snapshot.battleScore.player}. ${progressAward?.xp ?? 0} experience earned.`}>
        <span><small>BATTLE SCORE</small><strong>{snapshot.battleScore.player.toLocaleString()}</strong></span>
        <i />
        <span><small>XP EARNED</small><strong>+{progressAward?.xp ?? 0}</strong></span>
      </div>
      {cacheReward && (
        <div className="result-cache-teaser" aria-label={`${cacheReward.reveals.length} bonus ${cacheReward.reveals.length === 1 ? 'chest' : 'chests'} recovered`}>
          <span className="result-cache-icon" style={{ '--cache-art': `url("${import.meta.env.BASE_URL}assets/game/vault-sprites.png")` } as CSSProperties} aria-hidden="true" />
          <span><small>VICTORY DROP</small><strong>{cacheReward.reveals.length} BONUS {cacheReward.reveals.length === 1 ? 'CACHE' : 'CACHES'}</strong></span>
        </div>
      )}
      <div className="overlay-actions">
        {cacheReward ? (
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={() => setShowCache(true)}>OPEN {cacheReward.reveals.length} {cacheReward.reveals.length === 1 ? 'CACHE' : 'CACHES'}</button>
        ) : (
          <button ref={primaryActionRef} className="primary-action compact" type="button" onClick={onRestart} data-testid="restart-match">RUN IT BACK</button>
        )}
        {cacheReward && <button className="secondary-action" type="button" onClick={onRestart} data-testid="restart-match">RUN IT BACK</button>}
        <button className="secondary-action" type="button" onClick={onReturnToLobby}>EDIT LOADOUT</button>
      </div>
    </section>
  );
}
