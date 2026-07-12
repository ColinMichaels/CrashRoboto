import { CARDS, TOWER_PLACEMENT_CLEARANCE } from './content';
import { isDeploymentPoint, isProgramTargetPoint, PROGRAM_TARGET_BOUNDS } from './deployment';
import type {
  CardId,
  InstallationState,
  Lane,
  Team,
  TowerState,
} from './types';

export type PlacementFailure =
  | 'charge'
  | 'unique'
  | 'battlefield'
  | 'territory'
  | 'tower'
  | 'installation';

export interface PlacementFeedback {
  valid: boolean;
  lane: Lane;
  failure: PlacementFailure | null;
  message: string;
}

interface PlacementContext {
  charge: number;
  commanderDeployed: boolean;
  towers: readonly TowerState[];
  installations: readonly InstallationState[];
}

export function evaluatePlacement(
  team: Team,
  cardId: CardId,
  x: number,
  y: number,
  context: PlacementContext,
): PlacementFeedback {
  const card = CARDS[cardId];
  const lane: Lane = x < 800 ? 'left' : 'right';
  const result = (failure: PlacementFailure | null, message: string): PlacementFeedback => ({
    valid: failure === null,
    lane,
    failure,
    message,
  });

  if (context.charge + 0.001 < card.cost) {
    return result('charge', `NEED ${Math.ceil(card.cost - context.charge)} MORE CHARGE`);
  }
  if (card.category === 'commander' && context.commanderDeployed) {
    return result('unique', 'COMMANDER ALREADY ONLINE');
  }
  if (card.category === 'program') {
    return isProgramTargetPoint(x, y)
      ? result(null, 'PROGRAM TARGET LOCKED')
      : result('battlefield', 'TARGET INSIDE ACTIVE ARENA');
  }
  if (
    x < PROGRAM_TARGET_BOUNDS.minX ||
    x > PROGRAM_TARGET_BOUNDS.maxX ||
    y < PROGRAM_TARGET_BOUNDS.minY ||
    y > PROGRAM_TARGET_BOUNDS.maxY
  ) return result('battlefield', 'PLACE INSIDE ACTIVE ARENA');
  if (!isDeploymentPoint(team, x, y, context.towers)) {
    return result('territory', `${lane.toUpperCase()} TERRITORY LOCKED`);
  }

  const blockedByTower = context.towers.some(
    (tower) => tower.hp > 0 && Math.hypot(tower.x - x, tower.y - y) < TOWER_PLACEMENT_CLEARANCE[tower.kind],
  );
  if (blockedByTower) return result('tower', 'TOWER PAD OBSTRUCTED');
  if (
    card.category === 'installation' &&
    context.installations.some(
      (installation) => installation.hp > 0 && Math.hypot(installation.x - x, installation.y - y) < 96,
    )
  ) return result('installation', 'INSTALLATIONS TOO CLOSE');

  return result(null, `${lane.toUpperCase()} LANE READY`);
}
