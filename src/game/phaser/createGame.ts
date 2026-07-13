import { AUTO, Game, Scale } from 'phaser';
import type { GameBridge } from '../bridge/GameBridge';
import { BattleScene } from './BattleScene';
import {
  clientPointToArenaPoint,
  createArenaViewport,
  type ArenaPoint,
  type ArenaViewport,
} from './arenaViewport';

export interface ArenaGame {
  readonly game: Game;
  resize(width: number, height: number): ArenaViewport;
  clientToWorld(clientX: number, clientY: number): ArenaPoint | null;
  destroy(): void;
}

export function createGame(
  parent: HTMLElement,
  bridge: GameBridge,
  playerLevel: number,
  onReady?: () => void,
): ArenaGame {
  const initialBounds = parent.getBoundingClientRect();
  const initialViewport = createArenaViewport(initialBounds.width, initialBounds.height);
  const scene = new BattleScene(bridge, playerLevel, onReady);
  let viewport = initialViewport;
  const game = new Game({
    type: AUTO,
    parent,
    width: initialViewport.screenWidth,
    height: initialViewport.screenHeight,
    backgroundColor: '#071218',
    banner: false,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scale: {
      mode: Scale.RESIZE,
      autoCenter: Scale.NO_CENTER,
      width: initialViewport.screenWidth,
      height: initialViewport.screenHeight,
    },
    scene: [scene],
  });

  scene.resizeArenaViewport(initialViewport.screenWidth, initialViewport.screenHeight);

  return {
    game,
    resize(width, height) {
      const nextViewport = createArenaViewport(width, height);
      if (
        nextViewport.screenWidth === viewport.screenWidth &&
        nextViewport.screenHeight === viewport.screenHeight
      ) {
        return viewport;
      }
      viewport = nextViewport;
      game.scale.resize(viewport.screenWidth, viewport.screenHeight);
      scene.resizeArenaViewport(viewport.screenWidth, viewport.screenHeight);
      return viewport;
    },
    clientToWorld(clientX, clientY) {
      return clientPointToArenaPoint(clientX, clientY, parent.getBoundingClientRect(), viewport);
    },
    destroy() {
      game.destroy(true);
    },
  };
}
