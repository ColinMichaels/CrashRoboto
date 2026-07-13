import { CARDS } from '../game/core/content';
import type {
  CardId,
  GameEvent,
  GameModeId,
  InstallationKind,
  ProgramKind,
  ProjectileKind,
  Team,
  TowerKind,
} from '../game/core/types';

export interface CardVoiceProfile {
  baseHz: number;
  formantHz: number;
  syllables: readonly number[];
  pace: number;
  grit: number;
  glide: number;
}

export const CARD_VOICE_PROFILES = {
  zip: { baseHz: 178, formantHz: 820, syllables: [1, 1.3, 0.88], pace: 0.14, grit: 0.28, glide: 0.72 },
  swarm: { baseHz: 212, formantHz: 1_020, syllables: [1, 0.91, 1.16, 1.04], pace: 0.11, grit: 0.34, glide: 0.82 },
  brute: { baseHz: 76, formantHz: 430, syllables: [1, 0.72], pace: 0.28, grit: 0.7, glide: 0.62 },
  rail: { baseHz: 91, formantHz: 520, syllables: [1, 1.05, 0.67], pace: 0.23, grit: 0.58, glide: 0.55 },
  pulse: { baseHz: 148, formantHz: 870, syllables: [1, 1.22, 1.04], pace: 0.16, grit: 0.27, glide: 0.88 },
  arc: { baseHz: 121, formantHz: 735, syllables: [1, 0.71, 1.34], pace: 0.18, grit: 0.66, glide: 0.69 },
  drone: { baseHz: 194, formantHz: 1_120, syllables: [1, 1.37, 0.93], pace: 0.13, grit: 0.24, glide: 1.18 },
  patch: { baseHz: 158, formantHz: 930, syllables: [1, 0.94, 1.19], pace: 0.17, grit: 0.18, glide: 1.12 },
  vector: { baseHz: 99, formantHz: 630, syllables: [1, 0.88, 1.23, 0.79], pace: 0.21, grit: 0.45, glide: 0.74 },
  aegis: { baseHz: 84, formantHz: 495, syllables: [1, 0.81, 1.04], pace: 0.24, grit: 0.61, glide: 0.66 },
  wraith: { baseHz: 132, formantHz: 790, syllables: [1, 1.46, 0.63], pace: 0.16, grit: 0.5, glide: 0.48 },
  viper: { baseHz: 114, formantHz: 675, syllables: [1, 0.78, 1.27], pace: 0.18, grit: 0.57, glide: 0.59 },
  emp: { baseHz: 181, formantHz: 1_260, syllables: [1, 1.54], pace: 0.12, grit: 0.42, glide: 0.45 },
  nano: { baseHz: 143, formantHz: 1_060, syllables: [1, 0.86, 1.09, 0.74], pace: 0.14, grit: 0.25, glide: 0.81 },
  gravity: { baseHz: 71, formantHz: 370, syllables: [1, 0.69, 0.47], pace: 0.24, grit: 0.76, glide: 0.38 },
  sentry: { baseHz: 131, formantHz: 835, syllables: [1, 1, 1.19], pace: 0.14, grit: 0.38, glide: 0.77 },
  foundry: { baseHz: 95, formantHz: 590, syllables: [1, 0.84, 1.15, 0.76], pace: 0.18, grit: 0.52, glide: 0.64 },
  firewall: { baseHz: 78, formantHz: 470, syllables: [1, 0.9, 0.82], pace: 0.22, grit: 0.67, glide: 0.7 },
} satisfies Record<CardId, CardVoiceProfile>;

export type SoundCue =
  | { kind: 'matchStart'; modeId: GameModeId; restart: boolean }
  | { kind: 'powerDrain'; warningMs: number; durationMs: number }
  | { kind: 'cardVoice'; cardId: CardId; variant: 'selected' | 'deployed'; team: Team }
  | { kind: 'reject' }
  | { kind: 'program'; program: ProgramKind; team: Team }
  | { kind: 'installation'; installation: InstallationKind; team: Team }
  | { kind: 'dash'; team: Team }
  | { kind: 'overdrive'; team: Team }
  | { kind: 'upgrade'; team: Team; tier: 1 | 2 }
  | { kind: 'weapon'; projectile: ProjectileKind; team: Team; attackId: number; impactDelay: number }
  | { kind: 'destruction'; size: 'unit' | 'installation'; team: Team; cause: 'projectile' | 'program' | 'decay' | 'power-drain' }
  | { kind: 'tower'; towerKind: TowerKind; team: Team }
  | { kind: 'matchEnd'; winner: Team | 'draw' };

export function getCardSelectionCue(cardId: CardId): SoundCue {
  return { kind: 'cardVoice', cardId, variant: 'selected', team: 'player' };
}

export function getProjectileImpactDelaySeconds(event: Extract<GameEvent, { type: 'projectileFired' }>): number {
  const distance = Math.hypot(event.target.x - event.source.x, event.target.y - event.source.y);
  if (event.projectile === 'rocket') return Math.max(0.17, Math.min(0.46, distance / 1_150));
  if (event.projectile === 'flame') return Math.max(0.07, Math.min(0.18, distance / 2_600));
  return Math.max(0.09, Math.min(0.26, distance / 2_000));
}

export function getSoundCuesForEvent(event: GameEvent): SoundCue[] {
  switch (event.type) {
    case 'matchStarted':
      return [{ kind: 'matchStart', modeId: event.modeId, restart: event.restart }];
    case 'roundStarted':
      return event.roundNumber === 1
        ? []
        : [{ kind: 'matchStart', modeId: event.modeId, restart: true }];
    case 'powerDrainStarted':
      return [{ kind: 'powerDrain', warningMs: event.warningMs, durationMs: event.durationMs }];
    case 'roundEnded':
      return event.matchComplete ? [] : [{ kind: 'matchEnd', winner: event.result.winner }];
    case 'cardSelected':
      return [{ kind: 'cardVoice', cardId: event.cardId, variant: 'selected', team: event.team }];
    case 'cardPlayed': {
      const category = CARDS[event.cardId].category;
      return event.team === 'player' && (category === 'unit' || category === 'commander')
        ? [{ kind: 'cardVoice', cardId: event.cardId, variant: 'deployed', team: event.team }]
        : [];
    }
    case 'playRejected':
    case 'upgradeRejected':
      return event.team === 'player' ? [{ kind: 'reject' }] : [];
    case 'programCast':
      return [{ kind: 'program', program: event.kind, team: event.team }];
    case 'installationPlaced':
      return [{ kind: 'installation', installation: event.kind, team: event.team }];
    case 'unitDashed':
      return [{ kind: 'dash', team: event.team }];
    case 'overdriveActivated':
      return [{ kind: 'overdrive', team: event.team }];
    case 'robotUpgraded':
      return [{ kind: 'upgrade', team: event.team, tier: event.tier }];
    case 'projectileFired':
      return [{
        kind: 'weapon',
        projectile: event.projectile,
        team: event.source.team,
        attackId: event.attackId,
        impactDelay: getProjectileImpactDelaySeconds(event),
      }];
    case 'entityDestroyed':
      if (event.entity.entityType === 'tower') return [];
      return [{
        kind: 'destruction',
        size: event.entity.entityType,
        team: event.entity.team,
        cause: event.cause,
      }];
    case 'impact':
      return [];
    case 'towerDestroyed':
      return [{ kind: 'tower', towerKind: event.tower.kind, team: event.tower.team }];
    case 'matchEnded':
      return [{ kind: 'matchEnd', winner: event.result.winner }];
  }
}
