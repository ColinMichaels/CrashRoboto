export const MUSIC_WAVEFORM_BARS = [0.38, 0.72, 0.52, 0.94, 0.64, 0.84, 0.46, 1, 0.58, 0.78, 0.42, 0.68] as const;

export function getMusicOutputLevel(isPlaying: boolean, muted: boolean, volume: number): number {
  if (!isPlaying || muted || !Number.isFinite(volume)) return 0;
  return Math.max(0, Math.min(1, volume));
}
