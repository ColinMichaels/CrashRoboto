import { useEffect, useRef } from 'react';
import type { GameBridge } from '../game/bridge/GameBridge';
import { createGame } from '../game/phaser/createGame';

interface GameCanvasProps {
  bridge: GameBridge;
}

export function GameCanvas({ bridge }: GameCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const game = createGame(parent, bridge);
    return () => game.destroy(true);
  }, [bridge]);

  return <div className="game-canvas" ref={parentRef} aria-label="Crash Roboto battle arena" />;
}
