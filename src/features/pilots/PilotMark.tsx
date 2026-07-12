import type { CSSProperties } from 'react';
import { PILOTS, type PilotId } from '../../game/core/pilots';

interface PilotMarkProps {
  pilotId: PilotId;
  className?: string;
}

export function PilotMark({ pilotId, className = '' }: PilotMarkProps) {
  const pilot = PILOTS[pilotId];
  const style = { '--pilot-accent': pilot.accent } as CSSProperties;

  return (
    <span
      className={`pilot-identity-mark mark-${pilot.mark}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    >
      <i />
      <b />
    </span>
  );
}
