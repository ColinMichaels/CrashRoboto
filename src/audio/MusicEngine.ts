import type { MusicTrack } from './musicCatalog';
import { DEFAULT_MUSIC_VOLUME } from './audioVolume';

export interface MusicSnapshot {
  playlist: readonly MusicTrack[];
  currentTrack: MusicTrack | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
}

interface MusicEngineOptions {
  createAudio?: () => HTMLAudioElement;
  volume?: number;
}

type MusicListener = () => void;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeTime(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class MusicEngine {
  private readonly audio: HTMLAudioElement;
  private readonly listeners = new Set<MusicListener>();
  private playlist: MusicTrack[];
  private snapshot: MusicSnapshot;
  private disposed = false;
  private playRequestId = 0;

  constructor(initialPlaylist: readonly MusicTrack[], options: MusicEngineOptions = {}) {
    this.playlist = [...initialPlaylist];
    this.audio = (options.createAudio ?? (() => new Audio()))();
    this.audio.preload = 'metadata';
    const initialVolume = options.volume;
    this.audio.volume = typeof initialVolume === 'number' && Number.isFinite(initialVolume)
      ? clamp(initialVolume, 0, 1)
      : DEFAULT_MUSIC_VOLUME;
    this.snapshot = {
      playlist: this.playlist,
      currentTrack: this.playlist[0] ?? null,
      currentIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: this.audio.volume,
      error: this.playlist.length > 0 ? null : 'NO MUSIC TRACKS LOADED',
    };

    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('durationchange', this.handleDurationChange);
    this.audio.addEventListener('loadedmetadata', this.handleDurationChange);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);
    this.configureCurrentTrack();
  }

  readonly getSnapshot = (): MusicSnapshot => this.snapshot;

  readonly subscribe = (listener: MusicListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async play(): Promise<boolean> {
    if (this.disposed || !this.snapshot.currentTrack) return false;
    const requestId = ++this.playRequestId;

    try {
      await this.audio.play();
      if (this.disposed || requestId !== this.playRequestId) return false;
      this.update({ isPlaying: true, error: null });
      return true;
    } catch (error) {
      if (this.disposed || requestId !== this.playRequestId) return false;
      const blocked = error instanceof DOMException && error.name === 'NotAllowedError';
      this.update({
        isPlaying: false,
        error: blocked ? 'PLAYBACK BLOCKED — PRESS PLAY TO RETRY' : 'TRACK COULD NOT BE PLAYED',
      });
      return false;
    }
  }

  pause(): void {
    if (this.disposed) return;
    this.playRequestId += 1;
    this.audio.pause();
    this.update({ isPlaying: false });
  }

  stop(): void {
    if (this.disposed) return;
    this.playRequestId += 1;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.update({ isPlaying: false, currentTime: 0 });
  }

  async toggle(): Promise<boolean> {
    if (this.snapshot.isPlaying || !this.audio.paused) {
      this.pause();
      return false;
    }
    return this.play();
  }

  setMuted(muted: boolean): void {
    if (!this.disposed) this.audio.muted = muted;
  }

  setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    const nextVolume = clamp(volume, 0, 1);
    this.audio.volume = nextVolume;
    this.update({ volume: nextVolume });
  }

  seek(seconds: number): void {
    if (this.disposed || !this.snapshot.currentTrack) return;
    const maximum = normalizeTime(this.audio.duration) || Number.POSITIVE_INFINITY;
    this.audio.currentTime = clamp(Number.isFinite(seconds) ? seconds : 0, 0, maximum);
    this.update({ currentTime: normalizeTime(this.audio.currentTime) });
  }

  selectTrack(index: number, resume = this.snapshot.isPlaying): void {
    if (this.disposed || this.playlist.length === 0 || !Number.isFinite(index)) return;
    const nextIndex = ((Math.trunc(index) % this.playlist.length) + this.playlist.length) % this.playlist.length;

    if (nextIndex === this.snapshot.currentIndex) {
      this.seek(0);
      if (resume) void this.play();
      return;
    }

    this.playRequestId += 1;
    this.audio.pause();
    this.snapshot = {
      ...this.snapshot,
      currentTrack: this.playlist[nextIndex] ?? null,
      currentIndex: nextIndex,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    };
    this.configureCurrentTrack();
    this.emit();
    if (resume) void this.play();
  }

  next(): void {
    this.selectTrack(this.snapshot.currentIndex + 1);
  }

  previous(): void {
    if (this.snapshot.currentTime > 4) {
      this.seek(0);
      return;
    }
    this.selectTrack(this.snapshot.currentIndex - 1);
  }

  setPlaylist(tracks: readonly MusicTrack[]): boolean {
    if (this.disposed || tracks.length === 0) {
      if (!this.disposed) this.update({ error: 'NO SUPPORTED AUDIO FILES SELECTED' });
      return false;
    }

    const resume = this.snapshot.isPlaying;
    this.playRequestId += 1;
    this.audio.pause();
    this.playlist = [...tracks];
    this.snapshot = {
      ...this.snapshot,
      playlist: this.playlist,
      currentTrack: this.playlist[0] ?? null,
      currentIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    };
    this.configureCurrentTrack();
    this.emit();
    if (resume) void this.play();
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playRequestId += 1;
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.removeEventListener('durationchange', this.handleDurationChange);
    this.audio.removeEventListener('loadedmetadata', this.handleDurationChange);
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('error', this.handleError);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.listeners.clear();
  }

  private readonly handlePlay = () => {
    this.update({ isPlaying: true, error: null });
  };

  private readonly handlePause = () => {
    this.update({ isPlaying: false });
  };

  private readonly handleTimeUpdate = () => {
    this.update({ currentTime: normalizeTime(this.audio.currentTime) });
  };

  private readonly handleDurationChange = () => {
    this.update({ duration: normalizeTime(this.audio.duration) });
  };

  private readonly handleEnded = () => {
    if (this.playlist.length <= 1) return;
    this.selectTrack(this.snapshot.currentIndex + 1, true);
  };

  private readonly handleError = () => {
    this.update({
      isPlaying: false,
      error: this.audio.error?.message?.toUpperCase() ?? 'TRACK COULD NOT BE LOADED',
    });
  };

  private configureCurrentTrack(): void {
    const track = this.snapshot.currentTrack;
    if (!track) return;
    this.audio.src = track.src;
    this.audio.loop = this.playlist.length === 1;
    this.audio.load();
  }

  private update(patch: Partial<MusicSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
