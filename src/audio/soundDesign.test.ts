import { describe, expect, it } from 'vitest';
import { CARDS } from '../game/core/content';
import { POWER_DRAIN_DURATION_MS, POWER_DRAIN_WARNING_MS } from '../game/core/MatchEngine';
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
      sourceId: 'source',
      sourceType: 'unit',
      targetType: 'tower',
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
    })).toEqual([{ kind: 'matchEnd', winner: 'player', final: true }]);
  });

  it('routes Power Drain startup to its dedicated full-resolution cue', () => {
    expect(getSoundCuesForEvent({
      type: 'powerDrainStarted',
      warningMs: POWER_DRAIN_WARNING_MS,
      durationMs: POWER_DRAIN_DURATION_MS,
    })).toEqual([{
      kind: 'powerDrain',
      warningMs: POWER_DRAIN_WARNING_MS,
      durationMs: POWER_DRAIN_DURATION_MS,
    }]);
  });

  it('routes series round cues without duplicating the final match-end signal', () => {
    const roundResult = {
      winner: 'player',
      reason: 'core',
      headline: 'CORE CRASHED',
      detail: 'Enemy command network is offline.',
    } as const;

    expect(getSoundCuesForEvent({
      type: 'roundStarted',
      modeId: 'best-of-three',
      roundNumber: 1,
      maxRounds: 3,
    })).toEqual([]);
    expect(getSoundCuesForEvent({
      type: 'roundStarted',
      modeId: 'best-of-three',
      roundNumber: 2,
      maxRounds: 3,
    })).toEqual([{ kind: 'matchStart', modeId: 'best-of-three', restart: true }]);
    expect(getSoundCuesForEvent({
      type: 'roundEnded',
      roundNumber: 1,
      result: roundResult,
      wins: { player: 1, enemy: 0 },
      matchComplete: false,
    })).toEqual([{ kind: 'matchEnd', winner: 'player', final: false }]);
    expect(getSoundCuesForEvent({
      type: 'roundEnded',
      roundNumber: 2,
      result: roundResult,
      wins: { player: 2, enemy: 0 },
      matchComplete: true,
    })).toEqual([]);
    expect(getSoundCuesForEvent({
      type: 'matchEnded',
      result: {
        winner: 'player',
        reason: 'round-majority',
        headline: 'SERIES SECURED',
        detail: 'Final series score 2–0.',
      },
    })).toEqual([{ kind: 'matchEnd', winner: 'player', final: true }]);
  });
});
