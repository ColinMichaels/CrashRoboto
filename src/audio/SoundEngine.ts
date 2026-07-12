import type { CardId, GameEvent, Team } from '../game/core/types';
import { DEFAULT_SFX_VOLUME } from './audioVolume';
import {
  CARD_VOICE_PROFILES,
  getCardSelectionCue,
  getSoundCuesForEvent,
  type CardVoiceProfile,
  type SoundCue,
} from './soundDesign';

type SoundBus = 'ui' | 'voice' | 'combat' | 'critical';
type SoundPriority = 0 | 1 | 2 | 3;
type SoundCategory = 'voice' | 'other';

interface ActiveSound {
  id: number;
  tag: string;
  category: SoundCategory;
  priority: SoundPriority;
  startedAt: number;
  context: AudioContext;
  output: GainNode;
  sources: Set<AudioScheduledSourceNode>;
  nodes: Set<AudioNode>;
}

interface SoundGraph {
  master: GainNode;
  compressor: DynamicsCompressorNode;
  buses: Record<SoundBus, GainNode>;
}

interface ToneOptions {
  delay?: number;
  type?: OscillatorType;
  volume: number;
  endHz?: number;
  attack?: number;
  filter?: {
    type: BiquadFilterType;
    frequency: number;
    endFrequency?: number;
    q?: number;
  };
}

interface NoiseOptions {
  delay?: number;
  volume: number;
  seed: number;
  playbackRate?: number;
  filter: {
    type: BiquadFilterType;
    frequency: number;
    endFrequency?: number;
    q?: number;
  };
}

export interface SoundEngineOptions {
  createContext?: () => AudioContext | null;
  volume?: number;
}

const MASTER_LEVEL = 0.58;
const MAX_ACTIVE_SOUNDS = 16;
const MAX_ACTIVE_VOICES = 2;
const BUS_LEVELS: Record<SoundBus, number> = {
  ui: 0.55,
  voice: 0.85,
  combat: 0.68,
  critical: 1,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededUnit(seed: number): number {
  const value = (Math.imul(Math.trunc(seed) ^ 0x9e3779b9, 1_664_525) + 1_013_904_223) >>> 0;
  return value / 0xffff_ffff;
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function createBrowserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioCtor ? new AudioCtor() : null;
}

function getVoiceSequence(profile: CardVoiceProfile, variant: 'selected' | 'deployed'): number[] {
  const sequence = [...profile.syllables];
  while (sequence.length < 3) sequence.push((sequence[0] ?? 1) * (sequence.length === 1 ? 0.84 : 1.12));
  if (variant === 'deployed' && sequence.length < 4) sequence.push((sequence[0] ?? 1) * 0.72);
  return sequence.slice(0, variant === 'selected' ? 3 : 4);
}

export class SoundEngine {
  private readonly createContext: () => AudioContext | null;
  private context: AudioContext | null = null;
  private graph: SoundGraph | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly activeSounds = new Map<number, ActiveSound>();
  private readonly lastCueTimes = new Map<string, number>();
  private volume: number;
  private muted = false;
  private disposed = false;
  private nextSoundId = 0;
  private lastTowerCueAt = Number.NEGATIVE_INFINITY;

  constructor(options: SoundEngineOptions = {}) {
    this.createContext = options.createContext ?? createBrowserAudioContext;
    const initialVolume = options.volume;
    this.volume = typeof initialVolume === 'number' && Number.isFinite(initialVolume)
      ? clamp(initialVolume, 0, 1)
      : DEFAULT_SFX_VOLUME;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.rampMasterGain();
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    this.volume = clamp(volume, 0, 1);
    this.rampMasterGain();
  }

  private rampMasterGain(): void {
    const context = this.context;
    const master = this.graph?.master;
    if (!context || !master || context.state === 'closed') return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.getMasterLevel(), now + 0.012);
  }

  playEvent(event: GameEvent): void {
    if (this.muted || this.disposed) return;
    for (const cue of getSoundCuesForEvent(event)) this.playCue(cue);
  }

  playCardSelected(cardId: CardId): void {
    if (!this.muted && !this.disposed) this.playCue(getCardSelectionCue(cardId));
  }

  blip(): void {
    if (this.muted || this.disposed) return;
    const sound = this.beginSound('ui-blip', 1, 'ui', 0.025);
    if (!sound) return;
    this.addTone(sound, 430, 0.07, {
      type: 'sine',
      volume: 0.034,
      endHz: 310,
    });
  }

  unlock(): void {
    if (this.disposed) return;
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sound of [...this.activeSounds.values()]) this.forceStopSound(sound);
    this.activeSounds.clear();
    this.lastCueTimes.clear();
    this.noiseBuffer = null;

    if (this.graph) {
      for (const bus of Object.values(this.graph.buses)) bus.disconnect();
      this.graph.master.disconnect();
      this.graph.compressor.disconnect();
      this.graph = null;
    }

    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }

  private playCue(cue: SoundCue): void {
    switch (cue.kind) {
      case 'matchStart':
        this.playMatchStart(cue);
        return;
      case 'cardVoice':
        this.playRobotVoice(cue.cardId, cue.variant, cue.team);
        return;
      case 'reject':
        this.playReject();
        return;
      case 'program':
        this.playProgram(cue.program, cue.team);
        return;
      case 'installation':
        this.playInstallation(cue.installation, cue.team);
        return;
      case 'dash':
        this.playDash(cue.team);
        return;
      case 'overdrive':
        this.playOverdrive(cue.team);
        return;
      case 'upgrade':
        this.playUpgrade(cue.team, cue.tier);
        return;
      case 'weapon':
        this.playWeapon(cue);
        return;
      case 'destruction':
        this.playDestruction(cue.size, cue.team, cue.cause);
        return;
      case 'tower':
        this.playTowerDestroyed(cue.towerKind, cue.team);
        return;
      case 'matchEnd':
        this.playMatchEnd(cue.winner);
    }
  }

  private playMatchStart(cue: Extract<SoundCue, { kind: 'matchStart' }>): void {
    const sound = this.beginSound('match-start', 3, 'critical', 0.25);
    if (!sound) return;
    const baseHz = cue.modeId === 'turbo-grid' ? 235 : cue.modeId === 'relay-rush' ? 210 : 190;
    const leadDelay = cue.restart ? 0.04 : 0;
    this.addNoise(sound, 0.2, {
      delay: leadDelay,
      volume: 0.052,
      seed: cue.restart ? 8 : 3,
      filter: { type: 'bandpass', frequency: 310, endFrequency: 620, q: 1.2 },
    });
    this.addTone(sound, baseHz * 0.48, 0.4, {
      delay: leadDelay,
      type: 'sawtooth',
      volume: 0.052,
      endHz: baseHz,
      filter: { type: 'lowpass', frequency: 620, endFrequency: 1_200, q: 0.7 },
    });
    [1, 1.5, 2].forEach((ratio, index) => {
      this.addTone(sound, baseHz * ratio, 0.2, {
        delay: leadDelay + 0.38 + index * 0.22,
        type: 'square',
        volume: 0.04,
        endHz: baseHz * ratio * 1.08,
        filter: { type: 'bandpass', frequency: 880 + index * 250, q: 2.4 },
      });
    });
  }

  private playRobotVoice(cardId: CardId, variant: 'selected' | 'deployed', team: Team): void {
    const profile = CARD_VOICE_PROFILES[cardId];
    const sound = this.beginSound(`voice:${variant}:${cardId}`, 2, 'voice', 0.18, 'voice');
    if (!sound) return;
    const sequence = getVoiceSequence(profile, variant);
    const syllableDuration = clamp(profile.pace + (variant === 'selected' ? 0.16 : 0.2), 0.29, 0.46);
    const gap = variant === 'selected' ? 0.055 : 0.075;
    const teamPitch = team === 'player' ? 1 : 0.78;
    const volume = (variant === 'selected' ? 0.052 : 0.065) * (team === 'player' ? 1 : 0.5);
    const seed = hashString(`${cardId}:${variant}:${team}`);

    sequence.forEach((ratio, index) => {
      this.addVoiceSyllable(
        sound,
        profile,
        profile.baseHz * ratio * teamPitch,
        syllableDuration,
        index * (syllableDuration + gap),
        volume,
        seed + index,
      );
    });
    this.addVoiceNoise(
      sound,
      profile,
      sequence.length,
      syllableDuration,
      gap,
      volume * 0.25,
      seed,
    );
  }

  private playReject(): void {
    const sound = this.beginSound('reject', 1, 'ui', 0.14);
    if (!sound) return;
    this.addTone(sound, 155, 0.12, { type: 'square', volume: 0.038, endHz: 92 });
    this.addTone(sound, 118, 0.12, { delay: 0.14, type: 'square', volume: 0.032, endHz: 74 });
  }

  private playProgram(program: Extract<SoundCue, { kind: 'program' }>['program'], team: Team): void {
    const sound = this.beginSound(`program:${program}:${team}`, 1, 'combat', 0.08);
    if (!sound) return;
    const level = team === 'player' ? 1 : 0.7;
    if (program === 'emp') {
      this.addNoise(sound, 0.42, {
        volume: 0.068 * level,
        seed: 21,
        playbackRate: 1.3,
        filter: { type: 'highpass', frequency: 1_250, endFrequency: 3_200, q: 0.7 },
      });
      this.addTone(sound, 1_450, 0.32, { type: 'sawtooth', volume: 0.045 * level, endHz: 160 });
      return;
    }
    if (program === 'gravity') {
      this.addNoise(sound, 0.85, {
        volume: 0.05 * level,
        seed: 33,
        playbackRate: 0.65,
        filter: { type: 'lowpass', frequency: 540, endFrequency: 180, q: 1.3 },
      });
      this.addTone(sound, 150, 0.92, { type: 'sawtooth', volume: 0.065 * level, endHz: 42 });
      return;
    }
    this.addNoise(sound, 0.72, {
      volume: 0.045 * level,
      seed: 27,
      playbackRate: 1.15,
      filter: { type: 'bandpass', frequency: 1_000, endFrequency: 430, q: 2.2 },
    });
    [540, 430, 620, 370].forEach((frequency, index) => {
      this.addTone(sound, frequency, 0.16, {
        delay: index * 0.14,
        type: 'triangle',
        volume: 0.028 * level,
        endHz: frequency * 0.72,
      });
    });
  }

  private playInstallation(installation: Extract<SoundCue, { kind: 'installation' }>['installation'], team: Team): void {
    const sound = this.beginSound(`installation:${installation}:${team}`, 1, 'combat', 0.1);
    if (!sound) return;
    const level = team === 'player' ? 1 : 0.68;
    if (installation === 'firewall') {
      this.addNoise(sound, 0.25, {
        volume: 0.038 * level,
        seed: 52,
        filter: { type: 'bandpass', frequency: 360, endFrequency: 1_800, q: 1.4 },
      });
      [180, 270, 405].forEach((frequency, index) => {
        this.addTone(sound, frequency, 0.34, {
          delay: index * 0.16,
          type: 'triangle',
          volume: 0.034 * level,
          endHz: frequency * 1.3,
        });
      });
      return;
    }
    const baseHz = installation === 'foundry' ? 92 : 132;
    this.addNoise(sound, installation === 'foundry' ? 0.8 : 0.48, {
      volume: 0.045 * level,
      seed: installation === 'foundry' ? 48 : 44,
      playbackRate: installation === 'foundry' ? 0.78 : 1.25,
      filter: { type: 'bandpass', frequency: baseHz * 4, endFrequency: baseHz * 8, q: 1.8 },
    });
    [1, 1.32, 0.84].forEach((ratio, index) => {
      this.addTone(sound, baseHz * ratio, 0.22, {
        delay: index * 0.18,
        type: 'square',
        volume: 0.032 * level,
        endHz: baseHz * ratio * 0.72,
      });
    });
  }

  private playDash(team: Team): void {
    const sound = this.beginSound(`dash:${team}`, 1, 'combat', 0.1);
    if (!sound) return;
    const level = team === 'player' ? 1 : 0.65;
    this.addNoise(sound, 0.24, {
      volume: 0.044 * level,
      seed: 71,
      playbackRate: 1.45,
      filter: { type: 'highpass', frequency: 850, endFrequency: 2_800, q: 0.8 },
    });
    this.addTone(sound, 420, 0.22, { type: 'triangle', volume: 0.032 * level, endHz: 1_120 });
  }

  private playOverdrive(team: Team): void {
    const sound = this.beginSound(`overdrive:${team}`, 2, 'voice', 0.18);
    if (!sound) return;
    const level = team === 'player' ? 1 : 0.65;
    [280, 420, 630, 840].forEach((frequency, index) => {
      this.addTone(sound, frequency, 0.24, {
        delay: index * 0.12,
        type: index % 2 === 0 ? 'square' : 'triangle',
        volume: 0.04 * level,
        endHz: frequency * 1.12,
      });
    });
  }

  private playUpgrade(team: Team, tier: 1 | 2): void {
    const sound = this.beginSound(`upgrade:${team}`, 1, 'ui', 0.12);
    if (!sound) return;
    const level = team === 'player' ? 1 : 0.62;
    this.addTone(sound, 480 + tier * 70, 0.18, { type: 'triangle', volume: 0.04 * level, endHz: 680 + tier * 90 });
    this.addTone(sound, 720 + tier * 80, 0.24, { delay: 0.11, type: 'triangle', volume: 0.036 * level, endHz: 980 + tier * 100 });
  }

  private playWeapon(cue: Extract<SoundCue, { kind: 'weapon' }>): void {
    const throttle = cue.projectile === 'bullet' ? 0.04 : cue.projectile === 'flame' ? 0.06 : 0.075;
    const sound = this.beginSound(`weapon:${cue.projectile}:${cue.team}`, 0, 'combat', throttle);
    if (!sound) return;
    const level = cue.team === 'player' ? 1 : 0.68;
    const variation = 0.96 + seededUnit(cue.attackId) * 0.08;
    if (cue.projectile === 'bullet') {
      this.addNoise(sound, 0.055, {
        volume: 0.052 * level,
        seed: cue.attackId,
        playbackRate: 1.4 * variation,
        filter: { type: 'highpass', frequency: 1_500, endFrequency: 3_600, q: 0.65 },
      });
      this.addTone(sound, 1_280 * variation, 0.065, { type: 'square', volume: 0.026 * level, endHz: 410 * variation });
      return;
    }
    if (cue.projectile === 'flame') {
      this.addNoise(sound, 0.18, {
        volume: 0.038 * level,
        seed: cue.attackId,
        playbackRate: 0.95 * variation,
        filter: { type: 'bandpass', frequency: 920, endFrequency: 420, q: 0.8 },
      });
      this.addTone(sound, 135 * variation, 0.15, { type: 'sawtooth', volume: 0.018 * level, endHz: 92 });
      return;
    }

    this.addNoise(sound, 0.26, {
      volume: 0.043 * level,
      seed: cue.attackId,
      playbackRate: 0.72 * variation,
      filter: { type: 'bandpass', frequency: 380, endFrequency: 760, q: 1.1 },
    });
    this.addTone(sound, 88 * variation, 0.28, { type: 'sawtooth', volume: 0.043 * level, endHz: 210 * variation });
    this.addNoise(sound, 0.38, {
      delay: cue.impactDelay,
      volume: 0.074 * level,
      seed: cue.attackId + 101,
      playbackRate: 0.55 * variation,
      filter: { type: 'lowpass', frequency: 680, endFrequency: 160, q: 0.8 },
    });
    this.addTone(sound, 82 * variation, 0.34, {
      delay: cue.impactDelay,
      type: 'sawtooth',
      volume: 0.052 * level,
      endHz: 38,
    });
  }

  private playDestruction(size: 'unit' | 'installation', team: Team, cause: 'projectile' | 'program' | 'decay'): void {
    const sound = this.beginSound(`destruction:${size}`, 1, 'combat', 0.065);
    if (!sound) return;
    const large = size === 'installation';
    const delay = cause === 'projectile' ? 0.16 : 0;
    const teamPitch = team === 'player' ? 0.9 : 1.08;
    this.addNoise(sound, large ? 0.62 : 0.38, {
      delay,
      volume: large ? 0.082 : 0.057,
      seed: large ? 84 : 79,
      playbackRate: (large ? 0.62 : 0.92) * teamPitch,
      filter: { type: 'lowpass', frequency: large ? 720 : 1_100, endFrequency: 180, q: 0.65 },
    });
    this.addTone(sound, (large ? 76 : 112) * teamPitch, large ? 0.48 : 0.3, {
      delay,
      type: 'sawtooth',
      volume: large ? 0.05 : 0.034,
      endHz: 42,
    });
    this.addTone(sound, 640 * teamPitch, 0.13, {
      delay: delay + 0.08,
      type: 'square',
      volume: 0.02,
      endHz: 250,
    });
  }

  private playTowerDestroyed(towerKind: 'relay' | 'core', team: Team): void {
    const sound = this.beginSound(`tower:${towerKind}`, 3, 'critical', 0.2);
    if (!sound) return;
    this.lastTowerCueAt = sound.context.currentTime;
    const core = towerKind === 'core';
    const delay = 0.18;
    this.addNoise(sound, core ? 1.1 : 0.82, {
      delay,
      volume: core ? 0.13 : 0.105,
      seed: core ? 113 : 107,
      playbackRate: core ? 0.42 : 0.55,
      filter: { type: 'lowpass', frequency: core ? 620 : 820, endFrequency: 90, q: 0.75 },
    });
    this.addTone(sound, core ? 54 : 72, core ? 0.95 : 0.7, {
      delay,
      type: 'sawtooth',
      volume: core ? 0.09 : 0.072,
      endHz: 30,
    });
    const alarmBase = team === 'enemy' ? 260 : 360;
    const ratios = team === 'enemy' ? [1, 1.34, 1.72] : [1, 0.72, 0.52];
    ratios.forEach((ratio, index) => {
      this.addTone(sound, alarmBase * ratio, 0.25, {
        delay: delay + 0.42 + index * 0.19,
        type: 'square',
        volume: 0.038,
        endHz: alarmBase * ratio * (team === 'enemy' ? 1.08 : 0.82),
      });
    });
  }

  private playMatchEnd(winner: Team | 'draw'): void {
    const sound = this.beginSound('match-end', 3, 'critical', 0.25);
    if (!sound) return;
    const followsTower = sound.context.currentTime - this.lastTowerCueAt < 0.2;
    const delay = followsTower ? 0.78 : 0.08;
    const frequencies = winner === 'player'
      ? [260, 390, 585]
      : winner === 'enemy'
        ? [330, 220, 132]
        : [240, 320, 240];
    frequencies.forEach((frequency, index) => {
      this.addTone(sound, frequency, 0.34, {
        delay: delay + index * 0.25,
        type: winner === 'draw' ? 'triangle' : 'square',
        volume: winner === 'player' ? 0.06 : 0.05,
        endHz: frequency * (winner === 'player' ? 1.1 : winner === 'enemy' ? 0.72 : 0.95),
        filter: { type: 'bandpass', frequency: frequency * 3.2, q: 2 },
      });
    });
    if (winner === 'enemy') {
      this.addNoise(sound, 0.7, {
        delay,
        volume: 0.045,
        seed: 131,
        playbackRate: 0.6,
        filter: { type: 'lowpass', frequency: 520, endFrequency: 120, q: 0.7 },
      });
    }
  }

  private addVoiceSyllable(
    sound: ActiveSound,
    profile: CardVoiceProfile,
    frequency: number,
    duration: number,
    delay: number,
    volume: number,
    seed: number,
  ): void {
    const context = sound.context;
    const start = context.currentTime + delay;
    const stop = start + duration;
    const carrier = context.createOscillator();
    const formantA = context.createBiquadFilter();
    const formantB = context.createBiquadFilter();
    const gainA = context.createGain();
    const gainB = context.createGain();
    const vibrato = context.createOscillator();
    const vibratoDepth = context.createGain();

    carrier.type = profile.grit > 0.62 ? 'square' : 'sawtooth';
    carrier.detune.setValueAtTime((seededUnit(seed) - 0.5) * 24, start);
    carrier.frequency.setValueAtTime(Math.max(28, frequency), start);
    carrier.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * profile.glide), stop);

    formantA.type = 'bandpass';
    formantA.Q.setValueAtTime(4 + profile.grit * 3, start);
    formantA.frequency.setValueAtTime(profile.formantHz, start);
    formantA.frequency.exponentialRampToValueAtTime(profile.formantHz * (0.78 + profile.glide * 0.22), stop);
    formantB.type = 'bandpass';
    formantB.Q.setValueAtTime(5 + profile.grit * 2, start);
    formantB.frequency.setValueAtTime(profile.formantHz * 1.72, start);
    formantB.frequency.exponentialRampToValueAtTime(profile.formantHz * 1.38, stop);

    const attack = Math.min(0.025, duration * 0.18);
    gainA.gain.setValueAtTime(0.0001, start);
    gainA.gain.exponentialRampToValueAtTime(volume, start + attack);
    gainA.gain.exponentialRampToValueAtTime(0.0001, stop);
    gainB.gain.setValueAtTime(0.0001, start);
    gainB.gain.exponentialRampToValueAtTime(volume * 0.42, start + attack);
    gainB.gain.exponentialRampToValueAtTime(0.0001, stop);

    vibrato.frequency.setValueAtTime(17 + profile.grit * 24, start);
    vibratoDepth.gain.setValueAtTime(frequency * (0.018 + profile.grit * 0.025), start);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(carrier.frequency);
    carrier.connect(formantA).connect(gainA).connect(sound.output);
    carrier.connect(formantB).connect(gainB).connect(sound.output);

    this.registerSource(sound, carrier, [formantA, formantB, gainA, gainB]);
    this.registerSource(sound, vibrato, [vibratoDepth]);
    carrier.start(start);
    vibrato.start(start);
    carrier.stop(stop + 0.015);
    vibrato.stop(stop + 0.015);
  }

  private addVoiceNoise(
    sound: ActiveSound,
    profile: CardVoiceProfile,
    syllableCount: number,
    syllableDuration: number,
    gap: number,
    volume: number,
    seed: number,
  ): void {
    const context = sound.context;
    const buffer = this.getNoiseBuffer(context);
    if (!buffer) return;
    const totalDuration = syllableCount * syllableDuration + (syllableCount - 1) * gap;
    const start = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(0.82 + profile.grit * 0.42, start);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(profile.formantHz * 1.32, start);
    filter.Q.setValueAtTime(0.8 + profile.grit, start);
    gain.gain.setValueAtTime(0.0001, start);
    for (let index = 0; index < syllableCount; index += 1) {
      const syllableStart = start + index * (syllableDuration + gap);
      gain.gain.setValueAtTime(0.0001, syllableStart);
      gain.gain.exponentialRampToValueAtTime(volume, syllableStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, syllableStart + syllableDuration * 0.62);
    }
    source.connect(filter).connect(gain).connect(sound.output);
    this.registerSource(sound, source, [filter, gain]);
    source.start(start, seededUnit(seed) * 0.35, totalDuration);
    source.stop(start + totalDuration + 0.015);
  }

  private addTone(sound: ActiveSound, frequency: number, duration: number, options: ToneOptions): void {
    const context = sound.context;
    const start = context.currentTime + (options.delay ?? 0);
    const stop = start + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endHz ?? frequency * 0.76), stop);

    const attack = Math.min(options.attack ?? 0.012, duration * 0.35);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    const nodes: AudioNode[] = [gain];
    if (options.filter) {
      const filter = context.createBiquadFilter();
      filter.type = options.filter.type;
      filter.Q.setValueAtTime(options.filter.q ?? 0.7, start);
      filter.frequency.setValueAtTime(Math.max(20, options.filter.frequency), start);
      if (options.filter.endFrequency) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.filter.endFrequency), stop);
      }
      oscillator.connect(filter).connect(gain).connect(sound.output);
      nodes.push(filter);
    } else {
      oscillator.connect(gain).connect(sound.output);
    }

    this.registerSource(sound, oscillator, nodes);
    oscillator.start(start);
    oscillator.stop(stop + 0.015);
  }

  private addNoise(sound: ActiveSound, duration: number, options: NoiseOptions): void {
    const context = sound.context;
    const buffer = this.getNoiseBuffer(context);
    if (!buffer) return;
    const start = context.currentTime + (options.delay ?? 0);
    const stop = start + duration;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(options.playbackRate ?? 1, start);
    filter.type = options.filter.type;
    filter.Q.setValueAtTime(options.filter.q ?? 0.7, start);
    filter.frequency.setValueAtTime(Math.max(20, options.filter.frequency), start);
    if (options.filter.endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.filter.endFrequency), stop);
    }
    const attack = Math.min(0.012, duration * 0.25);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    source.connect(filter).connect(gain).connect(sound.output);
    this.registerSource(sound, source, [filter, gain]);
    source.start(start, seededUnit(options.seed) * 0.4, duration);
    source.stop(stop + 0.015);
  }

  private beginSound(
    tag: string,
    priority: SoundPriority,
    bus: SoundBus,
    throttleSeconds = 0,
    category: SoundCategory = 'other',
  ): ActiveSound | null {
    if (this.muted || this.volume === 0 || this.disposed) return null;
    const context = this.getContext();
    const graph = this.graph;
    if (!context || !graph || context.state === 'closed') return null;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    const now = context.currentTime;
    const lastCue = this.lastCueTimes.get(tag);
    if (lastCue !== undefined && now - lastCue < throttleSeconds) return null;

    if (category === 'voice') {
      const activeVoices = [...this.activeSounds.values()]
        .filter((sound) => sound.category === 'voice')
        .sort((left, right) => left.startedAt - right.startedAt);
      if (activeVoices.length >= MAX_ACTIVE_VOICES && activeVoices[0]) this.fadeOutSound(activeVoices[0]);
    }

    while (this.activeSounds.size >= MAX_ACTIVE_SOUNDS) {
      const candidate = [...this.activeSounds.values()]
        .filter((sound) => sound.priority < priority)
        .sort((left, right) => left.startedAt - right.startedAt)[0];
      if (!candidate) return null;
      this.fadeOutSound(candidate);
    }

    const output = context.createGain();
    output.gain.setValueAtTime(1, now);
    output.connect(graph.buses[bus]);
    const sound: ActiveSound = {
      id: ++this.nextSoundId,
      tag,
      category,
      priority,
      startedAt: now,
      context,
      output,
      sources: new Set(),
      nodes: new Set(),
    };
    this.activeSounds.set(sound.id, sound);
    this.lastCueTimes.set(tag, now);
    return sound;
  }

  private registerSource(sound: ActiveSound, source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    sound.sources.add(source);
    for (const node of nodes) sound.nodes.add(node);
    source.onended = () => {
      source.onended = null;
      source.disconnect();
      sound.sources.delete(source);
      if (sound.sources.size === 0) this.cleanupSound(sound);
    };
  }

  private fadeOutSound(sound: ActiveSound): void {
    this.activeSounds.delete(sound.id);
    const now = sound.context.currentTime;
    sound.output.gain.cancelScheduledValues(now);
    sound.output.gain.setValueAtTime(sound.output.gain.value, now);
    sound.output.gain.linearRampToValueAtTime(0.0001, now + 0.012);
    for (const source of sound.sources) {
      try {
        source.stop(now + 0.014);
      } catch {
        source.onended = null;
        source.disconnect();
        sound.sources.delete(source);
      }
    }
    if (sound.sources.size === 0) this.cleanupSound(sound);
  }

  private forceStopSound(sound: ActiveSound): void {
    for (const source of sound.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended between disposal and cleanup.
      }
      source.disconnect();
    }
    sound.sources.clear();
    this.cleanupSound(sound);
  }

  private cleanupSound(sound: ActiveSound): void {
    this.activeSounds.delete(sound.id);
    for (const node of sound.nodes) node.disconnect();
    sound.nodes.clear();
    sound.output.disconnect();
  }

  private getContext(): AudioContext | null {
    if (this.disposed) return null;
    if (this.context) return this.context;
    const context = this.createContext();
    if (!context) return null;
    this.context = context;
    this.initializeGraph(context);
    return context;
  }

  private initializeGraph(context: AudioContext): void {
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.setValueAtTime(this.getMasterLevel(), context.currentTime);
    compressor.threshold.setValueAtTime(-18, context.currentTime);
    compressor.knee.setValueAtTime(14, context.currentTime);
    compressor.ratio.setValueAtTime(5, context.currentTime);
    compressor.attack.setValueAtTime(0.003, context.currentTime);
    compressor.release.setValueAtTime(0.18, context.currentTime);
    master.connect(compressor).connect(context.destination);

    const createBus = (bus: SoundBus): GainNode => {
      const gain = context.createGain();
      gain.gain.setValueAtTime(BUS_LEVELS[bus], context.currentTime);
      gain.connect(master);
      return gain;
    };
    this.graph = {
      master,
      compressor,
      buses: {
        ui: createBus('ui'),
        voice: createBus('voice'),
        combat: createBus('combat'),
        critical: createBus('critical'),
      },
    };
  }

  private getMasterLevel(): number {
    return this.muted ? 0 : MASTER_LEVEL * this.volume;
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    const frameCount = Math.max(1, Math.ceil(context.sampleRate * 3));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let state = 0x51f15e;
    for (let index = 0; index < channel.length; index += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      channel[index] = (state / 0xffff_ffff) * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
