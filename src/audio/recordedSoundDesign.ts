import type { CardId, Team } from '../game/core/types';
import type { SoundCue } from './soundDesign';

export type RecordedSoundBus = 'ui' | 'voice' | 'combat' | 'critical';
export type RecordedSoundPriority = 0 | 1 | 2 | 3;
export type RecordedSoundCategory = 'voice' | 'other';

interface RecordedFamily {
  paths: readonly string[];
  gain: number;
}

export interface RecordedSoundLayer {
  family: RecordedFamilyId;
  delay?: number;
  gain?: number;
  playbackRate?: number;
}

export interface RecordedSoundPlan {
  tag: string;
  bus: RecordedSoundBus;
  priority: RecordedSoundPriority;
  category?: RecordedSoundCategory;
  throttleSeconds?: number;
  layers: readonly RecordedSoundLayer[];
}

export type InterfaceSoundId =
  | 'confirm'
  | 'cardAdd'
  | 'cardRemove'
  | 'loadoutPreset'
  | 'modeSelect'
  | 'pilotSelect'
  | 'towerWeaponSelect'
  | 'upgradeOne'
  | 'upgradeTwo'
  | 'upgradeRemove'
  | 'panelOpen'
  | 'panelClose'
  | 'pause'
  | 'resume'
  | 'matchLaunch';

function variants(folder: string, cue: string, count: number, gain = 1): RecordedFamily {
  return {
    paths: Array.from(
      { length: count },
      (_, index) => `assets/audio/${folder}/${cue}__v${String(index + 1).padStart(2, '0')}.mp3`,
    ),
    gain,
  };
}

export const RECORDED_SOUND_FAMILIES = {
  uiConfirm: variants('sfx/ui', 'UI_CONFIRM', 3, 0.72),
  uiReject: variants('sfx/ui', 'UI_REJECT', 3, 0.82),
  uiCardAdd: variants('sfx/ui', 'UI_CARD_ADD', 3, 0.78),
  uiCardRemove: variants('sfx/ui', 'UI_CARD_REMOVE', 3, 0.78),
  uiLoadoutPreset: variants('sfx/ui', 'UI_LOADOUT_PRESET', 3, 0.78),
  uiModeSelect: variants('sfx/ui', 'UI_MODE_SELECT', 3, 0.78),
  uiPilotSelect: variants('sfx/ui', 'UI_PILOT_SELECT', 3, 0.78),
  uiTowerWeaponSelect: variants('sfx/ui', 'UI_TOWER_WEAPON_SELECT', 3, 0.8),
  uiUpgradeOne: variants('sfx/ui', 'UI_UPGRADE_TIER_1', 3, 0.82),
  uiUpgradeTwo: variants('sfx/ui', 'UI_UPGRADE_TIER_2', 3, 0.82),
  uiUpgradeRemove: variants('sfx/ui', 'UI_UPGRADE_REMOVE', 3, 0.78),
  uiPanelOpen: variants('sfx/ui', 'UI_PANEL_OPEN', 3, 0.72),
  uiPanelClose: variants('sfx/ui', 'UI_PANEL_CLOSE', 3, 0.72),
  uiPause: variants('sfx/ui', 'UI_PAUSE', 2, 0.8),
  uiResume: variants('sfx/ui', 'UI_RESUME', 2, 0.8),

  matchLaunch: variants('sfx/match_flow', 'MATCH_LAUNCH', 3, 0.9),
  matchStartCoreSiege: variants('sfx/match_flow', 'MATCH_START_CORE_SIEGE', 3, 0.9),
  matchStartTurboGrid: variants('sfx/match_flow', 'MATCH_START_TURBO_GRID', 3, 0.9),
  matchStartRelayRush: variants('sfx/match_flow', 'MATCH_START_RELAY_RUSH', 3, 0.9),
  matchStartBestOfThree: variants('sfx/match_flow', 'MATCH_START_BEST_OF_THREE', 3, 0.9),
  roundStart: variants('sfx/match_flow', 'ROUND_START', 3, 0.86),
  powerDrainWarning: variants('sfx/match_flow', 'POWER_DRAIN_WARNING', 3, 0.88),
  powerDrainPulse: variants('sfx/match_flow', 'POWER_DRAIN_PULSE', 4, 0.82),
  roundVictory: variants('sfx/match_flow', 'ROUND_VICTORY', 3, 0.88),
  roundDefeat: variants('sfx/match_flow', 'ROUND_DEFEAT', 3, 0.88),
  matchVictory: variants('sfx/match_flow', 'MATCH_VICTORY', 3, 0.9),
  matchDefeat: variants('sfx/match_flow', 'MATCH_DEFEAT', 3, 0.9),
  matchDraw: variants('sfx/match_flow', 'MATCH_DRAW', 3, 0.9),

  voiceZip: variants('voice/characters/zip', 'VOICE_ZIP', 3, 1),
  voiceZipDeploy: variants('voice/characters/zip', 'VOICE_ZIP_DEPLOY', 3, 1),
  voiceSwarm: variants('voice/characters/swarm', 'VOICE_SWARM', 3, 1),
  voiceSwarmDeploy: variants('voice/characters/swarm', 'VOICE_SWARM_DEPLOY', 3, 1),
  voiceBrute: variants('voice/characters/brute', 'VOICE_BRUTE', 3, 1),
  voiceBruteDeploy: variants('voice/characters/brute', 'VOICE_BRUTE_DEPLOY', 3, 1),
  voiceRail: variants('voice/characters/rail', 'VOICE_RAIL', 3, 1),
  voiceRailDeploy: variants('voice/characters/rail', 'VOICE_RAIL_DEPLOY', 3, 1),
  voicePulse: variants('voice/characters/pulse', 'VOICE_PULSE', 3, 1),
  voicePulseDeploy: variants('voice/characters/pulse', 'VOICE_PULSE_DEPLOY', 3, 1),
  voiceArc: variants('voice/characters/arc', 'VOICE_ARC', 3, 1),
  voiceArcDeploy: variants('voice/characters/arc', 'VOICE_ARC_DEPLOY', 3, 1),
  voiceDrone: variants('voice/characters/drone', 'VOICE_DRONE', 3, 1),
  voiceDroneDeploy: variants('voice/characters/drone', 'VOICE_DRONE_DEPLOY', 3, 1),
  voicePatch: variants('voice/characters/patch', 'VOICE_PATCH', 3, 1),
  voicePatchDeploy: variants('voice/characters/patch', 'VOICE_PATCH_DEPLOY', 3, 1),
  voiceVector: variants('voice/characters/vector', 'VOICE_VECTOR', 3, 1),
  voiceVectorDeploy: variants('voice/characters/vector', 'VOICE_VECTOR_DEPLOY', 3, 1),
  voiceVectorOverdrive: variants('voice/characters/vector', 'VOICE_VECTOR_OVERDRIVE', 3, 1),
  voiceAegis: variants('voice/characters/aegis', 'VOICE_AEGIS', 3, 1),
  voiceAegisDeploy: variants('voice/characters/aegis', 'VOICE_AEGIS_DEPLOY', 3, 1),
  voiceWraith: variants('voice/characters/wraith', 'VOICE_WRAITH', 3, 1),
  voiceWraithDeploy: variants('voice/characters/wraith', 'VOICE_WRAITH_DEPLOY', 3, 1),
  voiceViper: variants('voice/characters/viper', 'VOICE_VIPER', 3, 1),
  voiceViperDeploy: variants('voice/characters/viper', 'VOICE_VIPER_DEPLOY', 3, 1),

  empSelect: variants('sfx/cards/abilities', 'CARD_EMP_SELECT', 3, 0.86),
  empDetonate: variants('sfx/cards/abilities', 'CARD_EMP_DETONATE', 4, 0.92),
  nanoSelect: variants('sfx/cards/abilities', 'CARD_NANO_SELECT', 3, 0.86),
  nanoRelease: variants('sfx/cards/abilities', 'CARD_NANO_RELEASE', 3, 0.9),
  gravitySelect: variants('sfx/cards/abilities', 'CARD_GRAVITY_SELECT', 3, 0.86),
  gravityCollapse: variants('sfx/cards/abilities', 'CARD_GRAVITY_COLLAPSE', 3, 0.94),
  sentrySelect: variants('sfx/cards/installations', 'CARD_SENTRY_SELECT', 3, 0.86),
  sentryPlace: variants('sfx/cards/installations', 'CARD_SENTRY_PLACE', 3, 0.9),
  foundrySelect: variants('sfx/cards/installations', 'CARD_FOUNDRY_SELECT', 3, 0.86),
  foundryPlace: variants('sfx/cards/installations', 'CARD_FOUNDRY_PLACE', 3, 0.9),
  firewallSelect: variants('sfx/cards/installations', 'CARD_FIREWALL_SELECT', 3, 0.86),
  firewallPlace: variants('sfx/cards/installations', 'CARD_FIREWALL_PLACE', 3, 0.9),

  swarmDeploy: variants('sfx/cards/units', 'CARD_SWARM_DEPLOY', 3, 0.78),
  swarmAttack: variants('sfx/cards/units', 'CARD_SWARM_ATTACK', 4, 0.8),
  swarmDestroy: variants('sfx/cards/units', 'CARD_SWARM_DESTROY', 4, 0.86),
  bruteDeploy: variants('sfx/cards/units', 'CARD_BRUTE_DEPLOY', 3, 0.82),
  railDeploy: variants('sfx/cards/units', 'CARD_RAIL_DEPLOY', 3, 0.82),
  arcBoot: variants('sfx/cards/units', 'CARD_ARC_BOOT', 3, 0.78),
  droneLiftoff: variants('sfx/cards/units', 'CARD_DRONE_LIFTOFF', 3, 0.8),
  patchDeploy: variants('sfx/cards/units', 'CARD_PATCH_DEPLOY', 3, 0.78),
  vectorDeploy: variants('sfx/cards/units', 'CARD_VECTOR_DEPLOY', 3, 0.82),
  vectorOverdrive: variants('sfx/cards/units', 'CARD_VECTOR_OVERDRIVE_START', 3, 0.82),
  aegisBarrier: variants('sfx/cards/units', 'CARD_AEGIS_BARRIER_BOOT', 3, 0.82),
  wraithAttack: variants('sfx/cards/units', 'CARD_WRAITH_ATTACK', 4, 0.82),
  wraithDestroy: variants('sfx/cards/units', 'CARD_WRAITH_DESTROY', 3, 0.88),
  viperAttack: variants('sfx/cards/units', 'CARD_VIPER_ATTACK', 4, 0.82),

  phaseDepart: variants('sfx/movement_mechanics', 'MOVEMENT_PHASE_DEPART', 3, 0.84),
  phaseArrive: variants('sfx/movement_mechanics', 'MOVEMENT_PHASE_ARRIVE', 3, 0.84),
  microbotAttack: variants('sfx/microbot', 'MICROBOT_ATTACK', 4, 0.78),
  microbotDestroy: variants('sfx/microbot', 'MICROBOT_DESTROY', 4, 0.84),

  bulletLight: variants('sfx/combat/weapons', 'WEAPON_BULLET_LIGHT_FIRE', 4, 0.8),
  bulletHeavy: variants('sfx/combat/weapons', 'WEAPON_BULLET_HEAVY_FIRE', 4, 0.82),
  pulseFire: variants('sfx/combat/weapons', 'WEAPON_PULSE_FIRE', 4, 0.82),
  sentryBurst: variants('sfx/combat/weapons', 'WEAPON_SENTRY_BURST', 4, 0.8),
  rocketLight: variants('sfx/combat/weapons', 'WEAPON_ROCKET_LAUNCH_LIGHT', 4, 0.84),
  rocketHeavy: variants('sfx/combat/weapons', 'WEAPON_ROCKET_LAUNCH_HEAVY', 4, 0.88),
  siegeCharge: variants('sfx/combat/weapons', 'WEAPON_SIEGE_CHARGE', 3, 0.76),
  arcCharge: variants('sfx/combat/weapons', 'WEAPON_ARC_CHARGE', 3, 0.8),
  flameIgnite: variants('sfx/combat/weapons', 'WEAPON_FLAME_IGNITE', 3, 0.82),
  impactBullet: variants('sfx/combat/impacts', 'IMPACT_BULLET_ARMOR', 4, 0.68),
  impactPulse: variants('sfx/combat/impacts', 'IMPACT_PULSE', 4, 0.72),
  impactRocketSmall: variants('sfx/combat/impacts', 'IMPACT_ROCKET_SMALL', 4, 0.78),
  impactRocketHeavy: variants('sfx/combat/impacts', 'IMPACT_ROCKET_HEAVY', 4, 0.84),
  impactArc: variants('sfx/combat/impacts', 'IMPACT_ARC_PRIMARY', 4, 0.78),
  impactFlame: variants('sfx/combat/impacts', 'IMPACT_FLAME', 4, 0.72),
  towerRelayGun: variants('sfx/towers', 'TOWER_RELAY_GUN_FIRE', 4, 0.82),
  towerRelayRocket: variants('sfx/towers', 'TOWER_RELAY_ROCKET_FIRE', 4, 0.86),
  towerRelayFlame: variants('sfx/towers', 'TOWER_RELAY_FLAME_LOOP', 3, 0.72),
  towerCoreRocket: variants('sfx/towers', 'TOWER_CORE_ROCKET_FIRE', 4, 0.9),

  destroyRobotSmall: variants('sfx/destruction', 'DESTROY_ROBOT_SMALL', 4, 0.86),
  destroyRobotHeavy: variants('sfx/destruction', 'DESTROY_ROBOT_HEAVY', 4, 0.9),
  destroyRobotFlying: variants('sfx/destruction', 'DESTROY_ROBOT_FLYING', 4, 0.88),
  destroyInstallation: variants('sfx/destruction', 'DESTROY_INSTALLATION', 4, 0.9),
  destroyInstallationDecay: variants('sfx/destruction', 'DESTROY_INSTALLATION_DECAY', 3, 0.86),
  destroyRelayFriendly: variants('sfx/destruction', 'DESTROY_RELAY_FRIENDLY', 3, 0.94),
  destroyRelayEnemy: variants('sfx/destruction', 'DESTROY_RELAY_ENEMY', 3, 0.94),
  destroyCoreFriendly: variants('sfx/destruction', 'DESTROY_CORE_FRIENDLY', 3, 0.98),
  destroyCoreEnemy: variants('sfx/destruction', 'DESTROY_CORE_ENEMY', 3, 0.98),
} as const satisfies Record<string, RecordedFamily>;

export type RecordedFamilyId = keyof typeof RECORDED_SOUND_FAMILIES;

export const RECORDED_AUDIO_PATHS = [...new Set(
  Object.values(RECORDED_SOUND_FAMILIES).flatMap((family) => family.paths),
)];

// Decode one representative of each family up front. Alternate takes are
// pulled into the cache on demand so the full audition package does not turn
// into a large startup-time PCM allocation.
export const RECORDED_PRELOAD_PATHS = [...new Set(
  Object.values(RECORDED_SOUND_FAMILIES).map((family) => family.paths[0]),
)];

const CHARACTER_AUDIO = {
  zip: { selected: 'voiceZip', deployed: 'voiceZipDeploy' },
  swarm: { selected: 'voiceSwarm', deployed: 'voiceSwarmDeploy', effect: 'swarmDeploy' },
  brute: { selected: 'voiceBrute', deployed: 'voiceBruteDeploy', effect: 'bruteDeploy' },
  rail: { selected: 'voiceRail', deployed: 'voiceRailDeploy', effect: 'railDeploy' },
  pulse: { selected: 'voicePulse', deployed: 'voicePulseDeploy' },
  arc: { selected: 'voiceArc', deployed: 'voiceArcDeploy', effect: 'arcBoot' },
  drone: { selected: 'voiceDrone', deployed: 'voiceDroneDeploy', effect: 'droneLiftoff' },
  patch: { selected: 'voicePatch', deployed: 'voicePatchDeploy', effect: 'patchDeploy' },
  vector: { selected: 'voiceVector', deployed: 'voiceVectorDeploy', effect: 'vectorDeploy' },
  aegis: { selected: 'voiceAegis', deployed: 'voiceAegisDeploy', effect: 'aegisBarrier' },
  wraith: { selected: 'voiceWraith', deployed: 'voiceWraithDeploy' },
  viper: { selected: 'voiceViper', deployed: 'voiceViperDeploy' },
} as const satisfies Partial<Record<CardId, {
  selected: RecordedFamilyId;
  deployed: RecordedFamilyId;
  effect?: RecordedFamilyId;
}>>;

const NON_CHARACTER_SELECTIONS = {
  emp: 'empSelect',
  nano: 'nanoSelect',
  gravity: 'gravitySelect',
  sentry: 'sentrySelect',
  foundry: 'foundrySelect',
  firewall: 'firewallSelect',
} as const satisfies Partial<Record<CardId, RecordedFamilyId>>;

const INTERFACE_FAMILIES: Record<InterfaceSoundId, RecordedFamilyId> = {
  confirm: 'uiConfirm',
  cardAdd: 'uiCardAdd',
  cardRemove: 'uiCardRemove',
  loadoutPreset: 'uiLoadoutPreset',
  modeSelect: 'uiModeSelect',
  pilotSelect: 'uiPilotSelect',
  towerWeaponSelect: 'uiTowerWeaponSelect',
  upgradeOne: 'uiUpgradeOne',
  upgradeTwo: 'uiUpgradeTwo',
  upgradeRemove: 'uiUpgradeRemove',
  panelOpen: 'uiPanelOpen',
  panelClose: 'uiPanelClose',
  pause: 'uiPause',
  resume: 'uiResume',
  matchLaunch: 'matchLaunch',
};

function teamMix(team: Team): Pick<RecordedSoundLayer, 'gain' | 'playbackRate'> {
  return team === 'player' ? {} : { gain: 0.62, playbackRate: 0.93 };
}

function oneShotPlan(
  tag: string,
  family: RecordedFamilyId,
  bus: RecordedSoundBus,
  priority: RecordedSoundPriority,
  options: {
    team?: Team;
    category?: RecordedSoundCategory;
    throttleSeconds?: number;
    delay?: number;
  } = {},
): RecordedSoundPlan {
  return {
    tag,
    bus,
    priority,
    category: options.category,
    throttleSeconds: options.throttleSeconds,
    layers: [{ family, delay: options.delay, ...(options.team ? teamMix(options.team) : {}) }],
  };
}

export function getInterfaceSoundPlan(id: InterfaceSoundId): RecordedSoundPlan {
  return oneShotPlan(`interface:${id}`, INTERFACE_FAMILIES[id], id === 'matchLaunch' ? 'critical' : 'ui', id === 'matchLaunch' ? 3 : 1, {
    throttleSeconds: 0.04,
  });
}

function entityKind(id: string): CardId | 'microbot' | undefined {
  const kinds: readonly (CardId | 'microbot')[] = [
    'zip', 'swarm', 'brute', 'rail', 'pulse', 'arc', 'drone', 'patch', 'vector', 'aegis', 'wraith',
    'viper', 'sentry', 'foundry', 'firewall', 'microbot',
  ];
  return kinds.find((kind) => id.includes(`-${kind}-`) || id === kind);
}

function cardVoicePlans(cue: Extract<SoundCue, { kind: 'cardVoice' }>): RecordedSoundPlan[] {
  const character = CHARACTER_AUDIO[cue.cardId as keyof typeof CHARACTER_AUDIO];
  if (!character) {
    const selection = NON_CHARACTER_SELECTIONS[cue.cardId as keyof typeof NON_CHARACTER_SELECTIONS];
    return selection ? [oneShotPlan(`card-select:${cue.cardId}`, selection, 'ui', 1, { team: cue.team })] : [];
  }
  const family = character[cue.variant];
  const plans = [oneShotPlan(`voice:${cue.variant}:${cue.cardId}`, family, 'voice', 2, {
    team: cue.team,
    category: 'voice',
    throttleSeconds: 0.12,
  })];
  if (cue.variant === 'deployed' && 'effect' in character && character.effect) {
    plans.push(oneShotPlan(`deploy:${cue.cardId}`, character.effect, 'combat', 1, { team: cue.team }));
  }
  return plans;
}

function weaponPlan(cue: Extract<SoundCue, { kind: 'weapon' }>): RecordedSoundPlan {
  const kind = entityKind(cue.sourceId);
  const mix = teamMix(cue.team);
  let launch: RecordedFamilyId;
  let impact: RecordedFamilyId;
  let lead: RecordedSoundLayer[] = [];

  if (cue.sourceType === 'tower') {
    const core = cue.sourceId.includes('core');
    launch = core
      ? 'towerCoreRocket'
      : cue.projectile === 'flame'
        ? 'towerRelayFlame'
        : cue.projectile === 'rocket'
          ? 'towerRelayRocket'
          : 'towerRelayGun';
    impact = cue.projectile === 'rocket'
      ? core ? 'impactRocketHeavy' : 'impactRocketSmall'
      : cue.projectile === 'flame' ? 'impactFlame' : 'impactBullet';
  } else if (kind === 'sentry') {
    launch = 'sentryBurst';
    impact = 'impactBullet';
  } else if (kind === 'swarm') {
    launch = 'swarmAttack';
    impact = 'impactBullet';
  } else if (kind === 'microbot') {
    launch = 'microbotAttack';
    impact = 'impactBullet';
  } else if (kind === 'pulse') {
    launch = 'pulseFire';
    impact = 'impactPulse';
  } else if (kind === 'wraith') {
    launch = 'wraithAttack';
    impact = 'impactBullet';
  } else if (kind === 'viper') {
    launch = 'viperAttack';
    impact = 'impactBullet';
  } else if (kind === 'arc') {
    launch = 'arcCharge';
    impact = 'impactArc';
  } else if (cue.projectile === 'flame') {
    launch = 'flameIgnite';
    impact = 'impactFlame';
  } else if (cue.projectile === 'rocket') {
    const heavy = kind === 'brute' || kind === 'rail';
    launch = heavy ? 'rocketHeavy' : 'rocketLight';
    impact = heavy || cue.targetType !== 'unit' ? 'impactRocketHeavy' : 'impactRocketSmall';
    if (kind === 'rail') lead = [{ family: 'siegeCharge', ...mix }];
  } else {
    launch = kind === 'vector' || kind === 'aegis' ? 'bulletHeavy' : 'bulletLight';
    impact = 'impactBullet';
  }

  return {
    tag: `weapon:${cue.projectile}:${cue.team}`,
    bus: 'combat',
    priority: 0,
    throttleSeconds: cue.projectile === 'bullet' ? 0.04 : cue.projectile === 'flame' ? 0.06 : 0.075,
    layers: [
      ...lead,
      { family: launch, delay: lead.length ? 0.08 : 0, ...mix },
      { family: impact, delay: cue.impactDelay, gain: (mix.gain ?? 1) * 0.9, playbackRate: mix.playbackRate },
    ],
  };
}

function destructionFamily(cue: Extract<SoundCue, { kind: 'destruction' }>): RecordedFamilyId {
  if (cue.size === 'installation') {
    return cue.cause === 'decay' ? 'destroyInstallationDecay' : 'destroyInstallation';
  }
  const kind = entityKind(cue.entityId);
  if (kind === 'swarm') return 'swarmDestroy';
  if (kind === 'microbot') return 'microbotDestroy';
  if (kind === 'wraith') return 'wraithDestroy';
  if (kind === 'drone') return 'destroyRobotFlying';
  if (kind === 'brute' || kind === 'rail' || kind === 'vector' || kind === 'aegis') return 'destroyRobotHeavy';
  return 'destroyRobotSmall';
}

export function getRecordedSoundPlans(cue: SoundCue): RecordedSoundPlan[] {
  switch (cue.kind) {
    case 'matchStart': {
      if (cue.restart) return [oneShotPlan('round-start', 'roundStart', 'critical', 3)];
      const family: RecordedFamilyId = cue.modeId === 'turbo-grid'
        ? 'matchStartTurboGrid'
        : cue.modeId === 'relay-rush'
          ? 'matchStartRelayRush'
          : cue.modeId === 'best-of-three'
            ? 'matchStartBestOfThree'
            : 'matchStartCoreSiege';
      return [oneShotPlan(`match-start:${cue.modeId}`, family, 'critical', 3)];
    }
    case 'powerDrain': {
      const pulseInterval = cue.durationMs / 8_000;
      return [{
        tag: 'power-drain',
        bus: 'critical',
        priority: 3,
        layers: [
          { family: 'powerDrainWarning' },
          ...Array.from({ length: 8 }, (_, index): RecordedSoundLayer => ({
            family: 'powerDrainPulse',
            delay: cue.warningMs / 1_000 + index * pulseInterval,
            gain: 0.82 + index * 0.02,
          })),
        ],
      }];
    }
    case 'cardVoice':
      return cardVoicePlans(cue);
    case 'reject':
      return [oneShotPlan('reject', 'uiReject', 'ui', 1, { throttleSeconds: 0.12 })];
    case 'program': {
      const family = cue.program === 'emp' ? 'empDetonate' : cue.program === 'nano' ? 'nanoRelease' : 'gravityCollapse';
      return [oneShotPlan(`program:${cue.program}:${cue.team}`, family, 'combat', 1, { team: cue.team })];
    }
    case 'installation': {
      const family = cue.installation === 'sentry' ? 'sentryPlace' : cue.installation === 'foundry' ? 'foundryPlace' : 'firewallPlace';
      return [oneShotPlan(`installation:${cue.installation}:${cue.team}`, family, 'combat', 1, { team: cue.team })];
    }
    case 'dash':
      return [{
        tag: `dash:${cue.team}`,
        bus: 'combat',
        priority: 1,
        throttleSeconds: 0.08,
        layers: [
          { family: 'phaseDepart', ...teamMix(cue.team) },
          { family: 'phaseArrive', delay: 0.12, ...teamMix(cue.team) },
        ],
      }];
    case 'overdrive':
      return [
        oneShotPlan(`overdrive-voice:${cue.team}`, 'voiceVectorOverdrive', 'voice', 2, { team: cue.team, category: 'voice' }),
        oneShotPlan(`overdrive:${cue.team}`, 'vectorOverdrive', 'combat', 2, { team: cue.team }),
      ];
    case 'upgrade':
      return [oneShotPlan(`upgrade:${cue.team}`, cue.tier === 1 ? 'uiUpgradeOne' : 'uiUpgradeTwo', 'ui', 1, { team: cue.team })];
    case 'weapon':
      return [weaponPlan(cue)];
    case 'destruction':
      return [oneShotPlan(`destruction:${cue.size}:${cue.team}`, destructionFamily(cue), 'combat', 1, { team: cue.team, throttleSeconds: 0.05 })];
    case 'tower': {
      const friendly = cue.team === 'player';
      const family = cue.towerKind === 'core'
        ? friendly ? 'destroyCoreFriendly' : 'destroyCoreEnemy'
        : friendly ? 'destroyRelayFriendly' : 'destroyRelayEnemy';
      return [oneShotPlan(`tower:${cue.towerKind}:${cue.team}`, family, 'critical', 3)];
    }
    case 'matchEnd': {
      const family = cue.final
        ? cue.winner === 'player' ? 'matchVictory' : cue.winner === 'enemy' ? 'matchDefeat' : 'matchDraw'
        : cue.winner === 'player' ? 'roundVictory' : 'roundDefeat';
      return [oneShotPlan(`${cue.final ? 'match' : 'round'}-end:${cue.winner}`, family, 'critical', 3)];
    }
  }
}

export function getRecordedFamily(id: RecordedFamilyId): RecordedFamily {
  return RECORDED_SOUND_FAMILIES[id];
}
