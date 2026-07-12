import { describe, expect, it } from 'vitest';
import { CARDS } from '../game/core/content';
import type { GameEvent } from '../game/core/types';
import {
  CARD_VOICE_PROFILES,
  getProjectileImpactDelaySeconds,
  getSoundCuesForEvent,
} from './soundDesign';

describe('sound design', () => {
  it('defines a distinct robot-voice profile for every playable card', () => {
    expect(Object.keys(CARD_VOICE_PROFILES).sort()).toEqual(Object.keys(CARDS).sort());
    const signatures = Object.values(CARD_VOICE_PROFILES).map((profile) =>
      [profile.baseHz, profile.formantHz, profile.syllables.join(','), profile.glide].join(':'),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('routes selection and robot deployment to card-specific voices', () => {
    expect(getSoundCuesForEvent({ type: 'cardSelected', team: 'player', cardId: 'swarm' })).toEqual([
      { kind: 'cardVoice', cardId: 'swarm', variant: 'selected', team: 'player' },
    ]);
    expect(getSoundCuesForEvent({ type: 'cardPlayed', team: 'player', cardId: 'brute', x: 10, y: 20 })).toEqual([
      { kind: 'cardVoice', cardId: 'brute', variant: 'deployed', team: 'player' },
    ]);
    expect(getSoundCuesForEvent({ type: 'cardPlayed', team: 'player', cardId: 'emp', x: 10, y: 20 })).toEqual([]);
  });

  it('uses specialized placement cues for programs and installations', () => {
    expect(getSoundCuesForEvent({ type: 'programCast', team: 'player', kind: 'gravity', x: 0, y: 0, radius: 150 })).toEqual([
      { kind: 'program', program: 'gravity', team: 'player' },
    ]);
    expect(getSoundCuesForEvent({ type: 'installationPlaced', team: 'player', kind: 'firewall', x: 0, y: 0 })).toEqual([
      { kind: 'installation', installation: 'firewall', team: 'player' },
    ]);
  });

  it('routes shared weapons and schedules rocket impacts to the visual travel window', () => {
    const rocket = {
      type: 'projectileFired',
      attackId: 42,
      projectile: 'rocket',
      source: { id: 'source', entityType: 'unit', team: 'player', x: 0, y: 0, radius: 20 },
      target: { id: 'target', entityType: 'tower', team: 'enemy', x: 400, y: 0, radius: 40 },
      amount: 100,
    } satisfies Extract<GameEvent, { type: 'projectileFired' }>;

    expect(getProjectileImpactDelaySeconds(rocket)).toBeCloseTo(400 / 1_150);
    expect(getSoundCuesForEvent(rocket)).toEqual([{
      kind: 'weapon',
      projectile: 'rocket',
      team: 'player',
      attackId: 42,
      impactDelay: getProjectileImpactDelaySeconds(rocket),
    }]);
  });

  it('avoids duplicate tower explosions and retains critical start/end cues', () => {
    const towerRef = { id: 'enemy-core', entityType: 'tower', team: 'enemy', x: 800, y: 80, radius: 72 } as const;
    expect(getSoundCuesForEvent({ type: 'entityDestroyed', entity: towerRef, cause: 'projectile' })).toEqual([]);
    expect(getSoundCuesForEvent({ type: 'matchStarted', modeId: 'core-siege', restart: false })).toEqual([
      { kind: 'matchStart', modeId: 'core-siege', restart: false },
    ]);
    expect(getSoundCuesForEvent({
      type: 'matchEnded',
      result: { winner: 'player', reason: 'core', headline: 'Won', detail: 'Core destroyed.' },
    })).toEqual([{ kind: 'matchEnd', winner: 'player' }]);
  });
});
