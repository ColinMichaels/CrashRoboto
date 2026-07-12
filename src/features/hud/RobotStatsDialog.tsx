import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCardSpriteStyle, TECH_CLASS_LABELS } from '../cards/cardPresentation';
import {
  getEffectiveRobotStats,
  getUpgradeCost,
  ROBOTS,
  UPGRADE_MULTIPLIERS,
} from '../../game/core/content';
import type {
  CardLevel,
  MatchSnapshot,
  RobotCardId,
  RobotDefinition,
  RobotUpgradeState,
  UpgradeStat,
  UpgradeTier,
} from '../../game/core/types';

interface BattleRobotStatsDialogProps {
  context?: 'battle';
  snapshot: MatchSnapshot;
  robotId: RobotCardId;
  onClose: () => void;
  onUpgrade: (robotId: RobotCardId, stat: UpgradeStat) => void;
}

interface LobbyRobotStatsDialogProps {
  context: 'lobby';
  robotId: RobotCardId;
  upgrades: RobotUpgradeState;
  cardLevel: CardLevel;
  firmwareRemaining: number;
  inLoadout: boolean;
  onClose: () => void;
  onUpgrade: (robotId: RobotCardId, stat: UpgradeStat) => void;
  onDowngrade: (robotId: RobotCardId, stat: UpgradeStat) => void;
}

type RobotStatsDialogProps = BattleRobotStatsDialogProps | LobbyRobotStatsDialogProps;

const STAT_LABELS: Record<UpgradeStat, string> = {
  output: 'OUTPUT',
  range: 'RANGE',
  speed: 'SPEED',
};

const MARKS = ['I', 'II', 'III'] as const;

function formatValue(value: number): string {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 0.05 ? String(rounded) : value.toFixed(1);
}

function getRangeClass(robot: RobotDefinition, range: number): string {
  if (!robot.ranged) return 'MELEE';
  if (range >= 200) return 'SIEGE';
  if (range >= 140) return 'LONG';
  if (range >= 100) return 'MEDIUM';
  return 'SHORT';
}

function getSpeedClass(speed: number): string {
  if (speed >= 100) return 'VERY FAST';
  if (speed >= 80) return 'FAST';
  if (speed >= 60) return 'MEDIUM';
  return 'SLOW';
}

function nextUpgradePercent(stat: UpgradeStat, tier: UpgradeTier): number | null {
  if (tier >= 2) return null;
  const nextTier = (tier + 1) as 1 | 2;
  return Math.round((UPGRADE_MULTIPLIERS[stat][nextTier] - UPGRADE_MULTIPLIERS[stat][tier]) * 100);
}

function OutputIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18V13m4 5V9m4 9V5m4 13v-8m4 8V7" />
    </svg>
  );
}

function RangeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
    </svg>
  );
}

function SpeedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 5 7 7-7 7m7-14 7 7-7 7" />
    </svg>
  );
}

function TierPips({ tier, label }: { tier: UpgradeTier; label: string }) {
  return (
    <span className="robot-stat-tiers" role="img" aria-label={`${label} Mark ${MARKS[tier]} of III`}>
      {[0, 1, 2].map((index) => (
        <i key={index} className={index <= tier ? 'is-active' : ''} aria-hidden="true" />
      ))}
    </span>
  );
}

interface StatRowProps {
  stat: UpgradeStat;
  tier: UpgradeTier;
  value: string;
  detail: string;
  context: 'battle' | 'lobby';
  availableResource: number;
  phase?: MatchSnapshot['phase'];
  inLoadout?: boolean;
  icon: ReactNode;
  onUpgrade: () => void;
  onDowngrade?: () => void;
}

function StatRow({
  stat,
  tier,
  value,
  detail,
  context,
  availableResource,
  phase,
  inLoadout = true,
  icon,
  onUpgrade,
  onDowngrade,
}: StatRowProps) {
  const lobby = context === 'lobby';
  const cost = lobby ? (tier < 2 ? 1 : null) : getUpgradeCost(tier);
  const percent = nextUpgradePercent(stat, tier);
  const phaseBlocked = !lobby && phase !== 'playing';
  const loadoutBlocked = lobby && !inLoadout;
  const resourceBlocked = cost !== null && availableResource + 0.001 < cost;
  const unavailable = cost === null || phaseBlocked || loadoutBlocked || resourceBlocked;
  const reason = cost === null
    ? 'MAX MK'
    : loadoutBlocked
      ? 'ADD CHIP'
      : phaseBlocked
      ? 'BATTLE ONLY'
      : resourceBlocked
        ? lobby ? 'NO POINTS' : `NEED ${cost}`
        : lobby ? '+1' : `${cost}`;
  const nextMark = tier < 2 ? MARKS[(tier + 1) as 1 | 2] : MARKS[2];
  const accessibleState = cost === null
    ? 'Maximum Mark reached.'
    : loadoutBlocked
      ? 'Add this chip to the active loadout before upgrading it.'
      : phaseBlocked
      ? 'Upgrades are available during battle only.'
      : resourceBlocked
        ? lobby
          ? `Requires one firmware point; none are available.`
          : `Requires ${cost} Charge; ${availableResource.toFixed(1)} available.`
        : lobby
          ? `Upgrade to Mark ${nextMark}; uses one of ${availableResource} available firmware points.`
          : `Upgrade to Mark ${nextMark}; costs ${cost} Charge.`;

  return (
    <div className="robot-stat-row" role="listitem">
      <span className="robot-stat-icon">{icon}</span>
      <span className="robot-stat-label">{STAT_LABELS[stat]}</span>
      <span className="robot-stat-value">{value}</span>
      <span className="robot-stat-detail">{detail}</span>
      <TierPips tier={tier} label={STAT_LABELS[stat]} />
      <span className={`robot-upgrade-actions${lobby ? ' is-lobby' : ''}`}>
        {lobby && (
          <button
            className="robot-downgrade-button"
            type="button"
            onClick={onDowngrade}
            disabled={tier === 0 || !inLoadout}
            aria-label={`Refund one ${STAT_LABELS[stat].toLowerCase()} firmware tier. Current Mark ${MARKS[tier]}.`}
          >
            −
          </button>
        )}
        <button
          className="robot-upgrade-button"
          type="button"
          onClick={onUpgrade}
          disabled={unavailable}
          aria-label={`Upgrade ${STAT_LABELS[stat].toLowerCase()}. Current Mark ${MARKS[tier]}. ${accessibleState}`}
        >
          <strong>{percent === null ? 'MAX' : `+${percent}%`}</strong>
          <span className={unavailable ? 'is-reason' : ''}>
            {cost !== null && !phaseBlocked && !loadoutBlocked && !resourceBlocked && <i aria-hidden="true" />}
            {reason}
          </span>
        </button>
      </span>
    </div>
  );
}

export function RobotStatsDialog(props: RobotStatsDialogProps) {
  const { robotId, onClose, onUpgrade } = props;
  const lobby = props.context === 'lobby';
  const robot = ROBOTS[robotId];
  const upgrades = lobby ? props.upgrades : props.snapshot.upgrades.player[robotId];
  const cardLevel = lobby ? props.cardLevel : props.snapshot.cardLevels.player[robotId];
  const availableResource = lobby ? props.firmwareRemaining : props.snapshot.charge.player;
  const phase = lobby ? undefined : props.snapshot.phase;
  const inLoadout = lobby ? props.inLoadout : true;
  const stats = useMemo(
    () => getEffectiveRobotStats(robotId, upgrades, cardLevel),
    [cardLevel, robotId, upgrades.output, upgrades.range, upgrades.speed],
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [robotId]);

  const outputValue = robot.heal ? formatValue(stats.heal) : formatValue(stats.damage);
  const outputDetail = robot.heal
    ? `${formatValue(stats.heal / robot.attackInterval)} HPS`
    : `${stats.dps.toFixed(1)} DPS`;

  const upgrade = (stat: UpgradeStat) => {
    const tier = upgrades[stat];
    const cost = lobby ? (tier < 2 ? 1 : null) : getUpgradeCost(tier);
    if (
      cost === null ||
      (!lobby && phase !== 'playing') ||
      (lobby && !inLoadout) ||
      availableResource + 0.001 < cost
    ) return;

    const nextTier = (tier + 1) as 1 | 2;
    const nextUpgrades: RobotUpgradeState = { ...upgrades, [stat]: nextTier };
    const nextStats = getEffectiveRobotStats(robotId, nextUpgrades, cardLevel);
    const nextValue = stat === 'output'
      ? robot.heal
        ? `${formatValue(nextStats.heal)} repair output`
        : `${formatValue(nextStats.damage)} damage`
      : stat === 'range'
        ? `${formatValue(nextStats.range)} range`
        : `${formatValue(nextStats.speed)} speed`;

    setAnnouncement(`${robot.shortName} ${STAT_LABELS[stat].toLowerCase()} upgraded to Mark ${MARKS[nextTier]}: ${nextValue}.`);
    onUpgrade(robotId, stat);
  };

  return (
    <section
      className={`robot-stats-panel tech-${robot.techClass}${lobby ? ' is-lobby-lab' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="robot-lab-title"
      aria-describedby="robot-lab-description"
      data-testid="robot-stats-dialog"
    >
      <header className="robot-lab-header">
        <span
          className={`robot-lab-portrait portrait-${robot.sheet}`}
          style={getCardSpriteStyle(robot.sheet, robot.frame)}
          aria-hidden="true"
        />
        <div className="robot-lab-identity">
          <span>ROBOT LAB</span>
          <h2 id="robot-lab-title">{robot.shortName} <i>//</i> {robot.name.toUpperCase()}</h2>
          <p>{TECH_CLASS_LABELS[robot.techClass]} · MASTERY MK {cardLevel} · FIRMWARE MK {MARKS[Math.max(upgrades.output, upgrades.range, upgrades.speed)]}</p>
        </div>
        <button ref={closeRef} className="robot-lab-close" type="button" onClick={onClose} aria-label="Close Robot Lab">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>
        </button>
      </header>

      <div className="robot-ability" id="robot-lab-description">
        <span>ABILITY</span>
        <strong>{robot.abilityName.toUpperCase()}</strong>
        <p>{robot.abilityDescription}</p>
      </div>

      <div className="robot-stat-list" role="list" aria-label="Robot performance and firmware upgrades">
        <StatRow
          stat="output"
          tier={upgrades.output}
          value={outputValue}
          detail={outputDetail}
          context={lobby ? 'lobby' : 'battle'}
          availableResource={availableResource}
          phase={phase}
          inLoadout={inLoadout}
          icon={<OutputIcon />}
          onUpgrade={() => upgrade('output')}
          onDowngrade={lobby ? () => props.onDowngrade(robotId, 'output') : undefined}
        />
        <StatRow
          stat="range"
          tier={upgrades.range}
          value={formatValue(stats.range)}
          detail={getRangeClass(robot, stats.range)}
          context={lobby ? 'lobby' : 'battle'}
          availableResource={availableResource}
          phase={phase}
          inLoadout={inLoadout}
          icon={<RangeIcon />}
          onUpgrade={() => upgrade('range')}
          onDowngrade={lobby ? () => props.onDowngrade(robotId, 'range') : undefined}
        />
        <StatRow
          stat="speed"
          tier={upgrades.speed}
          value={formatValue(stats.speed)}
          detail={getSpeedClass(stats.speed)}
          context={lobby ? 'lobby' : 'battle'}
          availableResource={availableResource}
          phase={phase}
          inLoadout={inLoadout}
          icon={<SpeedIcon />}
          onUpgrade={() => upgrade('speed')}
          onDowngrade={lobby ? () => props.onDowngrade(robotId, 'speed') : undefined}
        />
      </div>

      <footer className="robot-lab-footer">
        <span>MASTERY MK {cardLevel} · +{(cardLevel - 1) * 4}% OUTPUT / INTEGRITY</span>
        {lobby
          ? inLoadout
            ? `${availableResource} FIRMWARE ${availableResource === 1 ? 'POINT' : 'POINTS'} AVAILABLE · REFUND WITH −`
            : 'ADD THIS CHIP TO THE ACTIVE LOADOUT TO UPGRADE'
          : 'UPGRADES USE MATCH CHARGE'}
      </footer>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}
