import { describe, expect, it } from 'vitest';
import {
  getFirmwareBudgetForLevel,
  getMatchProgressAward,
  getPlayerLevel,
  getXpForLevel,
  MAX_FIRMWARE_BUDGET,
  MAX_PLAYER_LEVEL,
} from './progression';
import {
  getArenaBoardUnlockForLevel,
  getNextArenaBoardUnlock,
} from './levelMilestones';

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
    expect(getFirmwareBudgetForLevel(MAX_PLAYER_LEVEL)).toBe(MAX_FIRMWARE_BUDGET);
    expect(getPlayerLevel(getXpForLevel(40))).toBe(40);
  });

  it('awards participation, result, and score XP after a match', () => {
    expect(getMatchProgressAward(
      { player: 2_500, enemy: 900 },
      { winner: 'player', reason: 'core', headline: 'CORE CRASHED', detail: 'Done.' },
    )).toEqual({ xp: 550, scoreXp: 250, resultXp: 200 });
  });

  it('unlocks each arena at the intended player-level boundary', () => {
    expect(getArenaBoardUnlockForLevel(5).theme).toBe('foundry');
    expect(getArenaBoardUnlockForLevel(6).theme).toBe('sewer');
    expect(getArenaBoardUnlockForLevel(10).theme).toBe('sewer');
    expect(getArenaBoardUnlockForLevel(11).theme).toBe('volcanic');
    expect(getArenaBoardUnlockForLevel(19).theme).toBe('volcanic');
    expect(getArenaBoardUnlockForLevel(20).theme).toBe('orbital');
    expect(getArenaBoardUnlockForLevel(39).theme).toBe('orbital');
    expect(getArenaBoardUnlockForLevel(40).theme).toBe('alien');
    expect(getNextArenaBoardUnlock(6)?.level).toBe(11);
    expect(getNextArenaBoardUnlock(20)?.level).toBe(40);
    expect(getNextArenaBoardUnlock(40)).toBeNull();
  });
});
