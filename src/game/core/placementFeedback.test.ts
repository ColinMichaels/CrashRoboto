import { describe, expect, it } from 'vitest';
import { createTowers } from './content';
import { evaluatePlacement } from './placementFeedback';
import type { InstallationState } from './types';

const context = () => ({
  charge: 10,
  commanderDeployed: false,
  towers: createTowers(),
  installations: [] as InstallationState[],
});

describe('placement feedback', () => {
  it('distinguishes battlefield, locked territory, obstruction, and valid lanes', () => {
    const state = context();
    expect(evaluatePlacement('player', 'zip', 500, 420, state)).toMatchObject({ failure: 'battlefield' });
    expect(evaluatePlacement('player', 'zip', 680, 220, state)).toMatchObject({ failure: 'territory' });
    expect(evaluatePlacement('player', 'zip', 800, 535, state)).toMatchObject({ failure: 'tower' });
    expect(evaluatePlacement('player', 'zip', 680, 420, state)).toMatchObject({ valid: true, lane: 'left' });
    expect(evaluatePlacement('player', 'zip', 800, 640, state)).toMatchObject({ valid: true });
    expect(evaluatePlacement('player', 'zip', 720, 560, state)).toMatchObject({ valid: true, lane: 'left' });

    state.towers.find((tower) => tower.id === 'enemy-left')!.hp = 0;
    expect(evaluatePlacement('player', 'zip', 680, 220, state)).toMatchObject({ valid: true, lane: 'left' });
  });

  it('reports resource and uniqueness failures before spatial rules', () => {
    expect(evaluatePlacement('player', 'rail', 680, 420, { ...context(), charge: 2 }))
      .toMatchObject({ failure: 'charge', message: 'NEED 3 MORE CHARGE' });
    expect(evaluatePlacement('player', 'vector', 680, 420, { ...context(), commanderDeployed: true }))
      .toMatchObject({ failure: 'unique' });
  });
});
