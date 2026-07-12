import { useSyncExternalStore } from 'react';
import type { GameBridge } from '../../game/bridge/GameBridge';

export function useGameSnapshot(bridge: GameBridge) {
  return useSyncExternalStore(bridge.subscribe, bridge.getSnapshot, bridge.getSnapshot);
}
