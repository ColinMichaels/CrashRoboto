import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../game/core/types';
import { readStorageItem, writeStorageItem } from './browserStorage';
import { readLobbyLoadout, saveLobbyLoadout } from './loadoutStorage';

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser storage', () => {
  it('reads and writes through available local storage', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);

    expect(writeStorageItem('sound', 'muted')).toBe(true);
    expect(readStorageItem('sound')).toBe('muted');
  });

  it('returns neutral results when local storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(readStorageItem('missing')).toBeNull();
    expect(writeStorageItem('sound', 'muted')).toBe(false);
  });

  it('contains local storage access exceptions', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('Storage access denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      },
    } as Pick<Storage, 'getItem' | 'setItem'>);

    expect(readStorageItem('sound')).toBeNull();
    expect(writeStorageItem('sound', 'muted')).toBe(false);
  });
});

describe('lobby loadout persistence', () => {
  it('saves a mode change from an incomplete draft without replacing the last valid deck', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const lastValidDeck: CardId[] = [
      'swarm',
      'rail',
      'arc',
      'drone',
      'patch',
      'zip',
      'pulse',
      'brute',
    ];

    const defaults = readLobbyLoadout();
    saveLobbyLoadout({ ...defaults, modeId: 'core-siege', deck: lastValidDeck });
    saveLobbyLoadout({ ...defaults, modeId: 'relay-rush', deck: lastValidDeck.slice(0, -1) });

    expect(readLobbyLoadout()).toMatchObject({
      modeId: 'relay-rush',
      deck: lastValidDeck,
    });
  });
});
