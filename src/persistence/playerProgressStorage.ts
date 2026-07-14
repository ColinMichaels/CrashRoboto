import {
  createDefaultPlayerProgress,
  type PlayerProgress,
} from '../game/core/progression';
import { readStorageItem, writeStorageItem } from './browserStorage';

const PLAYER_PROGRESS_STORAGE_KEY = 'crash-roboto-player-progress-v1';

export function readPlayerProgress(): PlayerProgress {
  try {
    const stored = JSON.parse(readStorageItem(PLAYER_PROGRESS_STORAGE_KEY) ?? 'null') as Partial<PlayerProgress> | null;
    if (
      !stored ||
      !Number.isFinite(stored.xp) ||
      !Number.isFinite(stored.matches) ||
      stored.xp! < 0 ||
      stored.matches! < 0
    ) return createDefaultPlayerProgress();
    return { xp: Math.floor(stored.xp!), matches: Math.floor(stored.matches!) };
  } catch {
    return createDefaultPlayerProgress();
  }
}

export function savePlayerProgress(progress: PlayerProgress): void {
  if (!Number.isFinite(progress.xp) || !Number.isFinite(progress.matches)) return;
  writeStorageItem(PLAYER_PROGRESS_STORAGE_KEY, JSON.stringify({
    xp: Math.max(0, Math.floor(progress.xp)),
    matches: Math.max(0, Math.floor(progress.matches)),
  }));
}
