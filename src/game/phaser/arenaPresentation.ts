import type { InstallationKind, RobotKind, SpriteSheet, Team } from '../core/types';
import { SPRITE_SHEETS } from '../core/spriteSheets';

export const ROBOT_SIZES: Readonly<Record<RobotKind, number>> = {
  zip: 106,
  swarm: 112,
  brute: 142,
  rail: 130,
  pulse: 116,
  arc: 122,
  drone: 126,
  patch: 118,
  vector: 154,
  aegis: 154,
  wraith: 126,
  viper: 122,
  microbot: 68,
};

export const INSTALLATION_SIZES: Readonly<Record<InstallationKind, number>> = {
  sentry: 158,
  foundry: 180,
  firewall: 174,
};

export const PLAYER_COLOR = 0x28e7d2;
export const ENEMY_COLOR = 0xff6b5e;
export const PROGRAM_COLOR = 0x69dfff;
export const INSTALLATION_COLOR = 0xf6c453;
export const OVERDRIVE_COLOR = 0xffcf5a;
export const INVALID_COLOR = 0xff6b5e;
export const DISABLED_COLOR = 0x91a6ad;

export const teamColor = (team: Team): number => (
  team === 'player' ? PLAYER_COLOR : ENEMY_COLOR
);

export const textureKey = (sheet: SpriteSheet): string => SPRITE_SHEETS[sheet].textureKey;
