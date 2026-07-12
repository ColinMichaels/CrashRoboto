import { AUTO, Game, Scale } from 'phaser';
import type { GameBridge } from '../bridge/GameBridge';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../core/content';
import { BattleScene } from './BattleScene';

export function createGame(parent: HTMLElement, bridge: GameBridge): Game {
  return new Game({
    type: AUTO,
    parent,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    backgroundColor: '#071218',
    banner: false,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scale: {
      mode: Scale.FIT,
      autoCenter: Scale.CENTER_BOTH,
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
    },
    scene: [new BattleScene(bridge)],
  });
}
