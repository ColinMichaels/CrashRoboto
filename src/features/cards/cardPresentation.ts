import type { CSSProperties } from 'react';
import type { SpriteSheet, TechClass } from '../../game/core/types';

export const TECH_CLASS_LABELS: Record<TechClass, string> = {
  standard: 'STANDARD',
  advanced: 'ADVANCED',
  prototype: 'PROTOTYPE',
  exotic: 'EXOTIC',
  commander: 'COMMANDER',
};

export function getCardSpriteStyle(sheet: SpriteSheet, frame: number): CSSProperties {
  const columns = sheet === 'robot' ? 4 : 3;
  const column = frame % columns;
  const row = Math.floor(frame / columns);

  return {
    backgroundImage: `url("${import.meta.env.BASE_URL}assets/game/${sheet}-sprites.png")`,
    backgroundPosition: `${(column / (columns - 1)) * 100}% ${row * 100}%`,
    backgroundSize: `${columns * 100}% 200%`,
  };
}
