export type ArenaBoardTheme = 'foundry' | 'sewer' | 'volcanic' | 'orbital' | 'alien';

export interface ArenaBoardUnlock {
  level: number;
  theme: ArenaBoardTheme;
  name: string;
}

export const ARENA_BOARD_UNLOCKS: readonly ArenaBoardUnlock[] = [
  { level: 1, theme: 'foundry', name: 'FOUNDRY GRID' },
  { level: 6, theme: 'sewer', name: 'TOXIC CONDUIT' },
  { level: 11, theme: 'volcanic', name: 'VOLCANIC DEPTHS' },
  { level: 20, theme: 'orbital', name: 'VOID ASCENT' },
  { level: 40, theme: 'alien', name: 'XENO OVERGROWTH' },
];

const normalizeLevel = (level: number): number => (
  Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
);

export function getArenaBoardUnlockForLevel(level: number): ArenaBoardUnlock {
  const normalizedLevel = normalizeLevel(level);
  for (let index = ARENA_BOARD_UNLOCKS.length - 1; index >= 0; index -= 1) {
    const unlock = ARENA_BOARD_UNLOCKS[index];
    if (normalizedLevel >= unlock.level) return unlock;
  }
  return ARENA_BOARD_UNLOCKS[0];
}

export function getNextArenaBoardUnlock(level: number): ArenaBoardUnlock | null {
  const normalizedLevel = normalizeLevel(level);
  return ARENA_BOARD_UNLOCKS.find((unlock) => unlock.level > normalizedLevel) ?? null;
}

export function getArenaBoardThemeForLevel(level: number): ArenaBoardTheme {
  return getArenaBoardUnlockForLevel(level).theme;
}
