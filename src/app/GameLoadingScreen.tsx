import type { CSSProperties } from 'react';
import './gameLoadingScreen.css';

interface GameLoadingScreenProps {
  progress: number;
  label: string;
  mode?: 'boot' | 'deployment';
  error?: string | null;
  onRetry?: () => void;
}

function LoaderMark() {
  return (
    <div className="game-loader-mark" aria-hidden="true">
      <i />
      <svg viewBox="0 0 64 64">
        <path d="M23 8h18l10 10v28L41 56H23L13 46V18z" />
        <path d="M32 12v19m-10-8a15 15 0 1 0 20 0" />
      </svg>
    </div>
  );
}

export function GameLoadingScreen({
  progress,
  label,
  mode = 'boot',
  error = null,
  onRetry,
}: GameLoadingScreenProps) {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  const percentage = Math.round(normalizedProgress * 100);
  const style = { '--game-load-progress': `${percentage}%` } as CSSProperties;

  return (
    <div
      className={`game-loading-screen is-${mode}${error ? ' has-error' : ''}`}
      role={error ? 'alert' : 'status'}
      aria-live="polite"
      aria-busy={!error}
      style={style}
    >
      <div className="game-loader-grid" aria-hidden="true" />
      <section className="game-loader-console">
        <LoaderMark />
        <h1>CRASH ROBOTO</h1>
        <p>{mode === 'boot' ? 'COMMAND SYSTEM STARTUP' : 'DEPLOYMENT SEQUENCE'}</p>
        {error ? (
          <>
            <strong className="game-loader-error">ASSET LINK INTERRUPTED</strong>
            <small>{error}</small>
            {onRetry && <button type="button" onClick={onRetry}>RETRY CONNECTION</button>}
          </>
        ) : (
          <>
            <div className="game-loader-progress" aria-label={`${percentage}% loaded`}>
              <i><b /></i>
              <strong>{String(percentage).padStart(3, '0')}%</strong>
            </div>
            <span>{label}</span>
          </>
        )}
      </section>
    </div>
  );
}
