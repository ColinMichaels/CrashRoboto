import { describe, expect, it } from 'vitest';
import { createTowers } from './content';
import {
  PROGRAM_TARGET_BOUNDS,
  getDeploymentZones,
  hasDeploymentBreach,
  isDeploymentPoint,
  isProgramTargetPoint,
} from './deployment';

describe('deployment geometry', () => {
  it('matches each home area to the perspective-shaped arena floor', () => {
    const towers = createTowers();

    expect(isDeploymentPoint('player', 550, 360, towers)).toBe(true);
    expect(isDeploymentPoint('player', 549, 360, towers)).toBe(false);
    expect(isDeploymentPoint('player', 526, 650, towers)).toBe(true);
    expect(isDeploymentPoint('player', 525, 650, towers)).toBe(false);

    expect(isDeploymentPoint('enemy', 590, 55, towers)).toBe(true);
    expect(isDeploymentPoint('enemy', 589, 55, towers)).toBe(false);
    expect(isDeploymentPoint('enemy', 550, 245, towers)).toBe(true);
    expect(isDeploymentPoint('enemy', 549, 245, towers)).toBe(false);
  });

  it('unlocks only the enemy-side pocket matching a destroyed Relay', () => {
    const towers = createTowers();
    const enemyLeft = towers.find((tower) => tower.id === 'enemy-left')!;
    const enemyRight = towers.find((tower) => tower.id === 'enemy-right')!;

    expect(getDeploymentZones('player', towers)).toHaveLength(1);
    expect(isDeploymentPoint('player', 680, 220, towers)).toBe(false);
    expect(isDeploymentPoint('player', 920, 220, towers)).toBe(false);

    enemyLeft.hp = 0;
    expect(hasDeploymentBreach('player', 'left', towers)).toBe(true);
    expect(hasDeploymentBreach('player', 'right', towers)).toBe(false);
    expect(getDeploymentZones('player', towers)).toHaveLength(2);
    expect(isDeploymentPoint('player', 680, 220, towers)).toBe(true);
    expect(isDeploymentPoint('player', 800, 200, towers)).toBe(false);
    expect(isDeploymentPoint('player', 920, 220, towers)).toBe(false);
    expect(isDeploymentPoint('player', 680, 300, towers)).toBe(false);

    enemyRight.hp = 0;
    expect(getDeploymentZones('player', towers)).toHaveLength(3);
    expect(isDeploymentPoint('player', 800, 200, towers)).toBe(true);
    expect(isDeploymentPoint('player', 920, 220, towers)).toBe(true);
  });

  it('applies the same lane breach rule to enemy deployment', () => {
    const towers = createTowers();
    towers.find((tower) => tower.id === 'player-right')!.hp = 0;

    expect(isDeploymentPoint('enemy', 920, 440, towers)).toBe(true);
    expect(isDeploymentPoint('enemy', 680, 440, towers)).toBe(false);
    expect(isDeploymentPoint('enemy', 920, 300, towers)).toBe(false);
  });

  it('keeps Program targeting inclusive across the elongated active battlefield', () => {
    expect(PROGRAM_TARGET_BOUNDS.maxY - PROGRAM_TARGET_BOUNDS.minY)
      .toBeGreaterThan(PROGRAM_TARGET_BOUNDS.maxX - PROGRAM_TARGET_BOUNDS.minX);
    expect(isProgramTargetPoint(800, 55)).toBe(true);
    expect(isProgramTargetPoint(800, 650)).toBe(true);
    expect(isProgramTargetPoint(529, 650)).toBe(false);
    expect(isProgramTargetPoint(1_071, 650)).toBe(false);
  });
});
