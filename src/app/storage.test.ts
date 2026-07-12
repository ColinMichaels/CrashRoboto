import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../game/core/types';
import { readStorageItem, writeStorageItem } from './browserStorage';
import {
  CARD_COLLECTION_STORAGE_KEY,
  readCardCollection,
  saveCardCollection,
} from './cardCollectionStorage';
import { readLobbyLoadout, saveLobbyLoadout } from './loadoutStorage';
import { readPlayerProgress, savePlayerProgress } from './playerProgressStorage';

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
  it('persists independent left and right Relay weapon packages', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const defaults = readLobbyLoadout();

    saveLobbyLoadout({
      ...defaults,
      towerWeapons: { left: 'rocket', right: 'flame' },
    });

    expect(readLobbyLoadout().towerWeapons).toEqual({ left: 'rocket', right: 'flame' });
  });

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

describe('player progression persistence', () => {
  it('stores completed matches and total experience independently of the loadout', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);

    savePlayerProgress({ xp: 725.9, matches: 4.8 });

    expect(readPlayerProgress()).toEqual({ xp: 725, matches: 4 });
  });
});

describe('card collection persistence', () => {
  it('round-trips unlocked cards, mastery levels, and partial copy progress', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const collection = readCardCollection();
    collection.aegis = { level: 2, copies: 7 };
    collection.zip = { level: 3, copies: 11 };

    expect(saveCardCollection(collection)).toBe(true);
    expect(readCardCollection()).toMatchObject({
      aegis: { level: 2, copies: 7 },
      zip: { level: 3, copies: 11 },
    });
  });

  it('falls back safely for malformed JSON and never relocks starters in partial data', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);

    storage.setItem(CARD_COLLECTION_STORAGE_KEY, '{bad json');
    expect(readCardCollection()).toMatchObject({
      zip: { level: 1, copies: 0 },
      aegis: { level: 0, copies: 0 },
    });

    storage.setItem(CARD_COLLECTION_STORAGE_KEY, JSON.stringify({
      zip: { level: 0, copies: -100 },
      aegis: { level: 0, copies: 8 },
      viper: { level: 'five', copies: [] },
    }));
    expect(readCardCollection()).toMatchObject({
      zip: { level: 1, copies: 0 },
      aegis: { level: 1, copies: 0 },
      viper: { level: 0, copies: 0 },
      pulse: { level: 1, copies: 0 },
    });
  });

  it('contains unavailable-storage failures without mutating defaults', () => {
    vi.stubGlobal('localStorage', undefined);
    const collection = readCardCollection();

    expect(collection.zip.level).toBe(1);
    expect(collection.aegis.level).toBe(0);
    expect(saveCardCollection(collection)).toBe(false);
  });
});
