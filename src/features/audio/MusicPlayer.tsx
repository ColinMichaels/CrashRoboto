import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import type { MusicEngine } from '../../audio/MusicEngine';
import { getTrackTitleFromFilename, type MusicTrack } from '../../audio/musicCatalog';
import './musicPlayer.css';

interface MusicPlayerProps {
  engine: MusicEngine;
  bundledPlaylist: readonly MusicTrack[];
  audioMuted: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  sfxVolume: number;
  onToggleAudioMute: () => void;
  onToggleMusicMute: () => void;
  onToggleSfxMute: () => void;
  onVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
}

const AUDIO_FILE_PATTERN = /\.(mp3|wav|m4a|aac|ogg|oga|flac)$/i;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>
  );
}

function SkipIcon({ previous = false }: { previous?: boolean }) {
  return (
    <svg className={previous ? 'is-previous' : undefined} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 5v14M6 5l10 7-10 7z" />
    </svg>
  );
}

function AudioMuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {muted ? (
        <path className="music-player-mute-slash" d="m17 9 4 6m0-6-4 6" />
      ) : (
        <path d="M16 9c1.4 1.6 1.4 4.4 0 6m2.8-8.8c3 3.2 3 8.4 0 11.6" />
      )}
    </svg>
  );
}

export function MusicPlayer({
  engine,
  bundledPlaylist,
  audioMuted,
  musicMuted,
  sfxMuted,
  sfxVolume,
  onToggleAudioMute,
  onToggleMusicMute,
  onToggleSfxMute,
  onVolumeChange,
  onSfxVolumeChange,
}: MusicPlayerProps) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [panelOpen, setPanelOpen] = useState(false);
  const playlistTriggerRef = useRef<HTMLButtonElement>(null);
  const importedUrlsRef = useRef<string[]>([]);
  const currentTrack = snapshot.currentTrack;
  const fallbackArtwork = bundledPlaylist[0]?.artwork;
  const hasImportedPlaylist = snapshot.playlist.some((track) => track.source === 'local');

  useEffect(() => () => {
    for (const url of importedUrlsRef.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPanelOpen(false);
      window.requestAnimationFrame(() => playlistTriggerRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [panelOpen]);

  const replaceImportedUrls = (nextUrls: string[]) => {
    for (const url of importedUrlsRef.current) URL.revokeObjectURL(url);
    importedUrlsRef.current = nextUrls;
  };

  const loadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter(
      (file) => file.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(file.name),
    );
    event.currentTarget.value = '';
    if (files.length === 0) return;

    const objectUrls: string[] = [];
    const tracks = files.map<MusicTrack>((file, index) => {
      const src = URL.createObjectURL(file);
      objectUrls.push(src);
      return {
        id: `local-${file.lastModified}-${file.size}-${index}`,
        title: getTrackTitleFromFilename(file.name),
        artist: 'LOCAL / SUNO EXPORT',
        src,
        artwork: fallbackArtwork,
        source: 'local',
      };
    });

    if (engine.setPlaylist(tracks)) replaceImportedUrls(objectUrls);
    else for (const url of objectUrls) URL.revokeObjectURL(url);
  };

  const restoreBundledPlaylist = () => {
    if (!engine.setPlaylist(bundledPlaylist)) return;
    replaceImportedUrls([]);
  };

  const closePanel = () => {
    setPanelOpen(false);
    window.requestAnimationFrame(() => playlistTriggerRef.current?.focus({ preventScroll: true }));
  };

  return (
    <section className={`music-player${panelOpen ? ' is-open' : ''}`} aria-label="Music player and audio settings">
      <button
        ref={playlistTriggerRef}
        className="music-player-artwork"
        type="button"
        onClick={() => setPanelOpen((open) => !open)}
        aria-expanded={panelOpen}
        aria-label={`${panelOpen ? 'Close' : 'Open'} audio settings and music playlist`}
        title="Audio settings and music playlist"
        data-testid="music-playlist-toggle"
      >
        {currentTrack?.artwork || fallbackArtwork ? (
          <img src={currentTrack?.artwork ?? fallbackArtwork} alt="" />
        ) : <span aria-hidden="true">♪</span>}
        <i className={snapshot.isPlaying && !musicMuted ? 'is-active' : undefined} aria-hidden="true" />
      </button>

      <div className="music-player-copy" aria-live="polite">
        <small>{musicMuted ? 'MUSIC MUTED' : snapshot.isPlaying ? 'MUSIC · ON AIR' : 'MUSIC CHANNEL'}</small>
        <strong title={currentTrack?.title}>{currentTrack?.title ?? 'NO TRACK LOADED'}</strong>
      </div>

      <button
        className="music-player-control music-player-skip"
        type="button"
        onClick={() => engine.previous()}
        disabled={!currentTrack}
        aria-label="Previous music track"
      >
        <SkipIcon previous />
      </button>
      <button
        className="music-player-control music-player-play"
        type="button"
        onClick={() => { void engine.toggle(); }}
        disabled={!currentTrack}
        aria-label={snapshot.isPlaying ? 'Pause music' : 'Play music'}
        data-testid="music-play-toggle"
      >
        <PlayIcon playing={snapshot.isPlaying} />
      </button>
      <button
        className="music-player-control music-player-skip"
        type="button"
        onClick={() => engine.next()}
        disabled={!currentTrack}
        aria-label="Next music track"
      >
        <SkipIcon />
      </button>
      <button
        className={`music-player-control music-player-mute${audioMuted ? ' is-muted' : ''}`}
        type="button"
        onClick={onToggleAudioMute}
        aria-label={audioMuted ? 'Unmute all audio' : 'Mute all audio'}
        aria-pressed={audioMuted}
        title="Mute all audio (M)"
        data-testid="audio-mute-toggle"
      >
        <AudioMuteIcon muted={audioMuted} />
      </button>
      {panelOpen ? (
        <div className="music-player-panel" role="dialog" aria-modal="false" aria-label="Audio settings and music playlist">
          <header>
            <span><small>SIGNAL MIXER</small><strong>{snapshot.playlist.length} {snapshot.playlist.length === 1 ? 'TRACK' : 'TRACKS'}</strong></span>
            <button type="button" onClick={closePanel} aria-label="Close audio settings and music playlist">×</button>
          </header>

          <label className="music-player-progress">
            <span className="sr-only">Music position</span>
            <input
              type="range"
              min="0"
              max={Math.max(snapshot.duration, 0)}
              step="0.1"
              value={Math.min(snapshot.currentTime, snapshot.duration || 0)}
              onChange={(event) => engine.seek(Number(event.currentTarget.value))}
              disabled={!snapshot.duration}
            />
            <span><time>{formatTime(snapshot.currentTime)}</time><time>{formatTime(snapshot.duration)}</time></span>
          </label>

          <ol className="music-player-track-list" aria-label="Loaded music playlist">
            {snapshot.playlist.map((track, index) => (
              <li key={track.id}>
                <button
                  type="button"
                  className={index === snapshot.currentIndex ? 'is-current' : undefined}
                  onClick={() => engine.selectTrack(index)}
                  aria-current={index === snapshot.currentIndex ? 'true' : undefined}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                  <i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>

          <div className="music-player-levels" aria-label="Audio levels">
            <div className="music-player-volume">
              <span>MUSIC LEVEL</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={snapshot.volume}
                onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
                aria-label="Music volume"
                aria-valuetext={`${Math.round(snapshot.volume * 100)} percent`}
                data-testid="music-volume-control"
              />
              <strong>{Math.round(snapshot.volume * 100)}%</strong>
              <button
                className={musicMuted ? 'is-muted' : undefined}
                type="button"
                onClick={onToggleMusicMute}
                aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
                aria-pressed={musicMuted}
                data-testid="music-mute-toggle"
              >
                {musicMuted ? 'UNMUTE' : 'MUTE'}
              </button>
            </div>
            <div className="music-player-volume">
              <span>SFX LEVEL</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={sfxVolume}
                onChange={(event) => onSfxVolumeChange(Number(event.currentTarget.value))}
                aria-label="Sound effects volume"
                aria-valuetext={`${Math.round(sfxVolume * 100)} percent`}
                data-testid="sfx-volume-control"
              />
              <strong>{Math.round(sfxVolume * 100)}%</strong>
              <button
                className={sfxMuted ? 'is-muted' : undefined}
                type="button"
                onClick={onToggleSfxMute}
                aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                aria-pressed={sfxMuted}
                data-testid="sfx-mute-toggle"
              >
                {sfxMuted ? 'UNMUTE' : 'MUTE'}
              </button>
            </div>
          </div>

          {snapshot.error ? <p className="music-player-error" role="status">{snapshot.error}</p> : null}

          <div className="music-player-actions">
            <label>
              LOAD PLAYLIST
              <input
                className="sr-only"
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac"
                multiple
                onChange={loadFiles}
                data-testid="music-file-input"
              />
            </label>
            {hasImportedPlaylist ? (
              <button type="button" onClick={restoreBundledPlaylist}>RESTORE THEME</button>
            ) : null}
          </div>
          <p className="music-player-note">Suno playlist links cannot play in-game. Download your owned tracks, then load the audio files here.</p>
        </div>
      ) : null}
    </section>
  );
}
