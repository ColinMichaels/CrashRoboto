import type { CSSProperties } from 'react';
import type { SpriteSheet, TechClass } from '../../game/core/types';
import { SPRITE_SHEETS } from '../../game/core/spriteSheets';

export const TECH_CLASS_LABELS: Record<TechClass, string> = {
  standard: 'STANDARD',
  advanced: 'ADVANCED',
  prototype: 'PROTOTYPE',
  exotic: 'EXOTIC',
  commander: 'COMMANDER',
};

export function getCardSpriteStyle(sheet: SpriteSheet, frame: number): CSSProperties {
  const metadata = SPRITE_SHEETS[sheet];
  const { columns, rows } = metadata;
  const column = frame % columns;
  const row = Math.floor(frame / columns);

  return {
    backgroundImage: `url("${import.meta.env.BASE_URL}${metadata.assetPath}")`,
    backgroundPosition: `${(column / Math.max(1, columns - 1)) * 100}% ${(row / Math.max(1, rows - 1)) * 100}%`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
  };
}
