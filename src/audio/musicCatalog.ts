import { DEFAULT_MUSIC_VOLUME, parseAudioVolumePreference } from './audioVolume';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  artwork?: string;
  source: 'bundled' | 'local';
}

export { DEFAULT_MUSIC_VOLUME } from './audioVolume';

export function parseMusicVolumePreference(stored: string | null): number {
  return parseAudioVolumePreference(stored, DEFAULT_MUSIC_VOLUME);
}

function withTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function getBundledMusicPlaylist(baseUrl = import.meta.env.BASE_URL): MusicTrack[] {
  const base = withTrailingSlash(baseUrl);

  return [{
    id: 'crash-roboto-theme',
    title: 'Crash Roboto',
    artist: 'colinmichaels',
    src: `${base}assets/audio/music/crash-roboto.mp3`,
    artwork: `${base}assets/audio/music/crash-roboto-cover.jpg`,
    source: 'bundled',
  }];
}

export function getBundledLobbyMusicPlaylist(baseUrl = import.meta.env.BASE_URL): MusicTrack[] {
  const base = withTrailingSlash(baseUrl);

  return [{
    id: 'crash-roboto-lobby-entrance',
    title: 'Crash Roboto — Lobby Entrance',
    artist: 'colinmichaels',
    src: `${base}assets/audio/music/crash-roboto-lobby-entrance.mp3`,
    artwork: `${base}assets/audio/music/crash-roboto-cover.jpg`,
    source: 'bundled',
  }];
}

export function getTrackTitleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized || 'Untitled track';
}
