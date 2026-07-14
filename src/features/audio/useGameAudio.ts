import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MusicEngine } from '../../audio/MusicEngine';
import { SoundEngine } from '../../audio/SoundEngine';
import { DEFAULT_SFX_VOLUME, parseAudioVolumePreference } from '../../audio/audioVolume';
import {
  getBundledLobbyMusicPlaylist,
  getBundledMusicPlaylist,
  parseMusicVolumePreference,
  type MusicTrack,
} from '../../audio/musicCatalog';
import { GameBridge } from '../../game/bridge/GameBridge';
import type { MatchPhase } from '../../game/core/types';
import { readStorageItem, writeStorageItem } from '../../persistence/browserStorage';

const LEGACY_MUTE_STORAGE_KEY = 'crash-roboto-muted';
const SFX_MUTE_STORAGE_KEY = 'crash-roboto-sfx-muted';
const MUSIC_MUTE_STORAGE_KEY = 'crash-roboto-music-muted';
const MUSIC_VOLUME_STORAGE_KEY = 'crash-roboto-music-volume';
const SFX_VOLUME_STORAGE_KEY = 'crash-roboto-sfx-volume';

export const BATTLE_MUSIC_PLAYLIST = getBundledMusicPlaylist();
export const LOBBY_MUSIC_PLAYLIST = getBundledLobbyMusicPlaylist();

const MUSIC_ACTIVE_PHASES: ReadonlySet<MatchPhase> = new Set([
  'menu',
  'playing',
  'resolving',
  'round-ended',
]);

function readMutePreference(key: string): boolean {
  const stored = readStorageItem(key);
  if (stored !== null) return stored === 'true';
  return readStorageItem(LEGACY_MUTE_STORAGE_KEY) === 'true';
}

function readMusicVolume(): number {
  return parseMusicVolumePreference(readStorageItem(MUSIC_VOLUME_STORAGE_KEY));
}

function readSfxVolume(): number {
  return parseAudioVolumePreference(readStorageItem(SFX_VOLUME_STORAGE_KEY), DEFAULT_SFX_VOLUME);
}

/**
 * Owns browser audio engines, persisted mixer preferences, and phase-driven
 * playback. Callers decide which game actions deserve UI sounds; this hook
 * owns how those sounds and playlists live across application phases.
 */
export function useGameAudio(bridge: GameBridge, phase: MatchPhase) {
  const sound = useMemo(() => new SoundEngine({ volume: readSfxVolume() }), []);
  const music = useMemo(() => new MusicEngine(LOBBY_MUSIC_PLAYLIST, { volume: readMusicVolume() }), []);
  const [sfxMuted, setSfxMuted] = useState(() => readMutePreference(SFX_MUTE_STORAGE_KEY));
  const [sfxVolume, setSfxVolume] = useState(() => sound.getVolume());
  const [musicMuted, setMusicMuted] = useState(() => readMutePreference(MUSIC_MUTE_STORAGE_KEY));
  const phaseRef = useRef(phase);
  const previousPhaseRef = useRef(phase);
  const resumeMusicAfterPauseRef = useRef(false);

  phaseRef.current = phase;

  const startMusicPlaylist = useCallback((playlist: readonly MusicTrack[]) => {
    resumeMusicAfterPauseRef.current = false;
    music.pause();
    music.setPlaylist(playlist);
    if (!musicMuted) void music.play();
  }, [music, musicMuted]);

  const toggleSfxMute = useCallback(() => {
    if (sfxMuted) sound.unlock();
    setSfxMuted((current) => !current);
  }, [sfxMuted, sound]);

  const toggleMusicMute = useCallback(() => {
    const currentPhase = phaseRef.current;
    if (musicMuted) {
      if (currentPhase === 'paused') resumeMusicAfterPauseRef.current = true;
      else if (MUSIC_ACTIVE_PHASES.has(currentPhase)) void music.play();
    }
    setMusicMuted((current) => !current);
  }, [music, musicMuted]);

  const toggleAudioMute = useCallback(() => {
    const nextMuted = !(sfxMuted && musicMuted);
    if (!nextMuted) {
      sound.unlock();
      const currentPhase = phaseRef.current;
      if (currentPhase === 'paused') resumeMusicAfterPauseRef.current = true;
      else if (MUSIC_ACTIVE_PHASES.has(currentPhase)) void music.play();
    }
    setSfxMuted(nextMuted);
    setMusicMuted(nextMuted);
  }, [music, musicMuted, sfxMuted, sound]);

  const changeMusicVolume = useCallback((volume: number) => {
    music.setVolume(volume);
    writeStorageItem(MUSIC_VOLUME_STORAGE_KEY, String(music.getSnapshot().volume));
  }, [music]);

  const changeSfxVolume = useCallback((volume: number) => {
    sound.setVolume(volume);
    const nextVolume = sound.getVolume();
    setSfxVolume(nextVolume);
    writeStorageItem(SFX_VOLUME_STORAGE_KEY, String(nextVolume));
  }, [sound]);

  useEffect(() => {
    void sound.preload();
  }, [sound]);

  useEffect(() => {
    sound.setMuted(sfxMuted);
    writeStorageItem(SFX_MUTE_STORAGE_KEY, String(sfxMuted));
  }, [sfxMuted, sound]);

  useEffect(() => {
    music.setMuted(musicMuted);
    writeStorageItem(MUSIC_MUTE_STORAGE_KEY, String(musicMuted));
  }, [music, musicMuted]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;

    if (phase === 'ended' && previousPhase !== 'ended') {
      resumeMusicAfterPauseRef.current = false;
      music.stop();
      return;
    }

    if (
      phase === 'menu' &&
      previousPhase !== 'menu' &&
      music.getSnapshot().currentTrack?.id !== LOBBY_MUSIC_PLAYLIST[0]?.id
    ) {
      startMusicPlaylist(LOBBY_MUSIC_PLAYLIST);
      return;
    }

    if (phase === 'paused' && previousPhase !== 'paused') {
      resumeMusicAfterPauseRef.current = music.getSnapshot().isPlaying;
      music.pause();
      sound.pause();
      return;
    }

    if (previousPhase === 'paused' && phase !== 'paused') {
      sound.resume();
      if (phase === 'playing' && resumeMusicAfterPauseRef.current && !musicMuted) {
        void music.play();
      }
      resumeMusicAfterPauseRef.current = false;
    }
  }, [music, musicMuted, phase, sound, startMusicPlaylist]);

  useEffect(() => bridge.subscribeToEvents((event) => sound.playEvent(event)), [bridge, sound]);

  useEffect(() => () => {
    music.dispose();
    sound.dispose();
  }, [music, sound]);

  return {
    sound,
    music,
    sfxMuted,
    sfxVolume,
    musicMuted,
    audioMuted: sfxMuted && musicMuted,
    startMusicPlaylist,
    toggleSfxMute,
    toggleMusicMute,
    toggleAudioMute,
    changeMusicVolume,
    changeSfxVolume,
  };
}
