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

  it('keeps Pulse Ranger energy fire and Relay ballistic fire sonically distinct', () => {
    const pulsePlan = getRecordedSoundPlans({
      kind: 'weapon',
      projectile: 'bullet',
      team: 'player',
      attackId: 7,
      impactDelay: 0.12,
      sourceId: 'player-pulse-1',
      sourceType: 'unit',
      targetType: 'unit',
    })[0];
    const relayPlan = getRecordedSoundPlans({
      kind: 'weapon',
      projectile: 'bullet',
      team: 'player',
      attackId: 8,
      impactDelay: 0.12,
      sourceId: 'player-relay-left',
      sourceType: 'tower',
      targetType: 'unit',
    })[0];

    expect(pulsePlan?.layers.map((layer) => layer.family)).toEqual(['pulseFire', 'impactPulse']);
    expect(relayPlan?.layers.map((layer) => layer.family)).toEqual(['towerRelayGun', 'impactBullet']);
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
    expect(RECORDED_AUDIO_PATHS.length).toBeGreaterThan(150);
    expect(RECORDED_PRELOAD_PATHS.length).toBeLessThan(RECORDED_AUDIO_PATHS.length);
    for (const path of RECORDED_AUDIO_PATHS) {
      expect(path.endsWith('.mp3')).toBe(true);
    }
    expect(getRecordedFamily('voiceZip').paths).toHaveLength(3);
    expect(getRecordedFamily('uiConfirm').paths).toHaveLength(1);
    expect(getRecordedFamily('rocketHeavy').paths).toHaveLength(1);
  });

  it('uses the licensed ballistic and energy mixes without replacing character voices', () => {
    expect(getRecordedFamily('bulletLight').paths).toEqual(['assets/audio/sfx/combat/licensed-weapons/GUN_LIGHT_FIRE__v01.mp3']);
    expect(getRecordedFamily('bulletHeavy').paths).toEqual(['assets/audio/sfx/combat/licensed-weapons/GUN_HEAVY_FIRE__v01.mp3']);
    expect(getRecordedFamily('pulseFire').paths).toEqual(['assets/audio/sfx/combat/licensed-weapons/LASER_PULSE_FIRE__v01.mp3']);
    expect(getRecordedFamily('towerRelayGun').paths).toEqual(['assets/audio/sfx/combat/licensed-weapons/GUN_TOWER_FIRE__v01.mp3']);
    expect(getRecordedFamily('impactBullet').paths.every((path) => path.includes('/licensed-weapons/IMPACT_BALLISTIC'))).toBe(true);
    expect(getRecordedFamily('impactPulse').paths.every((path) => path.includes('/licensed-weapons/IMPACT_ENERGY'))).toBe(true);
    expect(getRecordedFamily('voiceZip').paths.every((path) => path.includes('/voice/characters/zip/'))).toBe(true);
  });
});
