import type { RobotUpgradeState } from '../../game/core/types';

const MARKS = ['I', 'II', 'III'] as const;

export interface RobotUpgradeBadgeInfo {
  mark: 'II' | 'III';
  tierPoints: number;
}

export function getRobotUpgradeBadgeInfo(
  upgrades?: RobotUpgradeState,
): RobotUpgradeBadgeInfo | null {
  if (!upgrades) return null;
  const tierPoints = upgrades.output + upgrades.range + upgrades.speed;
  if (tierPoints === 0) return null;
  const highestTier = Math.max(upgrades.output, upgrades.range, upgrades.speed) as 1 | 2;
  return { mark: MARKS[highestTier], tierPoints };
}

interface UpgradeBadgeProps {
  info: RobotUpgradeBadgeInfo | null;
  className?: string;
}

export function UpgradeBadge({ info, className = '' }: UpgradeBadgeProps) {
  if (!info) return null;

  return (
    <span className={`upgrade-badge${className ? ` ${className}` : ''}`} aria-hidden="true">
      <i />
      MK {info.mark}
    </span>
  );
}
