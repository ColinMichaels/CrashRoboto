import type { CSSProperties } from 'react';
import type { RobotCardId, RobotKind, SpriteSheet, TechClass } from '../../game/core/types';
import { SPRITE_SHEETS } from '../../game/core/spriteSheets';
import {
  ARENA_UNIT_ATLAS_ROW,
  ARENA_UNIT_GAIT_FPS,
  VAULT_UNIT_KINDS,
} from '../../game/phaser/unitPresentation';

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

export function getCardActionPreviewStyle(robotId: RobotCardId): CSSProperties {
  const kind = robotId as RobotKind;
  const vault = (VAULT_UNIT_KINDS as readonly RobotKind[]).includes(kind);
  const rows = vault ? 3 : 9;
  const row = ARENA_UNIT_ATLAS_ROW[kind];
  const duration = Math.max(420, Math.min(720, (4 / ARENA_UNIT_GAIT_FPS[kind]) * 2_600));

  return {
    '--card-action-row': `${(row / Math.max(1, rows - 1)) * 100}%`,
    '--card-action-duration': `${Math.round(duration)}ms`,
    backgroundImage: `url("${import.meta.env.BASE_URL}assets/game/${vault ? 'vault-unit-sprites' : 'arena-robot-move-sprites'}.webp")`,
    backgroundPosition: `60% ${(row / Math.max(1, rows - 1)) * 100}%`,
    backgroundSize: `600% ${rows * 100}%`,
  } as CSSProperties;
}
