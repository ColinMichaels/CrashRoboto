import { describe, expect, it, vi } from 'vitest';
import { MusicEngine } from './MusicEngine';
import { DEFAULT_MUSIC_VOLUME } from './audioVolume';
import type { MusicTrack } from './musicCatalog';

const TRACKS: MusicTrack[] = [
  { id: 'one', title: 'One', artist: 'Test', src: './one.mp3', source: 'bundled' },
  { id: 'two', title: 'Two', artist: 'Test', src: './two.mp3', source: 'bundled' },
];

class FakeAudio extends EventTarget {
  src = '';
  preload = '';
  loop = false;
  volume = 1;
  muted = false;
  currentTime = 0;
  duration = 120;
  paused = true;
  error: MediaError | null = null;
  readonly load = vi.fn();
  readonly removeAttribute = vi.fn();

  readonly play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  });

  readonly pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
}

function createEngine(tracks: readonly MusicTrack[] = TRACKS) {
  const audio = new FakeAudio();
  const engine = new MusicEngine(tracks, {
    createAudio: () => audio as unknown as HTMLAudioElement,
    volume: 0.3,
  });
  return { audio, engine };
}

describe('MusicEngine', () => {
  it('starts direct engine construction at the safe 50% default', () => {
    const audio = new FakeAudio();
    const engine = new MusicEngine([TRACKS[0]!], {
      createAudio: () => audio as unknown as HTMLAudioElement,
    });

    expect(audio.volume).toBe(DEFAULT_MUSIC_VOLUME);
    expect(engine.getSnapshot().volume).toBe(DEFAULT_MUSIC_VOLUME);
  });

  it('configures the first track without beginning playback', () => {
    const { audio, engine } = createEngine([TRACKS[0]!]);

    expect(audio.src).toBe('./one.mp3');
    expect(audio.preload).toBe('metadata');
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.3);
    expect(engine.getSnapshot()).toMatchObject({
      currentIndex: 0,
      currentTrack: TRACKS[0],
      isPlaying: false,
    });
  });

  it('plays, pauses, and mutes music independently', async () => {
    const { audio, engine } = createEngine();

    await expect(engine.play()).resolves.toBe(true);
    expect(engine.getSnapshot().isPlaying).toBe(true);
    engine.setMuted(true);
    expect(audio.muted).toBe(true);
    engine.setVolume(0.2);
    expect(audio.muted).toBe(true);
    expect(audio.volume).toBe(0.2);
    engine.pause();
    expect(engine.getSnapshot().isPlaying).toBe(false);
  });

  it('does not let a stale play promise override a later pause', async () => {
    const { audio, engine } = createEngine();
    let finishPlay: (() => void) | undefined;
    audio.play.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishPlay = resolve;
    }));

    const pendingPlay = engine.play();
    engine.pause();
    finishPlay?.();

    await expect(pendingPlay).resolves.toBe(false);
    expect(engine.getSnapshot().isPlaying).toBe(false);
  });

  it('advances and resumes when a playlist track ends', async () => {
    const { audio, engine } = createEngine();
    await engine.play();

    audio.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(engine.getSnapshot().currentTrack?.id).toBe('two');
    expect(audio.src).toBe('./two.mp3');
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('loads a replacement playlist and clamps volume and seeking', () => {
    const { audio, engine } = createEngine();
    const imported: MusicTrack = {
      id: 'local',
      title: 'Local Track',
      artist: 'Local import',
      src: 'blob:local-track',
      source: 'local',
    };

    expect(engine.setPlaylist([imported])).toBe(true);
    engine.setVolume(4);
    engine.setVolume(Number.NaN);
    engine.seek(999);

    expect(audio.src).toBe('blob:local-track');
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(1);
    expect(audio.currentTime).toBe(120);
  });

  it('releases the media element on disposal', () => {
    const { audio, engine } = createEngine();

    engine.dispose();

    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
  });
});
