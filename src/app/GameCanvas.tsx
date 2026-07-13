import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { GameBridge } from '../game/bridge/GameBridge';
import { createGame, type ArenaGame } from '../game/phaser/createGame';
import type {
  ArenaOrientation,
  ArenaPoint,
  ArenaViewport,
} from '../game/phaser/arenaViewport';

interface GameCanvasProps {
  bridge: GameBridge;
  onViewportChange?: (viewport: GameCanvasViewport) => void;
}

export interface GameCanvasViewport {
  orientation: ArenaOrientation;
  width: number;
  height: number;
}

export interface GameCanvasHandle {
  clientToWorld(clientX: number, clientY: number): ArenaPoint | null;
}

const toCanvasViewport = (viewport: ArenaViewport): GameCanvasViewport => ({
  orientation: viewport.orientation,
  width: viewport.screenWidth,
  height: viewport.screenHeight,
});

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { bridge, onViewportChange },
  ref,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ArenaGame | null>(null);
  const viewportChangeRef = useRef(onViewportChange);
  viewportChangeRef.current = onViewportChange;

  useImperativeHandle(ref, () => ({
    clientToWorld(clientX, clientY) {
      return gameRef.current?.clientToWorld(clientX, clientY) ?? null;
    },
  }), []);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const arenaGame = createGame(parent, bridge);
    gameRef.current = arenaGame;
    let animationFrame: number | null = null;

    const applySize = (width: number, height: number) => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        const viewport = arenaGame.resize(width, height);
        viewportChangeRef.current?.(toCanvasViewport(viewport));
      });
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) applySize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(parent);
    const bounds = parent.getBoundingClientRect();
    applySize(bounds.width, bounds.height);

    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      gameRef.current = null;
      arenaGame.destroy();
    };
  }, [bridge]);

  return <div className="game-canvas" ref={parentRef} aria-label="Crash Roboto battle arena" />;
});
