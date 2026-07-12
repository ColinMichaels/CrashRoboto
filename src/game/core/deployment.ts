import type { Lane, Team, TowerState } from './types';

export interface ArenaPoint {
  x: number;
  y: number;
}

export interface DeploymentZone {
  kind: 'home' | 'breach';
  lane: Lane | 'both';
  points: readonly ArenaPoint[];
}

export const PROGRAM_TARGET_BOUNDS = {
  minX: 530,
  maxX: 1_070,
  minY: 55,
  maxY: 650,
} as const;

export const PROGRAM_TARGET_ZONE: readonly ArenaPoint[] = [
  { x: 590, y: 55 },
  { x: 1_010, y: 55 },
  { x: 1_070, y: 650 },
  { x: 530, y: 650 },
];

// These polygons follow the visible floor inside the arena walls. Keeping them
// here makes the simulation, pointer preview, and highlighted zone agree.
const HOME_DEPLOYMENT_ZONES: Record<Team, DeploymentZone> = {
  player: {
    kind: 'home',
    lane: 'both',
    points: [
      { x: 550, y: 360 },
      { x: 1_050, y: 360 },
      { x: 1_074, y: 650 },
      { x: 526, y: 650 },
    ],
  },
  enemy: {
    kind: 'home',
    lane: 'both',
    points: [
      { x: 590, y: 55 },
      { x: 1_010, y: 55 },
      { x: 1_050, y: 245 },
      { x: 550, y: 245 },
    ],
  },
};

const BREACH_DEPLOYMENT_ZONES: Record<Team, Record<Lane, DeploymentZone>> = {
  player: {
    left: {
      kind: 'breach',
      lane: 'left',
      points: [
        { x: 590, y: 55 },
        { x: 800, y: 55 },
        { x: 800, y: 245 },
        { x: 550, y: 245 },
      ],
    },
    right: {
      kind: 'breach',
      lane: 'right',
      points: [
        { x: 800, y: 55 },
        { x: 1_010, y: 55 },
        { x: 1_050, y: 245 },
        { x: 800, y: 245 },
      ],
    },
  },
  enemy: {
    left: {
      kind: 'breach',
      lane: 'left',
      points: [
        { x: 550, y: 360 },
        { x: 800, y: 360 },
        { x: 800, y: 650 },
        { x: 526, y: 650 },
      ],
    },
    right: {
      kind: 'breach',
      lane: 'right',
      points: [
        { x: 800, y: 360 },
        { x: 1_050, y: 360 },
        { x: 1_074, y: 650 },
        { x: 800, y: 650 },
      ],
    },
  },
};

export function isProgramTargetPoint(x: number, y: number): boolean {
  if (
    x < PROGRAM_TARGET_BOUNDS.minX ||
    x > PROGRAM_TARGET_BOUNDS.maxX ||
    y < PROGRAM_TARGET_BOUNDS.minY ||
    y > PROGRAM_TARGET_BOUNDS.maxY
  ) return false;
  return isPointInDeploymentPolygon({ x, y }, PROGRAM_TARGET_ZONE);
}

export function hasDeploymentBreach(
  team: Team,
  lane: Lane,
  towers: readonly TowerState[],
): boolean {
  const opponent: Team = team === 'player' ? 'enemy' : 'player';
  return towers.some(
    (tower) =>
      tower.team === opponent &&
      tower.kind === 'relay' &&
      tower.lane === lane &&
      tower.hp <= 0,
  );
}

export function getDeploymentZones(
  team: Team,
  towers: readonly TowerState[],
): readonly DeploymentZone[] {
  const zones: DeploymentZone[] = [HOME_DEPLOYMENT_ZONES[team]];
  if (hasDeploymentBreach(team, 'left', towers)) zones.push(BREACH_DEPLOYMENT_ZONES[team].left);
  if (hasDeploymentBreach(team, 'right', towers)) zones.push(BREACH_DEPLOYMENT_ZONES[team].right);
  return zones;
}

const isPointOnSegment = (point: ArenaPoint, start: ArenaPoint, end: ArenaPoint): boolean => {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 0.000_001) return false;
  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
};

export function isPointInDeploymentPolygon(
  point: ArenaPoint,
  polygon: readonly ArenaPoint[],
): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous];
    const end = polygon[index];
    if (isPointOnSegment(point, start, end)) return true;
    if (
      (start.y > point.y) !== (end.y > point.y) &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function isDeploymentPoint(
  team: Team,
  x: number,
  y: number,
  towers: readonly TowerState[],
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const point = { x, y };
  return getDeploymentZones(team, towers).some((zone) => {
    // Lane assignment uses x < 800 for left and x >= 800 for right. Apply the
    // same split at the breach seam so a legal left-pocket drop cannot spawn a
    // right-lane entity.
    if (zone.kind === 'breach' && zone.lane === 'left' && x >= 800) return false;
    if (zone.kind === 'breach' && zone.lane === 'right' && x < 800) return false;
    return isPointInDeploymentPolygon(point, zone.points);
  });
}
