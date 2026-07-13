import { describe, expect, it } from 'vitest';
import { DEFAULT_ENEMY_DECK, DEFAULT_PLAYER_DECK } from '../game/core/content';
import { getInitialAssetPlan } from './assetPreloader';

describe('asset preloader plan', () => {
  it('decodes lobby art and warms only the active arena board', () => {
    const plan = getInitialAssetPlan({
      player: [...DEFAULT_PLAYER_DECK],
      enemy: [...DEFAULT_ENEMY_DECK],
    }, 20);

    expect(plan.decodedImages).toContain('assets/game/arena-board-long.webp');
    expect(plan.warmedFiles).toContain('assets/game/arena-board-orbital.webp');
    expect(plan.warmedFiles).not.toContain('assets/game/arena-board-sewer.webp');
    expect(plan.warmedFiles).not.toContain('assets/game/arena-board-volcanic.webp');
    expect(plan.warmedFiles).not.toContain('assets/game/arena-board-alien.webp');
  });

  it('deduplicates assets shared by the lobby and arena manifest', () => {
    const plan = getInitialAssetPlan({
      player: [...DEFAULT_PLAYER_DECK],
      enemy: [...DEFAULT_ENEMY_DECK],
    }, 1);
    const allPaths = [...plan.decodedImages, ...plan.warmedFiles];

    expect(new Set(allPaths).size).toBe(allPaths.length);
    expect(plan.decodedImages).toContain('assets/game/system-sprites.webp');
    expect(plan.warmedFiles).not.toContain('assets/game/system-sprites.webp');
  });
});
