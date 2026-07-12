import { describe, expect, it } from 'vitest';
import {
  getFirmwareBudgetForLevel,
  getMatchProgressAward,
  getPlayerLevel,
  getXpForLevel,
  MAX_FIRMWARE_BUDGET,
} from './progression';

describe('player progression', () => {
  it('levels from cumulative XP and adds one Firmware point every two levels', () => {
    expect(getXpForLevel(2)).toBe(150);
    expect(getXpForLevel(3)).toBe(450);
    expect(getPlayerLevel(149)).toBe(1);
    expect(getPlayerLevel(150)).toBe(2);
    expect(getPlayerLevel(450)).toBe(3);
    expect(getFirmwareBudgetForLevel(1)).toBe(6);
    expect(getFirmwareBudgetForLevel(2)).toBe(6);
    expect(getFirmwareBudgetForLevel(3)).toBe(7);
    expect(getFirmwareBudgetForLevel(20)).toBe(MAX_FIRMWARE_BUDGET);
  });

  it('awards participation, result, and score XP after a match', () => {
    expect(getMatchProgressAward(
      { player: 2_500, enemy: 900 },
      { winner: 'player', reason: 'core', headline: 'CORE CRASHED', detail: 'Done.' },
    )).toEqual({ xp: 550, scoreXp: 250, resultXp: 200 });
  });
});
