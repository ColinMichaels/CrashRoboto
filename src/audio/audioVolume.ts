export const DEFAULT_MUSIC_VOLUME = 0.5;
export const DEFAULT_SFX_VOLUME = 0.5;

export function parseAudioVolumePreference(stored: string | null, fallback: number): number {
  if (stored === null || stored.trim() === '') return fallback;
  const volume = Number(stored);
  return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : fallback;
}
