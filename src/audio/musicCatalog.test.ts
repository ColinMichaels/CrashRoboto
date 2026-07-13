import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MUSIC_VOLUME,
  getBundledLobbyMusicPlaylist,
  getTrackTitleFromFilename,
  parseMusicVolumePreference,
} from './musicCatalog';
import { DEFAULT_SFX_VOLUME, parseAudioVolumePreference } from './audioVolume';

describe('music catalog helpers', () => {
  it('uses the audible default when no music level has been stored', () => {
    expect(DEFAULT_MUSIC_VOLUME).toBe(0.1);
    expect(DEFAULT_SFX_VOLUME).toBe(0.6);
    expect(parseMusicVolumePreference(null)).toBe(DEFAULT_MUSIC_VOLUME);
    expect(parseMusicVolumePreference('not-a-level')).toBe(DEFAULT_MUSIC_VOLUME);
  });

  it('preserves intentional stored silence and valid levels', () => {
    expect(parseMusicVolumePreference('0')).toBe(0);
    expect(parseMusicVolumePreference('0.64')).toBe(0.64);
  });

  it('rejects unsafe stored levels and preserves valid SFX levels', () => {
    expect(parseAudioVolumePreference('-0.1', DEFAULT_SFX_VOLUME)).toBe(DEFAULT_SFX_VOLUME);
    expect(parseAudioVolumePreference('1.1', DEFAULT_SFX_VOLUME)).toBe(DEFAULT_SFX_VOLUME);
    expect(parseAudioVolumePreference('Infinity', DEFAULT_SFX_VOLUME)).toBe(DEFAULT_SFX_VOLUME);
    expect(parseAudioVolumePreference('', DEFAULT_SFX_VOLUME)).toBe(DEFAULT_SFX_VOLUME);
    expect(parseAudioVolumePreference('   ', DEFAULT_SFX_VOLUME)).toBe(DEFAULT_SFX_VOLUME);
    expect(parseAudioVolumePreference('0', DEFAULT_SFX_VOLUME)).toBe(0);
    expect(parseAudioVolumePreference('0.37', DEFAULT_SFX_VOLUME)).toBe(0.37);
  });

  it('turns exported audio filenames into readable track titles', () => {
    expect(getTrackTitleFromFilename('neon_grid-final_mix.mp3')).toBe('neon grid final mix');
  });

  it('provides the dedicated looping lobby track', () => {
    expect(getBundledLobbyMusicPlaylist('/game')).toEqual([
      expect.objectContaining({
        id: 'crash-roboto-lobby-entrance',
        src: '/game/assets/audio/music/crash-roboto-lobby-entrance.mp3',
        source: 'bundled',
      }),
    ]);
  });
});
