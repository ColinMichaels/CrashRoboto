/// <reference types="vite/client" />

import type { GameCommand, MatchSnapshot } from './game/core/types';

declare global {
  interface Window {
    __CRASH_ROBOTO__?: {
      snapshot: () => MatchSnapshot;
      dispatch: (command: GameCommand) => boolean;
      advance: (ms: number) => void;
      damageTower: (id: string, amount: number) => void;
    };
  }
}

export {};
