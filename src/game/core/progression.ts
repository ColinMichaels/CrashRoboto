import type { MatchResult, Team } from './types';

export const BASE_FIRMWARE_BUDGET = 6;
export const MAX_FIRMWARE_BUDGET = 12;
export const MAX_PLAYER_LEVEL = 20;

export const SCORE_AWARDS = {
  unit: 50,
  installation: 75,
  relay: 500,
  core: 1_500,
  victory: 1_000,
} as const;

export interface PlayerProgress {
  xp: number;
  matches: number;
}

export interface MatchProgressAward {
  xp: number;
  scoreXp: number;
  resultXp: number;
}

export const createDefaultPlayerProgress = (): PlayerProgress => ({ xp: 0, matches: 0 });

export function getXpForLevel(level: number): number {
  const normalized = Math.min(MAX_PLAYER_LEVEL, Math.max(1, Math.floor(level)));
  return 150 * ((normalized - 1) * normalized) / 2;
}

export function getPlayerLevel(xp: number): number {
  const normalizedXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && normalizedXp >= getXpForLevel(level + 1)) level += 1;
  return level;
}

export function getFirmwareBudgetForLevel(level: number): number {
  const normalized = Math.min(MAX_PLAYER_LEVEL, Math.max(1, Math.floor(level)));
  return Math.min(MAX_FIRMWARE_BUDGET, BASE_FIRMWARE_BUDGET + Math.floor((normalized - 1) / 2));
}

export function getMatchProgressAward(
  battleScore: Record<Team, number>,
  result: MatchResult,
): MatchProgressAward {
  const scoreXp = Math.floor(Math.max(0, battleScore.player) / 10);
  const resultXp = result.winner === 'player' ? 200 : result.winner === 'draw' ? 100 : 50;
  return { xp: 100 + scoreXp + resultXp, scoreXp, resultXp };
}
