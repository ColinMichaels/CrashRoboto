import { GameObjects, Scene } from 'phaser';
import type { Input } from 'phaser';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CARDS,
  INSTALLATIONS,
  OVERDRIVE_AURA_RADIUS,
  PROGRAMS,
  TOWER_VISUAL_SIZE,
  TOWER_WEAPONS,
  getEffectiveRobotStats,
  getLaneX,
  getPerspectiveScale,
} from '../core/content';
import {
  getDeploymentZones,
  PROGRAM_TARGET_ZONE,
} from '../core/deployment';
import { evaluatePlacement } from '../core/placementFeedback';
import type {
  CardDefinition,
  CombatEntityRef,
  GameEvent,
  InstallationState,
  MatchSnapshot,
  ProgramZoneState,
  ProjectileKind,
  RobotKind,
  SpriteSheet,
  Team,
  TowerState,
  UnitState,
} from '../core/types';
import type { GameBridge } from '../bridge/GameBridge';
import {
  ARENA_UNIT_DISPLAY_HEIGHT_RATIO,
  getArenaUnitBodyOriginY,
  getArenaUnitFrame,
  getArenaUnitTextureKey,
  getInitialArenaUnitDirection,
  resolveUnitPose,
  selectArenaUnitFlipX,
  type ArenaUnitDirection,
  type ArenaUnitPoseState,
} from './unitPresentation';
import { getArenaAssetManifest } from './arenaAssets';
import {
  DISABLED_COLOR,
  ENEMY_COLOR,
  INSTALLATION_COLOR,
  INSTALLATION_SIZES,
  INVALID_COLOR,
  OVERDRIVE_COLOR,
  PLAYER_COLOR,
  PROGRAM_COLOR,
  ROBOT_SIZES,
  teamColor,
  textureKey,
} from './arenaPresentation';

interface NanoZoneVisual {
  field: GameObjects.Graphics;
  core: GameObjects.Image;
}

type EntityDestroyedEvent = Extract<GameEvent, { type: 'entityDestroyed' }>;

interface PendingAttackVisual {
  projectile: ProjectileKind;
  deaths: EntityDestroyedEvent[];
}

interface UnitMotionVisual {
  previousX: number;
  previousY: number;
  movingUntilMs: number;
  gaitStartedAtMs: number;
  gaitStopsAtMs: number;
  direction: ArenaUnitDirection;
  flipX: boolean;
  state: ArenaUnitPoseState;
}

export class BattleScene extends Scene {
  private readonly unitSprites = new Map<string, GameObjects.Sprite>();
  private readonly unitShadows = new Map<string, GameObjects.Ellipse>();
  private readonly unitMotion = new Map<string, UnitMotionVisual>();
  private readonly towerSprites = new Map<string, GameObjects.Image>();
  private readonly installationSprites = new Map<string, GameObjects.Image>();
  private readonly nanoZoneVisuals = new Map<string, NanoZoneVisual>();
  private readonly pendingAttacks = new Map<number, PendingAttackVisual>();
  private readonly pendingDeathIds = new Set<string>();
  private readonly combatVfx = new Set<GameObjects.GameObject>();
  private healthLayer!: GameObjects.Graphics;
  private deployLayer!: GameObjects.Graphics;
  private statusLayer!: GameObjects.Graphics;
  private targetLayer!: GameObjects.Graphics;
  private ghost!: GameObjects.Image;
  private placementText!: GameObjects.Text;
  private latestPointer = { x: 800, y: 500 };
  private previousPhase: MatchSnapshot['phase'] | null = null;
  private previousRound = 1;
  private previousRemainingMs = 0;
  private previousSnapshotRevision = -1;
  private unsubscribeEvents?: () => void;

  constructor(private readonly bridge: GameBridge) {
    super('battle');
  }

  preload(): void {
    const base = import.meta.env.BASE_URL;
    for (const asset of getArenaAssetManifest(this.bridge.getSnapshot().decks)) {
      const path = `${base}${asset.path}`;
      if (asset.type === 'image') {
        this.load.image(asset.key, path);
      } else {
        this.load.spritesheet(asset.key, path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
          endFrame: asset.endFrame,
        });
      }
    }
  }

  create(): void {
    this.add
      .image(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 'arena-board')
      .setDisplaySize(BOARD_WIDTH, BOARD_HEIGHT)
      .setDepth(0);

    this.deployLayer = this.add.graphics().setDepth(1);
    this.statusLayer = this.add.graphics().setDepth(6.2);
    this.targetLayer = this.add.graphics().setDepth(6.8);
    this.healthLayer = this.add.graphics().setDepth(8);
    this.ghost = this.add
      .image(
        this.latestPointer.x,
        this.latestPointer.y,
        getArenaUnitTextureKey('zip'),
        getArenaUnitFrame('zip', 'away', 0),
      )
      .setDisplaySize(112, 112)
      .setAlpha(0.64)
      .setDepth(7)
      .setVisible(false);
    this.placementText = this.add
      .text(this.latestPointer.x, this.latestPointer.y, '', {
        color: '#c8fff4',
        backgroundColor: '#061014',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 1)
      .setDepth(9)
      .setVisible(false);

    this.input.on('pointermove', (pointer: Input.Pointer) => {
      this.latestPointer = { x: pointer.worldX, y: pointer.worldY };
      this.updateGhost();
    });

    this.input.on('pointerdown', (pointer: Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.bridge.dispatch({ type: 'select', cardId: null });
        return;
      }
      const snapshot = this.bridge.getSnapshot();
      if (!snapshot.selected) return;
      this.bridge.dispatch({
        type: 'playCard',
        team: 'player',
        cardId: snapshot.selected,
        x: pointer.worldX,
        y: pointer.worldY,
      });
    });

    this.unsubscribeEvents = this.bridge.subscribeToEvents((event) => this.onGameEvent(event));
    const cleanup = () => {
      this.unsubscribeEvents?.();
      this.unsubscribeEvents = undefined;
      this.clearCombatVfx();
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.syncPresentation();
  }

  update(_time: number, delta: number): void {
    this.bridge.tick(delta);
    this.syncPresentation();
  }

  private syncPresentation(): void {
    const snapshot = this.bridge.getSnapshot();
    const snapshotChanged = snapshot.revision !== this.previousSnapshotRevision;
    const currentRound = snapshot.series?.currentRound ?? 1;
    const startingFreshMatch =
      snapshot.phase === 'playing' &&
      this.previousPhase !== null &&
      (this.previousPhase === 'menu' ||
        this.previousPhase === 'round-ended' ||
        this.previousPhase === 'ended' ||
        currentRound !== this.previousRound ||
        snapshot.remainingMs > this.previousRemainingMs + 1_000);
    if (startingFreshMatch) this.clearCombatVfx();
    this.previousPhase = snapshot.phase;
    this.previousRound = currentRound;
    this.previousRemainingMs = snapshot.remainingMs;

    // Units, active zones, and disabled installations have frame-driven motion or flicker.
    for (const unit of snapshot.units) this.syncUnit(unit, snapshot.phase);
    for (const installation of snapshot.installations) this.syncInstallation(installation);
    for (const zone of snapshot.zones) this.syncNanoZone(zone);

    if (snapshotChanged) {
      const unitIds = new Set(snapshot.units.map((unit) => unit.id));
      const towerIds = new Set(snapshot.towers.map((tower) => tower.id));
      const installationIds = new Set(snapshot.installations.map((installation) => installation.id));
      const zoneIds = new Set(snapshot.zones.map((zone) => zone.id));

      for (const [id, sprite] of this.unitSprites) {
        if (!unitIds.has(id) && !this.pendingDeathIds.has(id)) {
          this.tweens.killTweensOf(sprite);
          sprite.destroy();
          this.unitSprites.delete(id);
          this.destroyUnitAuxiliary(id);
        }
      }

      for (const tower of snapshot.towers) this.syncTower(tower, snapshot.phase);
      for (const [id, sprite] of this.towerSprites) {
        if (!towerIds.has(id)) {
          sprite.destroy();
          this.towerSprites.delete(id);
        }
      }

      for (const [id, sprite] of this.installationSprites) {
        if (!installationIds.has(id) && !this.pendingDeathIds.has(id)) {
          this.tweens.killTweensOf(sprite);
          sprite.destroy();
          this.installationSprites.delete(id);
        }
      }

      for (const [id, visual] of this.nanoZoneVisuals) {
        if (!zoneIds.has(id)) {
          this.tweens.killTweensOf(visual.core);
          visual.field.destroy();
          visual.core.destroy();
          this.nanoZoneVisuals.delete(id);
        }
      }

      this.drawHealth(snapshot.units, snapshot.towers, snapshot.installations, snapshot.phase);
      this.drawDeployZone(snapshot);
      this.updateGhost();
      this.previousSnapshotRevision = snapshot.revision;
    }

    this.drawStatus(snapshot);
  }

  private syncUnit(unit: UnitState, phase: MatchSnapshot['phase']): void {
    let sprite = this.unitSprites.get(unit.id);
    let shadow = this.unitShadows.get(unit.id);
    let motion = this.unitMotion.get(unit.id);
    const size = ROBOT_SIZES[unit.kind] * getPerspectiveScale(unit.y);
    const displayHeight = size * ARENA_UNIT_DISPLAY_HEIGHT_RATIO[unit.kind];
    if (!sprite) {
      sprite = this.add
        .sprite(
          unit.x,
          unit.y,
          getArenaUnitTextureKey(unit.kind),
          getArenaUnitFrame(unit.kind, getInitialArenaUnitDirection(unit.team), 0),
        )
        .setDisplaySize(size, displayHeight);
      this.unitSprites.set(unit.id, sprite);
    }
    if (!shadow) {
      shadow = this.add
        .ellipse(unit.x, unit.y, size * 0.58, size * 0.14, 0x000000, 0.3)
        .setDepth(4.82 + unit.y / 1000);
      this.unitShadows.set(unit.id, shadow);
    }
    if (!motion) {
      motion = {
        previousX: unit.x,
        previousY: unit.y,
        movingUntilMs: 0,
        gaitStartedAtMs: this.time.now,
        gaitStopsAtMs: 0,
        direction: getInitialArenaUnitDirection(unit.team),
        flipX: false,
        state: 'idle',
      };
      this.unitMotion.set(unit.id, motion);
    }

    const pose = resolveUnitPose({
      unitId: unit.id,
      kind: unit.kind,
      team: unit.team,
      facing: unit.facing,
      x: unit.x,
      y: unit.y,
      previousX: motion.previousX,
      previousY: motion.previousY,
      previousDirection: motion.direction,
      movingUntilMs: motion.movingUntilMs,
      nowMs: this.time.now,
      phase,
      hp: unit.hp,
      disabledMs: unit.disabledMs,
      previousState: motion.state,
      gaitStartedAtMs: motion.gaitStartedAtMs,
      gaitStopsAtMs: motion.gaitStopsAtMs,
    });
    const flipX = selectArenaUnitFlipX(unit.facing, motion.flipX);
    const moving = pose.state === 'moving' || pose.state === 'settling';
    const gaitTheta = pose.gaitPhase * Math.PI * 2;
    const gaitWave = Math.sin(gaitTheta);
    const bobStrength = unit.kind === 'drone' ? 3.4 : unit.kind === 'swarm' || unit.kind === 'microbot' ? 2.5 : 1.8;
    const idleHover = unit.kind === 'drone' && pose.state === 'idle' ? Math.sin(this.time.now / 180) * 1.25 : 0;
    const bobLocal = gaitWave >= 0 ? -gaitWave * bobStrength : -gaitWave * 0.55;
    const bob = (moving ? bobLocal : idleHover) * getPerspectiveScale(unit.y);
    const leanStrength = unit.kind === 'drone' ? 0.055 : unit.kind === 'brute' || unit.kind === 'vector' ? 0.032 : 0.04;
    const lean = moving ? gaitWave * leanStrength * (flipX ? -1 : 1) : 0;
    const heightScale = moving ? 1 - 0.0125 * (1 - Math.cos(gaitTheta)) : 1;

    motion.previousX = unit.x;
    motion.previousY = unit.y;
    motion.movingUntilMs = pose.movingUntilMs;
    motion.gaitStartedAtMs = pose.gaitStartedAtMs;
    motion.gaitStopsAtMs = pose.gaitStopsAtMs;
    motion.direction = pose.direction;
    motion.flipX = flipX;
    motion.state = pose.state;

    sprite
      .setFrame(pose.frame)
      .setPosition(unit.x, unit.y + bob)
      .setDisplaySize(size, displayHeight * heightScale)
      .setDepth(5 + unit.y / 1000)
      .setRotation(lean)
      .setFlipX(flipX)
      .clearTint();

    shadow
      .setPosition(unit.x, unit.y + displayHeight * 0.22)
      .setDisplaySize(size * (moving ? 0.56 : 0.52), Math.max(7, size * 0.115))
      .setDepth(4.82 + unit.y / 1000)
      .setAlpha(unit.hp <= 0 ? 0.06 : unit.disabledMs > 0 ? 0.14 : moving ? 0.28 : 0.23);

    if (unit.hp <= 0) {
      sprite.setAlpha(0.2).setTint(0x25343a);
    } else if (unit.disabledMs > 0) {
      const flicker = 0.57 + Math.sin(this.time.now / 70) * 0.08;
      sprite.setAlpha(flicker).setTint(DISABLED_COLOR);
    } else if (unit.overdriveMs > 0) {
      sprite.setAlpha(1).setTint(OVERDRIVE_COLOR);
    } else {
      sprite.setAlpha(1);
      if (unit.team === 'enemy') sprite.setTint(0xff806e);
    }
  }

  private destroyUnitAuxiliary(id: string): void {
    const shadow = this.unitShadows.get(id);
    if (shadow) {
      this.tweens.killTweensOf(shadow);
      shadow.destroy();
      this.unitShadows.delete(id);
    }
    this.unitMotion.delete(id);
  }

  private syncTower(tower: TowerState, phase: MatchSnapshot['phase']): void {
    let sprite = this.towerSprites.get(tower.id);
    const core = tower.kind === 'core';
    const texture = core ? 'tower-sprites' : 'relay-weapon-sprites';
    const frame = core
      ? tower.team === 'player' ? 1 : 3
      : TOWER_WEAPONS[tower.weapon].frame;
    const size = TOWER_VISUAL_SIZE[tower.kind] * getPerspectiveScale(tower.y);
    if (!sprite) {
      sprite = this.add
        .image(tower.x, tower.y, texture, frame)
        .setDisplaySize(size, size);
      this.towerSprites.set(tower.id, sprite);
    }
    sprite.setTexture(texture, frame);
    sprite.setPosition(tower.x, tower.y);
    sprite.setDisplaySize(size, size);
    sprite.setDepth(3 + tower.y / 1000);
    if (tower.hp <= 0 && !this.pendingDeathIds.has(tower.id)) {
      sprite.setAlpha(0.18).setTint(0x25343a);
    } else if (phase === 'resolving') {
      const pulse = 0.82 + Math.sin(this.time.now / 115 + tower.x * 0.01) * 0.12;
      sprite
        .setAlpha(pulse)
        .setTint(tower.team === 'player' ? 0xffd475 : 0xff6f57);
    } else {
      sprite.clearTint().setAlpha(1);
      if (!core && tower.team === 'enemy') sprite.setTint(0xff846f);
    }
  }

  private syncInstallation(installation: InstallationState): void {
    let sprite = this.installationSprites.get(installation.id);
    const definition = INSTALLATIONS[installation.kind];
    const size = INSTALLATION_SIZES[installation.kind] * getPerspectiveScale(installation.y);
    if (!sprite) {
      sprite = this.add
        .image(installation.x, installation.y, textureKey(definition.sheet), definition.frame)
        .setDisplaySize(size, size);
      this.installationSprites.set(installation.id, sprite);
    }

    sprite
      .setTexture(textureKey(definition.sheet), definition.frame)
      .setPosition(installation.x, installation.y)
      .setDisplaySize(size, size)
      .setDepth(4.7 + installation.y / 1000)
      .setRotation(0)
      .clearTint();

    if (installation.hp <= 0 || installation.remainingMs <= 0) {
      sprite.setAlpha(0.18).setTint(0x25343a);
    } else if (installation.disabledMs > 0) {
      const flicker = 0.55 + Math.sin(this.time.now / 75) * 0.08;
      sprite.setAlpha(flicker).setTint(DISABLED_COLOR);
    } else {
      sprite.setAlpha(1);
      if (installation.team === 'enemy') sprite.setTint(0xff806e);
    }
  }

  private syncNanoZone(zone: ProgramZoneState): void {
    let visual = this.nanoZoneVisuals.get(zone.id);
    if (!visual) {
      visual = {
        field: this.add.graphics(),
        core: this.add.image(zone.x, zone.y, 'system-sprites', PROGRAMS.nano.frame),
      };
      this.nanoZoneVisuals.set(zone.id, visual);
    }

    const ratio = Math.max(0, Math.min(1, zone.remainingMs / PROGRAMS.nano.durationMs));
    const pulse = 0.5 + Math.sin(this.time.now / 180) * 0.5;
    const color = teamColor(zone.team);
    const radius = zone.radius;
    visual.field
      .clear()
      .fillStyle(color, 0.045 + ratio * 0.055)
      .fillCircle(0, 0, radius)
      .lineStyle(2, color, 0.35 + ratio * 0.45)
      .strokeCircle(0, 0, radius)
      .lineStyle(1, 0xc8fff4, 0.12 + pulse * 0.16)
      .strokeCircle(0, 0, radius * (0.58 + pulse * 0.09));
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + this.time.now / 2400;
      const inner = radius * 0.72;
      const outer = radius * 0.9;
      visual.field.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
      );
    }
    visual.field.setPosition(zone.x, zone.y).setDepth(2 + zone.y / 1000).setAlpha(Math.max(0.2, ratio));

    const iconSize = (52 + pulse * 7) * getPerspectiveScale(zone.y);
    visual.core
      .setPosition(zone.x, zone.y)
      .setDisplaySize(iconSize, iconSize)
      .setDepth(2.2 + zone.y / 1000)
      .setAlpha(0.28 + ratio * 0.34)
      .clearTint();
    if (zone.team === 'enemy') visual.core.setTint(ENEMY_COLOR);
  }

  private drawStatus(snapshot: MatchSnapshot): void {
    this.statusLayer.clear();
    if (snapshot.phase === 'resolving') {
      const pulse = 0.5 + Math.sin(this.time.now / 130) * 0.5;
      for (const tower of snapshot.towers) {
        if (tower.hp <= 0) continue;
        const scale = getPerspectiveScale(tower.y);
        const baseRadius = (tower.kind === 'core' ? 82 : 60) * scale;
        const ratio = tower.hp / tower.maxHp;
        const color = ratio <= 0.25
          ? 0xff5e43
          : tower.team === 'player'
            ? 0xffcf65
            : 0xff725b;
        this.statusLayer
          .fillStyle(color, 0.018 + pulse * 0.026)
          .fillCircle(tower.x, tower.y, baseRadius * 1.2)
          .lineStyle(3, color, 0.42 + pulse * 0.42)
          .strokeCircle(tower.x, tower.y, baseRadius * (1.04 + pulse * 0.05))
          .lineStyle(1, 0xffe6a6, 0.2 + pulse * 0.28)
          .strokeCircle(tower.x, tower.y, baseRadius * (1.24 + pulse * 0.08));
      }
    }
    const activeCommanders = snapshot.units.filter((unit) => unit.kind === 'vector' && unit.hp > 0 && unit.overdriveMs > 0);

    for (const commander of activeCommanders) {
      const color = commander.team === 'player' ? OVERDRIVE_COLOR : ENEMY_COLOR;
      const pulse = 0.5 + Math.sin(this.time.now / 120) * 0.5;
      this.statusLayer
        .fillStyle(color, 0.025 + pulse * 0.025)
        .fillCircle(commander.x, commander.y, OVERDRIVE_AURA_RADIUS)
        .lineStyle(3, color, 0.48 + pulse * 0.32)
        .strokeCircle(commander.x, commander.y, OVERDRIVE_AURA_RADIUS)
        .lineStyle(1, 0xfff1b0, 0.28)
        .strokeCircle(commander.x, commander.y, OVERDRIVE_AURA_RADIUS * (0.7 + pulse * 0.06));

      for (const unit of snapshot.units) {
        if (unit.team !== commander.team || unit.hp <= 0 || unit.disabledMs > 0) continue;
        if (Math.hypot(unit.x - commander.x, unit.y - commander.y) > OVERDRIVE_AURA_RADIUS) continue;
        const radius = Math.max(17, ROBOT_SIZES[unit.kind] * 0.25 * getPerspectiveScale(unit.y));
        this.statusLayer.lineStyle(2, color, 0.38 + pulse * 0.25).strokeCircle(unit.x, unit.y, radius);
      }
    }

    for (const unit of snapshot.units) {
      if (unit.hp <= 0) continue;
      const scale = getPerspectiveScale(unit.y);
      const radius = Math.max(20, ROBOT_SIZES[unit.kind] * 0.3 * scale);
      if (unit.maxShieldHp > 0 && unit.shieldHp > 0) {
        const shieldRatio = unit.shieldHp / unit.maxShieldHp;
        const shieldPulse = 0.42 + Math.sin(this.time.now / 115) * 0.12;
        this.statusLayer
          .lineStyle(3, 0x72f7ff, shieldPulse + shieldRatio * 0.28)
          .strokeCircle(unit.x, unit.y, radius * (1.06 + shieldRatio * 0.08));
      }
      if (unit.slowMs > 0) {
        this.statusLayer
          .lineStyle(2, 0xb66cff, 0.62)
          .strokeCircle(unit.x, unit.y, radius * 0.86)
          .lineStyle(1, 0xe8caff, 0.34)
          .strokeCircle(unit.x, unit.y, radius * 0.6);
      }
      if (unit.disabledMs > 0) this.drawDisabledMarker(unit.x, unit.y, radius);
    }

    for (const installation of snapshot.installations) {
      if (installation.hp <= 0 || installation.remainingMs <= 0) continue;
      const scale = getPerspectiveScale(installation.y);
      const radius = Math.max(24, INSTALLATION_SIZES[installation.kind] * 0.29 * scale);
      if (installation.kind === 'firewall' && installation.disabledMs <= 0) {
        const pulse = 0.44 + Math.sin(this.time.now / 145) * 0.12;
        const auraRadius = INSTALLATIONS.firewall.auraRadius ?? 130;
        this.statusLayer
          .fillStyle(teamColor(installation.team), 0.022 + pulse * 0.018)
          .fillCircle(installation.x, installation.y, auraRadius)
          .lineStyle(2, teamColor(installation.team), 0.34 + pulse * 0.22)
          .strokeCircle(installation.x, installation.y, auraRadius)
          .lineStyle(1, 0xc8fff4, 0.22)
          .strokeCircle(installation.x, installation.y, auraRadius * 0.72);
      }
      if (installation.disabledMs > 0) this.drawDisabledMarker(installation.x, installation.y, radius);
    }
  }

  private drawDisabledMarker(x: number, y: number, radius: number): void {
    const pulse = 0.55 + Math.sin(this.time.now / 85) * 0.2;
    this.statusLayer
      .lineStyle(2, DISABLED_COLOR, pulse)
      .strokeCircle(x, y, radius)
      .lineStyle(3, 0xc9d8dc, pulse)
      .lineBetween(x - radius * 0.35, y - radius * 0.35, x + radius * 0.35, y + radius * 0.35)
      .lineBetween(x + radius * 0.35, y - radius * 0.35, x - radius * 0.35, y + radius * 0.35);
  }

  private drawHealth(
    units: UnitState[],
    towers: TowerState[],
    installations: InstallationState[],
    phase: MatchSnapshot['phase'],
  ): void {
    this.healthLayer.clear();
    for (const tower of towers) {
      if (tower.hp <= 0) continue;
      const scale = getPerspectiveScale(tower.y);
      const width = (tower.kind === 'core' ? 128 : 92) * scale;
      const healthY = tower.team === 'enemy'
        ? tower.y + (tower.kind === 'core' ? 61 : 49) * scale
        : tower.y - (tower.kind === 'core' ? 86 : 69) * scale;
      this.drawHealthBar(
        tower.x - width / 2,
        healthY,
        width,
        tower.hp / tower.maxHp,
        tower.team,
        phase === 'resolving',
      );
    }
    for (const unit of units) {
      if (unit.hp <= 0 || (unit.hp >= unit.maxHp && unit.maxShieldHp === 0)) continue;
      const scale = getPerspectiveScale(unit.y);
      const width = Math.max(34, ROBOT_SIZES[unit.kind] * 0.54 * scale);
      const displayHeight = ROBOT_SIZES[unit.kind] * scale * ARENA_UNIT_DISPLAY_HEIGHT_RATIO[unit.kind];
      const barY = unit.y - displayHeight * 0.53;
      this.drawHealthBar(
        unit.x - width / 2,
        barY,
        width,
        unit.hp / unit.maxHp,
        unit.team,
      );
      if (unit.maxShieldHp > 0) {
        this.drawShieldBar(unit.x - width / 2, barY - 7, width, unit.shieldHp / unit.maxShieldHp);
      }
    }
    for (const installation of installations) {
      if (installation.hp <= 0 || installation.remainingMs <= 0) continue;
      const definition = INSTALLATIONS[installation.kind];
      const scale = getPerspectiveScale(installation.y);
      const width = Math.max(58, INSTALLATION_SIZES[installation.kind] * 0.62 * scale);
      const y = installation.y - INSTALLATION_SIZES[installation.kind] * 0.34 * scale;
      this.drawHealthBar(installation.x - width / 2, y, width, installation.hp / installation.maxHp, installation.team);
      this.drawLifetimeBar(
        installation.x - width / 2,
        y + 10,
        width,
        installation.remainingMs / definition.lifetimeMs,
        installation.disabledMs > 0,
      );
    }
  }

  private drawHealthBar(
    x: number,
    y: number,
    width: number,
    ratio: number,
    team: Team,
    powerDrain = false,
  ): void {
    const height = powerDrain ? 8 : 5;
    this.healthLayer
      .fillStyle(0x061014, 0.92)
      .fillRoundedRect(x - 3, y - 3, width + 6, height + 6, 5);
    if (powerDrain) {
      this.healthLayer
        .lineStyle(2, ratio <= 0.25 ? 0xff5e43 : 0xffc857, 0.92)
        .strokeRoundedRect(x - 3, y - 3, width + 6, height + 6, 5);
    }
    this.healthLayer
      .fillStyle(team === 'player' ? PLAYER_COLOR : ENEMY_COLOR, 1)
      .fillRoundedRect(x, y, Math.max(0, width * Math.min(1, ratio)), height, 3);
  }

  private drawShieldBar(x: number, y: number, width: number, ratio: number): void {
    this.healthLayer.fillStyle(0x061014, 0.82).fillRoundedRect(x - 2, y - 2, width + 4, 6, 3);
    this.healthLayer
      .fillStyle(0x8ff8ff, 0.95)
      .fillRoundedRect(x, y, Math.max(0, width * Math.min(1, ratio)), 2, 1);
  }

  private drawLifetimeBar(x: number, y: number, width: number, ratio: number, disabled: boolean): void {
    this.healthLayer.fillStyle(0x061014, 0.82).fillRoundedRect(x - 2, y - 2, width + 4, 7, 3);
    this.healthLayer
      .fillStyle(disabled ? DISABLED_COLOR : INSTALLATION_COLOR, 0.9)
      .fillRoundedRect(x, y, Math.max(0, width * Math.min(1, ratio)), 3, 1);
  }

  private drawDeployZone(snapshot: MatchSnapshot): void {
    this.deployLayer.clear();
    if (!snapshot.selected || snapshot.phase !== 'playing') return;
    const card = CARDS[snapshot.selected];
    const color = this.cardColor(card, 'player');
    if (card.category === 'program') {
      const first = PROGRAM_TARGET_ZONE[0];
      this.deployLayer.fillStyle(color, 0.025).beginPath().moveTo(first.x, first.y);
      for (const point of PROGRAM_TARGET_ZONE.slice(1)) this.deployLayer.lineTo(point.x, point.y);
      this.deployLayer.closePath().fillPath();
      this.deployLayer.lineStyle(2, color, 0.5).beginPath().moveTo(first.x, first.y);
      for (const point of PROGRAM_TARGET_ZONE.slice(1)) this.deployLayer.lineTo(point.x, point.y);
      this.deployLayer.closePath().strokePath();
      this.deployLayer.lineStyle(1, color, 0.12).lineBetween(800, 55, 800, 650);
      return;
    }

    for (const zone of getDeploymentZones('player', snapshot.towers)) {
      const first = zone.points[0];
      this.deployLayer.fillStyle(color, zone.kind === 'breach' ? 0.095 : 0.055).beginPath();
      this.deployLayer.moveTo(first.x, first.y);
      for (const point of zone.points.slice(1)) this.deployLayer.lineTo(point.x, point.y);
      this.deployLayer.closePath().fillPath();

      if (zone.kind === 'breach') {
        this.deployLayer.lineStyle(5, color, 0.16).beginPath();
        this.deployLayer.moveTo(first.x, first.y);
        for (const point of zone.points.slice(1)) this.deployLayer.lineTo(point.x, point.y);
        this.deployLayer.closePath().strokePath();
      }
      this.deployLayer.lineStyle(2, color, zone.kind === 'breach' ? 0.78 : 0.58).beginPath();
      this.deployLayer.moveTo(first.x, first.y);
      for (const point of zone.points.slice(1)) this.deployLayer.lineTo(point.x, point.y);
      this.deployLayer.closePath().strokePath();
    }

    // Enemy coverage is tactical information while choosing a deployment.
    for (const tower of snapshot.towers) {
      if (tower.team !== 'enemy' || tower.hp <= 0) continue;
      this.deployLayer
        .lineStyle(tower.kind === 'core' ? 2 : 1, ENEMY_COLOR, tower.kind === 'core' ? 0.18 : 0.13)
        .strokeCircle(tower.x, tower.y, tower.range);
    }
  }

  private updateGhost(): void {
    if (!this.ghost || !this.targetLayer) return;
    const snapshot = this.bridge.getSnapshot();
    this.targetLayer.clear();
    if (!snapshot.selected || snapshot.phase !== 'playing') {
      this.ghost.setVisible(false);
      this.placementText.setVisible(false);
      return;
    }

    const card = CARDS[snapshot.selected];
    const feedback = evaluatePlacement('player', snapshot.selected, this.latestPointer.x, this.latestPointer.y, {
      charge: snapshot.charge.player,
      commanderDeployed: snapshot.commander.player.deployed,
      towers: snapshot.towers,
      installations: snapshot.installations,
    });
    const valid = feedback.valid;
    const color = valid ? this.cardColor(card, 'player') : INVALID_COLOR;
    const scale = getPerspectiveScale(this.latestPointer.y);
    let size: number;
    let radius: number;

    if (card.category === 'program') {
      size = 84 * scale;
      radius = card.radius;
    } else if (card.category === 'installation') {
      size = INSTALLATION_SIZES[card.id] * scale;
      radius = Math.max(38, card.radius * scale + 12);
    } else {
      size = ROBOT_SIZES[card.id as RobotKind] * scale;
      radius = Math.max(30, card.radius * scale + 10);
    }

    this.ghost.setVisible(true).setPosition(this.latestPointer.x, this.latestPointer.y);
    if (card.category === 'unit' || card.category === 'commander') {
      const kind = card.id as RobotKind;
      this.ghost
        .setTexture(getArenaUnitTextureKey(kind), getArenaUnitFrame(kind, 'away', 0))
        .setDisplaySize(size, size * ARENA_UNIT_DISPLAY_HEIGHT_RATIO[kind]);
    } else {
      this.ghost
        .setTexture(textureKey(card.sheet), card.frame)
        .setDisplaySize(size, size);
    }
    this.ghost
      .setDepth(7 + this.latestPointer.y / 1000)
      .setRotation(0)
      .setFlipX(false)
      .clearTint()
      .setAlpha(valid ? 0.72 : 0.46)
      .setTint(color);

    const x = this.latestPointer.x;
    const y = this.latestPointer.y;
    this.targetLayer
      .setDepth(6.8 + y / 1000)
      .fillStyle(color, card.category === 'program' ? 0.075 : 0.045)
      .fillCircle(x, y, radius)
      .lineStyle(card.category === 'program' ? 3 : 2, color, valid ? 0.78 : 0.62)
      .strokeCircle(x, y, radius)
      .lineStyle(1, color, 0.45)
      .lineBetween(x - radius - 12, y, x - radius * 0.58, y)
      .lineBetween(x + radius * 0.58, y, x + radius + 12, y)
      .lineBetween(x, y - radius - 12, x, y - radius * 0.58)
      .lineBetween(x, y + radius * 0.58, x, y + radius + 12);

    if (card.category === 'unit' || card.category === 'commander') {
      const robotId = card.id as Exclude<RobotKind, 'microbot'>;
      const range = getEffectiveRobotStats(
        card.id as RobotKind,
        snapshot.upgrades.player[robotId],
        snapshot.cardLevels.player[robotId],
      ).range;
      this.targetLayer.lineStyle(1, color, valid ? 0.2 : 0.1).strokeCircle(x, y, range);
      const routeY = y > 340 ? 335 : y > 275 ? 270 : 118;
      this.targetLayer
        .lineStyle(2, color, valid ? 0.42 : 0.16)
        .lineBetween(x, y, getLaneX(feedback.lane, routeY), routeY);
    } else if (card.category === 'installation' && card.range > 0) {
      this.targetLayer.lineStyle(1, color, valid ? 0.22 : 0.1).strokeCircle(x, y, card.range);
    }

    this.placementText
      .setVisible(true)
      .setText(`${valid ? '✓' : '×'} ${feedback.message}`)
      .setColor(valid ? '#c8fff4' : '#ffd2cc')
      .setBackgroundColor(valid ? '#061a1a' : '#230d0d')
      .setPosition(Math.max(150, Math.min(1450, x)), Math.max(42, y - radius - 16));
  }

  private cardColor(card: CardDefinition, team: Team): number {
    if (team === 'enemy') return ENEMY_COLOR;
    if (card.category === 'program') return PROGRAM_COLOR;
    if (card.category === 'installation') return INSTALLATION_COLOR;
    if (card.category === 'commander') return OVERDRIVE_COLOR;
    return PLAYER_COLOR;
  }

  private onGameEvent(event: GameEvent): void {
    switch (event.type) {
      case 'cardPlayed': {
        const card = CARDS[event.cardId];
        this.spawnRing(event.x, event.y, this.cardColor(card, event.team), 18, card.category === 'program' ? 66 : 54, 360, 6.5);
        return;
      }
      case 'programCast':
        this.showProgramCast(event);
        return;
      case 'installationPlaced':
        this.showInstallationPlaced(event);
        return;
      case 'unitDashed':
        this.showUnitDash(event);
        return;
      case 'overdriveActivated':
        this.showOverdrive(event);
        return;
      case 'projectileFired':
        this.showProjectile(event);
        return;
      case 'entityDestroyed':
        this.handleEntityDestroyed(event);
        return;
      case 'impact': {
        const color = event.amount < 0 ? 0x85ffd8 : event.team === 'player' ? 0x48f4e0 : 0xff8a63;
        const pulse = this.add.circle(event.x, event.y, 8, color, 0.9).setDepth(7.8);
        this.tweens.add({ targets: pulse, scale: 2.8, alpha: 0, duration: 180, onComplete: () => pulse.destroy() });
        this.showCombatNumber(event.x, event.y, event.amount, color);
        return;
      }
      case 'playRejected':
        if (event.team === 'player') this.cameras.main.shake(90, 0.0018);
        return;
      case 'towerDestroyed': {
        const color = teamColor(event.tower.team);
        this.cameras.main.shake(260, 0.007);
        for (let index = 0; index < 8; index += 1) {
          const spark = this.trackCombatVfx(
            this.add.circle(event.tower.x, event.tower.y, 6, color, 1).setDepth(9),
          );
          const angle = (Math.PI * 2 * index) / 8;
          this.tweens.add({
            targets: spark,
            x: event.tower.x + Math.cos(angle) * 90,
            y: event.tower.y + Math.sin(angle) * 90,
            alpha: 0,
            duration: 420,
            ease: 'Cubic.Out',
            onComplete: () => this.destroyCombatVfx(spark),
          });
        }
        return;
      }
      default:
        return;
    }
  }

  private showProjectile(event: Extract<GameEvent, { type: 'projectileFired' }>): void {
    this.pendingAttacks.set(event.attackId, { projectile: event.projectile, deaths: [] });

    const lockColor = teamColor(event.source.team);
    const targetLock = this.trackCombatVfx(
      this.add
        .circle(event.target.x, event.target.y, Math.max(12, event.target.radius * 0.58), lockColor, 0)
        .setStrokeStyle(2, lockColor, 0.55)
        .setDepth(7.15),
    );
    this.tweens.add({
      targets: targetLock,
      scale: 1.35,
      alpha: 0,
      duration: 260,
      onComplete: () => this.destroyCombatVfx(targetLock),
    });

    const sourceOrigin = this.getProjectileSourceOrigin(event.source);
    const dx = event.target.x - sourceOrigin.x;
    const dy = event.target.y - sourceOrigin.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const directionX = dx / distance;
    const directionY = dy / distance;
    const sourceScale = getPerspectiveScale(event.source.y);
    const targetScale = getPerspectiveScale(event.target.y);
    const muzzleOffset = Math.max(10, event.source.radius * sourceScale * 0.72);
    const startX = sourceOrigin.x + directionX * muzzleOffset;
    const startY = sourceOrigin.y + directionY * muzzleOffset;
    const visualDistance = Math.hypot(event.target.x - startX, event.target.y - startY);
    const baseSize = event.projectile === 'rocket' ? 150 : event.projectile === 'flame' ? 112 : 96;
    const startSize = baseSize * sourceScale;
    const endSize = baseSize * targetScale;
    const duration = event.projectile === 'rocket'
      ? Math.max(170, Math.min(460, visualDistance / 1.15))
      : event.projectile === 'flame'
        ? Math.max(70, Math.min(180, visualDistance / 2.6))
        : Math.max(90, Math.min(260, visualDistance / 2));
    const projectile = this.trackCombatVfx(
      this.add
        .image(startX, startY, 'combat-vfx-sprites', event.projectile === 'rocket' ? 1 : 0)
        .setDisplaySize(startSize, startSize)
        .setDepth(7.25 + startY / 2_000)
        .setRotation(Math.atan2(dy, dx)),
    );
    if (event.projectile === 'flame') projectile.setTint(event.source.team === 'player' ? 0xffb347 : 0xff6b3d);
    else if (event.source.team === 'enemy') projectile.setTint(0xff8a72);

    const targetScaleRatio = endSize / Math.max(1, startSize);
    const endScaleX = projectile.scaleX * targetScaleRatio;
    const endScaleY = projectile.scaleY * targetScaleRatio;
    const maxTrailPips = event.projectile === 'rocket' ? 5 : event.projectile === 'flame' ? 7 : 3;
    let trailPips = 0;
    let nextTrailAt = this.time.now + (event.projectile === 'rocket' ? 54 : event.projectile === 'flame' ? 24 : 42);

    this.tweens.add({
      targets: projectile,
      x: event.target.x,
      y: event.target.y,
      scaleX: endScaleX,
      scaleY: endScaleY,
      depth: 7.25 + event.target.y / 2_000,
      duration,
      ease: event.projectile === 'rocket' ? 'Sine.In' : 'Linear',
      onUpdate: () => {
        if (trailPips >= maxTrailPips || this.time.now < nextTrailAt) return;
        trailPips += 1;
        nextTrailAt += duration / (maxTrailPips + 1);
        this.spawnProjectileTrail(projectile.x, projectile.y, event.source.team, event.projectile, projectile.depth - 0.02);
      },
      onComplete: () => {
        this.destroyCombatVfx(projectile);
        this.showProjectileImpact(event.target.x, event.target.y, event.source.team, event.projectile);
        const pending = this.pendingAttacks.get(event.attackId);
        this.pendingAttacks.delete(event.attackId);
        for (const death of pending?.deaths ?? []) this.showDestruction(death, pending?.projectile ?? event.projectile);
      },
    });
  }

  private getProjectileSourceOrigin(source: CombatEntityRef): { x: number; y: number } {
    if (source.entityType !== 'unit') return { x: source.x, y: source.y };

    const unit = this.bridge.getSnapshot().units.find((candidate) => candidate.id === source.id);
    const sprite = this.unitSprites.get(source.id);
    if (!unit || !sprite) return { x: source.x, y: source.y };

    return {
      x: source.x,
      y: getArenaUnitBodyOriginY(unit.kind, source.y, sprite.displayHeight),
    };
  }

  private spawnProjectileTrail(
    x: number,
    y: number,
    team: Team,
    projectile: ProjectileKind,
    depth: number,
  ): void {
    const scale = getPerspectiveScale(y);
    const color = projectile === 'flame'
      ? team === 'player' ? 0xffb347 : 0xff623d
      : teamColor(team);
    const pip = this.trackCombatVfx(
      this.add
        .circle(
          x,
          y,
          (projectile === 'rocket' ? 4.5 : projectile === 'flame' ? 5.4 : 2.8) * scale,
          color,
          projectile === 'flame' ? 0.64 : projectile === 'rocket' ? 0.5 : 0.42,
        )
        .setDepth(depth),
    );
    this.tweens.add({
      targets: pip,
      scale: 0.28,
      alpha: 0,
      duration: projectile === 'rocket' ? 190 : projectile === 'flame' ? 105 : 125,
      ease: 'Quad.Out',
      onComplete: () => this.destroyCombatVfx(pip),
    });
  }

  private showProjectileImpact(x: number, y: number, team: Team, projectile: ProjectileKind): void {
    const scale = getPerspectiveScale(y);
    const size = (projectile === 'rocket' ? 132 : projectile === 'flame' ? 116 : 92) * scale;
    const impact = this.trackCombatVfx(
      this.add
        .image(x, y, 'combat-vfx-sprites', 2)
        .setDisplaySize(size, size)
        .setDepth(8.45 + y / 2_000)
        .setAlpha(0.94),
    );
    if (projectile === 'flame') impact.setTint(team === 'player' ? 0xffb347 : 0xff6b3d);
    else if (team === 'enemy') impact.setTint(0xffab86);
    const startScaleX = impact.scaleX;
    const startScaleY = impact.scaleY;
    this.tweens.add({
      targets: impact,
      scaleX: startScaleX * 1.28,
      scaleY: startScaleY * 1.28,
      alpha: 0,
      duration: projectile === 'rocket' ? 280 : projectile === 'flame' ? 150 : 190,
      ease: 'Quad.Out',
      onComplete: () => this.destroyCombatVfx(impact),
    });
  }

  private handleEntityDestroyed(event: EntityDestroyedEvent): void {
    if (this.pendingDeathIds.has(event.entity.id)) return;
    this.pendingDeathIds.add(event.entity.id);

    if (event.attackId !== undefined) {
      const pending = this.pendingAttacks.get(event.attackId);
      if (pending) {
        pending.deaths.push(event);
        return;
      }
    }

    this.showDestruction(event);
  }

  private showDestruction(event: EntityDestroyedEvent, projectile?: ProjectileKind): void {
    const { entity } = event;
    const scale = getPerspectiveScale(entity.y);
    const decay = event.cause === 'decay';
    const baseSize = entity.entityType === 'tower' ? 270 : entity.entityType === 'installation' ? 210 : 158;
    const size = (decay ? Math.min(baseSize, 92) : baseSize) * scale;
    const effect = this.trackCombatVfx(
      this.add
        .image(entity.x, entity.y, 'combat-vfx-sprites', decay ? 2 : 3)
        .setDisplaySize(size, size)
        .setDepth(8.65 + entity.y / 2_000)
        .setAlpha(decay ? 0.42 : 0.98),
    );
    if (decay) effect.setTint(DISABLED_COLOR);

    const startScaleX = effect.scaleX;
    const startScaleY = effect.scaleY;
    this.tweens.add({
      targets: effect,
      scaleX: startScaleX * (decay ? 0.82 : 1.22),
      scaleY: startScaleY * (decay ? 0.82 : 1.22),
      alpha: 0,
      duration: decay ? 280 : entity.entityType === 'tower' ? 580 : 460,
      ease: decay ? 'Quad.In' : 'Cubic.Out',
      onComplete: () => this.destroyCombatVfx(effect),
    });

    if (!decay && projectile === 'rocket' && entity.entityType !== 'tower') {
      this.cameras.main.shake(90, 0.0018);
    }
    this.collapseDestroyedEntity(entity, decay);
  }

  private collapseDestroyedEntity(entity: CombatEntityRef, decay: boolean): void {
    const sprite = this.getEntitySprite(entity);
    if (!sprite) {
      if (entity.entityType === 'unit') this.destroyUnitAuxiliary(entity.id);
      this.pendingDeathIds.delete(entity.id);
      return;
    }

    if (entity.entityType === 'tower') {
      this.pendingDeathIds.delete(entity.id);
      sprite.setAlpha(0.18).setTint(0x25343a);
      return;
    }

    this.tweens.killTweensOf(sprite);
    if (entity.entityType === 'unit') {
      const shadow = this.unitShadows.get(entity.id);
      if (shadow) {
        this.tweens.killTweensOf(shadow);
        this.tweens.add({
          targets: shadow,
          alpha: 0,
          scaleX: shadow.scaleX * 0.7,
          scaleY: shadow.scaleY * 0.7,
          duration: decay ? 300 : 210,
          ease: 'Quad.In',
        });
      }
    }
    const startScaleX = sprite.scaleX;
    const startScaleY = sprite.scaleY;
    this.tweens.add({
      targets: sprite,
      y: sprite.y + (decay ? 12 : 7) * getPerspectiveScale(entity.y),
      rotation: sprite.rotation + (entity.team === 'player' ? -0.16 : 0.16),
      scaleX: startScaleX * (decay ? 0.72 : 0.58),
      scaleY: startScaleY * (decay ? 0.42 : 0.62),
      alpha: 0,
      duration: decay ? 300 : 210,
      ease: 'Quad.In',
      onComplete: () => {
        sprite.destroy();
        if (entity.entityType === 'unit') {
          this.unitSprites.delete(entity.id);
          this.destroyUnitAuxiliary(entity.id);
        } else this.installationSprites.delete(entity.id);
        this.pendingDeathIds.delete(entity.id);
      },
    });
  }

  private getEntitySprite(entity: CombatEntityRef): GameObjects.Image | GameObjects.Sprite | undefined {
    if (entity.entityType === 'unit') return this.unitSprites.get(entity.id);
    if (entity.entityType === 'installation') return this.installationSprites.get(entity.id);
    return this.towerSprites.get(entity.id);
  }

  private trackCombatVfx<T extends GameObjects.GameObject>(object: T): T {
    this.combatVfx.add(object);
    return object;
  }

  private destroyCombatVfx(object: GameObjects.GameObject): void {
    this.combatVfx.delete(object);
    if (!object.active) return;
    this.tweens.killTweensOf(object);
    object.destroy();
  }

  private clearCombatVfx(): void {
    for (const object of this.combatVfx) {
      this.tweens.killTweensOf(object);
      if (object.active) object.destroy();
    }
    this.combatVfx.clear();
    this.pendingAttacks.clear();

    for (const id of this.pendingDeathIds) {
      const unit = this.unitSprites.get(id);
      if (unit) {
        this.tweens.killTweensOf(unit);
        unit.destroy();
        this.unitSprites.delete(id);
      }
      this.destroyUnitAuxiliary(id);
      const installation = this.installationSprites.get(id);
      if (installation) {
        this.tweens.killTweensOf(installation);
        installation.destroy();
        this.installationSprites.delete(id);
      }
      const tower = this.towerSprites.get(id);
      if (tower) {
        this.tweens.killTweensOf(tower);
        tower.clearTint().setAlpha(1);
      }
    }
    this.pendingDeathIds.clear();
  }

  private showProgramCast(event: Extract<GameEvent, { type: 'programCast' }>): void {
    const definition = PROGRAMS[event.kind];
    const color = teamColor(event.team);
    const frame = definition.frame;
    const size = event.kind === 'emp' ? 112 : event.kind === 'gravity' ? 122 : 94;
    const effectColor = event.kind === 'gravity' ? 0xb66cff : color;
    this.spawnBurstIcon(definition.sheet, frame, event.x, event.y, size * getPerspectiveScale(event.y), effectColor, 520);
    this.spawnRing(event.x, event.y, effectColor, 14, event.radius, event.kind === 'emp' ? 430 : 620, 8.8);
    if (event.kind === 'emp') {
      this.spawnRing(event.x, event.y, 0xd6ffff, 8, event.radius * 0.72, 300, 8.9, 90);
      this.cameras.main.shake(110, 0.0028);
    }
  }

  private showInstallationPlaced(event: Extract<GameEvent, { type: 'installationPlaced' }>): void {
    const definition = INSTALLATIONS[event.kind];
    const color = teamColor(event.team);
    this.spawnRing(event.x, event.y, color, 18, definition.radius + 58, 440, 7.2);
    this.spawnBurstIcon(definition.sheet, definition.frame, event.x, event.y, 88 * getPerspectiveScale(event.y), color, 390, 0.32);
  }

  private showUnitDash(event: Extract<GameEvent, { type: 'unitDashed' }>): void {
    const color = event.team === 'player' ? 0x72f7ff : ENEMY_COLOR;
    const trail = this.trackCombatVfx(
      this.add.line(0, 0, event.fromX, event.fromY, event.toX, event.toY, color, 0.72)
        .setLineWidth(5, 1)
        .setOrigin(0)
        .setDepth(7.2),
    );
    this.spawnRing(event.toX, event.toY, color, 8, 42, 260, 7.3);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 260,
      onComplete: () => this.destroyCombatVfx(trail),
    });
  }

  private showOverdrive(event: Extract<GameEvent, { type: 'overdriveActivated' }>): void {
    const color = event.team === 'player' ? OVERDRIVE_COLOR : ENEMY_COLOR;
    this.spawnBurstIcon('system', 5, event.x, event.y, 96 * getPerspectiveScale(event.y), color, 560);
    this.spawnRing(event.x, event.y, color, 26, OVERDRIVE_AURA_RADIUS, 520, 8.8);
    this.spawnRing(event.x, event.y, 0xfff2b5, 18, OVERDRIVE_AURA_RADIUS * 0.68, 380, 8.9, 70);
    this.cameras.main.shake(150, 0.0035);
  }

  private showCombatNumber(x: number, y: number, amount: number, color: number): void {
    const rounded = Math.max(1, Math.round(Math.abs(amount)));
    const label = this.add
      .text(x, y - 26 * getPerspectiveScale(y), `${amount < 0 ? '+' : '−'}${rounded}`, {
        color: amount < 0 ? '#9fffdc' : color === ENEMY_COLOR ? '#ffb0a5' : '#d6fff8',
        fontFamily: 'Arial, sans-serif',
        fontSize: `${Math.round(16 * getPerspectiveScale(y) + 7)}px`,
        fontStyle: 'bold',
        stroke: '#031013',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(9.4);
    this.tweens.add({
      targets: label,
      y: label.y - 34,
      alpha: 0,
      duration: 620,
      ease: 'Quad.Out',
      onComplete: () => label.destroy(),
    });
  }

  private spawnBurstIcon(
    sheet: SpriteSheet,
    frame: number,
    x: number,
    y: number,
    size: number,
    color: number,
    duration: number,
    startAlpha = 0.78,
  ): void {
    const icon = this.add
      .image(x, y, textureKey(sheet), frame)
      .setDisplaySize(size, size)
      .setDepth(9)
      .setAlpha(startAlpha)
      .setTint(color);
    const startScaleX = icon.scaleX;
    const startScaleY = icon.scaleY;
    this.tweens.add({
      targets: icon,
      scaleX: startScaleX * 1.5,
      scaleY: startScaleY * 1.5,
      alpha: 0,
      duration,
      ease: 'Quad.Out',
      onComplete: () => icon.destroy(),
    });
  }

  private spawnRing(
    x: number,
    y: number,
    color: number,
    startRadius: number,
    endRadius: number,
    duration: number,
    depth: number,
    delay = 0,
  ): void {
    const ring = this.add.circle(x, y, startRadius, color, 0).setStrokeStyle(4, color, 0.9).setDepth(depth).setAlpha(1);
    this.tweens.add({
      targets: ring,
      radius: endRadius,
      alpha: 0,
      delay,
      duration,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
  }
}
