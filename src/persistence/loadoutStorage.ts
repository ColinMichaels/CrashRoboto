import {
  createEmptyRobotUpgrades,
  createDefaultTowerWeapons,
  DEFAULT_GAME_MODE_ID,
  DEFAULT_PLAYER_DECK,
  GAME_MODES,
  isValidDeck,
  normalizePlayerUpgrades,
  normalizeTowerWeapons,
} from '../game/core/content';
import { MAX_FIRMWARE_BUDGET } from '../game/core/progression';
import { DEFAULT_PILOT_ID, isPilotId, type PilotId } from '../game/core/pilots';
import type { CardId, GameModeId, RobotCardId, RobotUpgradeState, TowerWeaponLoadout } from '../game/core/types';
import { readStorageItem, writeStorageItem } from './browserStorage';

const LOADOUT_STORAGE_KEY = 'crash-roboto-loadout-v1';

export interface LobbyLoadout {
  modeId: GameModeId;
  deck: CardId[];
  pilotId: PilotId;
  upgrades: Record<RobotCardId, RobotUpgradeState>;
  towerWeapons: TowerWeaponLoadout;
}

interface StoredLoadout {
  version: unknown;
  modeId: unknown;
  deck: unknown;
  pilotId?: unknown;
  upgrades?: unknown;
  towerWeapons?: unknown;
}

const defaultLoadout = (): LobbyLoadout => ({
  modeId: DEFAULT_GAME_MODE_ID,
  deck: [...DEFAULT_PLAYER_DECK],
  pilotId: DEFAULT_PILOT_ID,
  upgrades: createEmptyRobotUpgrades(),
  towerWeapons: createDefaultTowerWeapons(),
});

export function readLobbyLoadout(): LobbyLoadout {
  try {
    const stored = JSON.parse(readStorageItem(LOADOUT_STORAGE_KEY) ?? 'null') as StoredLoadout | null;
    if (
      (stored?.version !== 1 && stored?.version !== 2 && stored?.version !== 3) ||
      typeof stored.modeId !== 'string' ||
      !Object.hasOwn(GAME_MODES, stored.modeId) ||
      !isValidDeck(stored.deck)
    ) {
      return defaultLoadout();
    }
    const deck = [...stored.deck];
    return {
      modeId: stored.modeId as GameModeId,
      deck,
      pilotId: isPilotId(stored.pilotId) ? stored.pilotId : DEFAULT_PILOT_ID,
      upgrades: normalizePlayerUpgrades(stored.upgrades, deck, MAX_FIRMWARE_BUDGET) ?? createEmptyRobotUpgrades(),
      towerWeapons: normalizeTowerWeapons(stored.towerWeapons) ?? createDefaultTowerWeapons(),
    };
  } catch {
    return defaultLoadout();
  }
}

export function saveLobbyLoadout(loadout: LobbyLoadout): void {
  if (!Object.hasOwn(GAME_MODES, loadout.modeId)) return;
  const previous = readLobbyLoadout();
  const deck = isValidDeck(loadout.deck) ? loadout.deck : previous.deck;
  const upgrades = normalizePlayerUpgrades(loadout.upgrades, deck, MAX_FIRMWARE_BUDGET) ?? previous.upgrades;
  const towerWeapons = normalizeTowerWeapons(loadout.towerWeapons) ?? previous.towerWeapons;
  const stored: StoredLoadout = {
    version: 3,
    modeId: loadout.modeId,
    deck: [...deck],
    pilotId: isPilotId(loadout.pilotId) ? loadout.pilotId : previous.pilotId,
    upgrades,
    towerWeapons,
  };
  writeStorageItem(LOADOUT_STORAGE_KEY, JSON.stringify(stored));
}

export function resetLobbyLoadout(): LobbyLoadout {
  const loadout = defaultLoadout();
  saveLobbyLoadout(loadout);
  return loadout;
}
