import type { MatchStage } from '../core/types';
import type { ArenaBoardTheme } from './arenaAssets';

export type ArenaAmbientKind = 'beacon' | 'flow' | 'vent';

export interface ArenaAmbientPoint {
  kind: ArenaAmbientKind;
  x: number;
  y: number;
  radius: number;
  phase: number;
  direction?: 1 | -1;
  opacity?: number;
}

export interface ArenaAmbientPresentation {
  primary: number;
  secondary: number;
  intensity: number;
  points: readonly ArenaAmbientPoint[];
}

export interface ArenaAmbientMotionSample {
  pulse: number;
  flowProgress: number;
  liftProgress: number;
}

export type TowerDamageBand = 'stable' | 'damaged' | 'critical' | 'destroyed';

export interface StageTransitionPresentation {
  label: string;
  detail: string;
  color: number;
}

const PRESENTATIONS: Readonly<Record<ArenaBoardTheme, ArenaAmbientPresentation>> = {
  foundry: {
    primary: 0x28e7d2,
    secondary: 0xf6c453,
    intensity: 0.92,
    points: [
      { kind: 'beacon', x: 175, y: 188, radius: 12, phase: 0.1 },
      { kind: 'beacon', x: 1425, y: 188, radius: 12, phase: 0.58 },
      { kind: 'vent', x: 305, y: 365, radius: 18, phase: 0.32 },
      { kind: 'vent', x: 1295, y: 365, radius: 18, phase: 0.78 },
      { kind: 'flow', x: 520, y: 285, radius: 120, phase: 0.2, direction: 1 },
      { kind: 'flow', x: 800, y: 285, radius: 120, phase: 0.46, direction: -1 },
      { kind: 'flow', x: 1080, y: 285, radius: 120, phase: 0.7, direction: 1 },
    ],
  },
  sewer: {
    primary: 0x8edc45,
    secondary: 0xd7ff84,
    intensity: 0.88,
    points: [
      { kind: 'beacon', x: 105, y: 325, radius: 10, phase: 0.08 },
      { kind: 'beacon', x: 1495, y: 325, radius: 10, phase: 0.54 },
      { kind: 'vent', x: 305, y: 175, radius: 20, phase: 0.25 },
      { kind: 'vent', x: 1295, y: 175, radius: 20, phase: 0.74 },
      { kind: 'flow', x: 570, y: 318, radius: 88, phase: 0.05, direction: 1, opacity: 0.72 },
      { kind: 'flow', x: 823, y: 318, radius: 50, phase: 0.36, direction: 1, opacity: 0.66 },
      { kind: 'flow', x: 1080, y: 318, radius: 104, phase: 0.68, direction: 1, opacity: 0.72 },
    ],
  },
  volcanic: {
    primary: 0xff6b3d,
    secondary: 0xffc857,
    intensity: 1.08,
    points: [
      { kind: 'beacon', x: 155, y: 220, radius: 15, phase: 0.15 },
      { kind: 'beacon', x: 1445, y: 220, radius: 15, phase: 0.62 },
      { kind: 'vent', x: 350, y: 330, radius: 24, phase: 0.28 },
      { kind: 'vent', x: 1250, y: 330, radius: 24, phase: 0.82 },
      { kind: 'flow', x: 530, y: 300, radius: 126, phase: 0.05, direction: 1 },
      { kind: 'flow', x: 800, y: 300, radius: 126, phase: 0.32, direction: -1 },
      { kind: 'flow', x: 1070, y: 300, radius: 126, phase: 0.59, direction: 1 },
    ],
  },
  orbital: {
    primary: 0x69dfff,
    secondary: 0xb66cff,
    intensity: 1,
    points: [
      { kind: 'beacon', x: 120, y: 145, radius: 11, phase: 0.04 },
      { kind: 'beacon', x: 1480, y: 145, radius: 11, phase: 0.48 },
      { kind: 'beacon', x: 170, y: 520, radius: 9, phase: 0.72 },
      { kind: 'beacon', x: 1430, y: 520, radius: 9, phase: 0.26 },
      { kind: 'flow', x: 520, y: 300, radius: 132, phase: 0.18, direction: 1 },
      { kind: 'flow', x: 800, y: 300, radius: 132, phase: 0.45, direction: -1 },
      { kind: 'flow', x: 1080, y: 300, radius: 132, phase: 0.72, direction: 1 },
    ],
  },
  alien: {
    primary: 0xb66cff,
    secondary: 0x85ffd8,
    intensity: 1.12,
    points: [
      { kind: 'beacon', x: 145, y: 245, radius: 16, phase: 0.06 },
      { kind: 'beacon', x: 1455, y: 245, radius: 16, phase: 0.53 },
      { kind: 'vent', x: 330, y: 390, radius: 21, phase: 0.3 },
      { kind: 'vent', x: 1270, y: 390, radius: 21, phase: 0.78 },
      { kind: 'flow', x: 500, y: 300, radius: 122, phase: 0.14, direction: 1 },
      { kind: 'flow', x: 770, y: 300, radius: 122, phase: 0.42, direction: -1 },
      { kind: 'flow', x: 1040, y: 300, radius: 122, phase: 0.7, direction: 1 },
    ],
  },
};

const STAGE_PRESENTATIONS: Readonly<Record<MatchStage, StageTransitionPresentation>> = {
  opening: {
    label: 'OPENING WINDOW',
    detail: 'CHARGE FLOW +25%',
    color: 0x85ffd8,
  },
  'relay-war': {
    label: 'RELAY WAR',
    detail: 'FRONTLINE UNLOCKED',
    color: 0x69dfff,
  },
  'core-surge': {
    label: 'CORE SURGE',
    detail: 'CHARGE REGEN ×2',
    color: 0xffc857,
  },
};

export function getArenaAmbientPresentation(theme: ArenaBoardTheme): ArenaAmbientPresentation {
  return PRESENTATIONS[theme];
}

export function getArenaAmbientMotionSample(
  point: ArenaAmbientPoint,
  nowMs: number,
  animated = true,
): ArenaAmbientMotionSample {
  const safeNow = animated && Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const direction = point.direction ?? 1;
  const pulse = 0.5 + Math.sin(safeNow / 620 + point.phase * Math.PI * 2) * 0.5;
  const flowProgress = (((safeNow / 1_700) * direction + point.phase) % 1 + 1) % 1;
  const liftProgress = ((safeNow / 1_250 + point.phase) % 1 + 1) % 1;
  return { pulse, flowProgress, liftProgress };
}

export function getTowerDamageBand(hp: number, maxHp: number): TowerDamageBand {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0 || hp <= 0) return 'destroyed';
  const ratio = hp / maxHp;
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 0.5) return 'damaged';
  return 'stable';
}

export function getStageTransitionPresentation(stage: MatchStage): StageTransitionPresentation {
  return STAGE_PRESENTATIONS[stage];
}

export function getRouteChevronProgress(nowMs: number, index: number, count: number): number {
  if (!Number.isFinite(nowMs) || count <= 0) return 0;
  const offset = Math.max(0, Math.min(count - 1, index)) / count;
  return ((nowMs / 900 + offset) % 1 + 1) % 1;
}
