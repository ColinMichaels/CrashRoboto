import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../game/core/types';
import {
  getInterfaceSoundPlan,
  getRecordedFamily,
  getRecordedSoundPlans,
  RECORDED_AUDIO_PATHS,
  RECORDED_PRELOAD_PATHS,
} from './recordedSoundDesign';
import { getCardSelectionCue, getSoundCuesForEvent } from './soundDesign';

describe('recorded sound design', () => {
  it('routes character cards to voice takes and non-character cards to designed selection SFX', () => {
    expect(getRecordedSoundPlans(getCardSelectionCue('zip'))[0]?.layers[0]?.family).toBe('voiceZip');
    expect(getRecordedSoundPlans(getCardSelectionCue('vector'))[0]?.layers[0]?.family).toBe('voiceVector');
    expect(getRecordedSoundPlans(getCardSelectionCue('emp'))[0]?.layers[0]?.family).toBe('empSelect');
    expect(getRecordedSoundPlans(getCardSelectionCue('firewall'))[0]?.layers[0]?.family).toBe('firewallSelect');
  });

  it('layers character deployment voice and identity effects where both were generated', () => {
    const cue = getSoundCuesForEvent({
      type: 'cardPlayed',
      team: 'player',
      cardId: 'brute',
      x: 100,
      y: 500,
    })[0];
    expect(cue && getRecordedSoundPlans(cue).map((plan) => plan.layers[0]?.family)).toEqual([
      'voiceBruteDeploy',
      'bruteDeploy',
    ]);
  });

  it('uses source identity to choose specialized weapons and delayed impacts', () => {
    const event = {
      type: 'projectileFired',
      attackId: 42,
      projectile: 'rocket',
      source: { id: 'player-rail-2', entityType: 'unit', team: 'player', x: 0, y: 0, radius: 30 },
      target: { id: 'enemy-core', entityType: 'tower', team: 'enemy', x: 400, y: 0, radius: 70 },
      amount: 145,
    } satisfies Extract<GameEvent, { type: 'projectileFired' }>;
    const cue = getSoundCuesForEvent(event)[0];
    const plan = cue && getRecordedSoundPlans(cue)[0];

    expect(plan?.layers.map((layer) => layer.family)).toEqual([
      'siegeCharge',
      'rocketHeavy',
      'impactRocketHeavy',
    ]);
    expect(plan?.layers[2]?.delay).toBeGreaterThan(0);
  });

  it('keeps round and final result stingers distinct', () => {
    expect(getRecordedSoundPlans({ kind: 'matchEnd', winner: 'player', final: false })[0]?.layers[0]?.family)
      .toBe('roundVictory');
    expect(getRecordedSoundPlans({ kind: 'matchEnd', winner: 'player', final: true })[0]?.layers[0]?.family)
      .toBe('matchVictory');
  });

  it('exposes semantic interface cues and a deduplicated browser asset manifest', () => {
    expect(getInterfaceSoundPlan('towerWeaponSelect').layers[0]?.family).toBe('uiTowerWeaponSelect');
    expect(new Set(RECORDED_AUDIO_PATHS).size).toBe(RECORDED_AUDIO_PATHS.length);
    expect(RECORDED_AUDIO_PATHS.length).toBeGreaterThan(250);
    expect(RECORDED_PRELOAD_PATHS.length).toBeLessThan(RECORDED_AUDIO_PATHS.length / 2);
    for (const path of RECORDED_AUDIO_PATHS) {
      expect(path.endsWith('.mp3')).toBe(true);
    }
    expect(getRecordedFamily('voiceZip').paths).toHaveLength(3);
  });
});
