import { describe, expect, it } from 'vitest';
import { getRobotUpgradeBadgeInfo } from './UpgradeBadge';

describe('robot upgrade badge', () => {
  it('stays hidden for an unmodified robot', () => {
    expect(getRobotUpgradeBadgeInfo({ output: 0, range: 0, speed: 0 })).toBeNull();
  });

  it('shows the highest installed Mark and total allocated tiers', () => {
    expect(getRobotUpgradeBadgeInfo({ output: 1, range: 1, speed: 0 })).toEqual({
      mark: 'II',
      tierPoints: 2,
    });
    expect(getRobotUpgradeBadgeInfo({ output: 2, range: 1, speed: 0 })).toEqual({
      mark: 'III',
      tierPoints: 3,
    });
  });
});
