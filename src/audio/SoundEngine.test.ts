import { describe, expect, it } from 'vitest';
import { POWER_DRAIN_DURATION_MS, POWER_DRAIN_WARNING_MS } from '../game/core/MatchEngine';
import type { GameEvent } from '../game/core/types';
import { RECORDED_PRELOAD_PATHS } from './recordedSoundDesign';
import { SoundEngine } from './SoundEngine';

class FakeAudioParam {
  value = 0;

  cancelScheduledValues(): void {}

  setValueAtTime(value: number): void {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }

  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeAudioNode {
  connect<T>(destination: T): T {
    return destination;
  }

  disconnect(): void {}
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  detune = new FakeAudioParam();
  onended: (() => void) | null = null;

  start(): void {}

  stop(): void {}
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  playbackRate = new FakeAudioParam();
  onended: (() => void) | null = null;

  start(): void {}

  stop(): void {}
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}

class FakeDynamicsCompressorNode extends FakeAudioNode {
  threshold = new FakeAudioParam();
  knee = new FakeAudioParam();
  ratio = new FakeAudioParam();
  attack = new FakeAudioParam();
  release = new FakeAudioParam();
}

class FakeAudioBuffer {
  private readonly data: Float32Array;

  constructor(length: number) {
    this.data = new Float32Array(length);
  }

  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeAudioContext {
  currentTime = 1;
  sampleRate = 200;
  state: AudioContextState = 'running';
  destination = new FakeAudioNode();
  oscillatorCount = 0;
  noiseCount = 0;
  readonly gains: FakeGainNode[] = [];

  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    this.oscillatorCount += 1;
    return new FakeOscillatorNode() as unknown as OscillatorNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    this.noiseCount += 1;
    return new FakeBufferSourceNode() as unknown as AudioBufferSourceNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new FakeBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return new FakeDynamicsCompressorNode() as unknown as DynamicsCompressorNode;
  }

  createBuffer(_channels: number, length: number): AudioBuffer {
    return new FakeAudioBuffer(length) as unknown as AudioBuffer;
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

const playerUnit = { id: 'player-unit', entityType: 'unit', team: 'player', x: 100, y: 500, radius: 30 } as const;
const enemyUnit = { id: 'enemy-unit', entityType: 'unit', team: 'enemy', x: 500, y: 200, radius: 30 } as const;

function renderEvent(event: GameEvent): FakeAudioContext {
  const context = new FakeAudioContext();
  const engine = new SoundEngine({ createContext: () => context as unknown as AudioContext });
  engine.playEvent(event);
  engine.dispose();
  return context;
}

describe('SoundEngine', () => {
  it('starts at the tuned 25% level relative to the SFX ceiling', () => {
    const context = new FakeAudioContext();
    const engine = new SoundEngine({ createContext: () => context as unknown as AudioContext });

    expect(engine.getVolume()).toBe(0.25);
    engine.blip();
    expect(context.gains[0]?.gain.value).toBeCloseTo(0.58 * 0.25);

    engine.dispose();
  });

  it('clamps volume without creating a context and keeps level independent from mute', () => {
    const context = new FakeAudioContext();
    let createContextCalls = 0;
    const engine = new SoundEngine({
      createContext: () => {
        createContextCalls += 1;
        return context as unknown as AudioContext;
      },
    });

    engine.setVolume(0);
    engine.blip();
    expect(createContextCalls).toBe(0);

    engine.setVolume(0.25);
    expect(engine.getVolume()).toBe(0.25);
    expect(createContextCalls).toBe(0);
    engine.blip();
    expect(context.gains[0]?.gain.value).toBeCloseTo(0.58 * 0.25);

    engine.setMuted(true);
    expect(context.gains[0]?.gain.value).toBe(0);
    engine.setVolume(0.4);
    expect(context.gains[0]?.gain.value).toBe(0);
    engine.setMuted(false);
    expect(context.gains[0]?.gain.value).toBeCloseTo(0.58 * 0.4);

    engine.setVolume(4);
    engine.setVolume(Number.NaN);
    expect(engine.getVolume()).toBe(1);
    expect(context.gains[0]?.gain.value).toBeCloseTo(0.58);

    engine.dispose();
  });

  it('renders every high-value event family through browser-safe Web Audio nodes', () => {
    const events: GameEvent[] = [
      { type: 'matchStarted', modeId: 'core-siege', restart: false },
      {
        type: 'powerDrainStarted',
        warningMs: POWER_DRAIN_WARNING_MS,
        durationMs: POWER_DRAIN_DURATION_MS,
      },
      { type: 'cardSelected', team: 'player', cardId: 'swarm' },
      { type: 'cardPlayed', team: 'player', cardId: 'brute', x: 100, y: 500 },
      { type: 'playRejected', team: 'player', reason: 'charge' },
      { type: 'programCast', team: 'player', kind: 'emp', x: 0, y: 0, radius: 150 },
      { type: 'programCast', team: 'player', kind: 'nano', x: 0, y: 0, radius: 135 },
      { type: 'programCast', team: 'player', kind: 'gravity', x: 0, y: 0, radius: 150 },
      { type: 'installationPlaced', team: 'player', kind: 'sentry', x: 0, y: 0 },
      { type: 'installationPlaced', team: 'player', kind: 'foundry', x: 0, y: 0 },
      { type: 'installationPlaced', team: 'player', kind: 'firewall', x: 0, y: 0 },
      { type: 'unitDashed', unitId: 'wraith', team: 'player', kind: 'wraith', fromX: 0, fromY: 0, toX: 50, toY: 50 },
      { type: 'overdriveActivated', team: 'player', x: 0, y: 0 },
      { type: 'robotUpgraded', team: 'player', robotId: 'zip', stat: 'speed', tier: 2, cost: 3 },
      { type: 'projectileFired', attackId: 1, projectile: 'bullet', source: playerUnit, target: enemyUnit, amount: 40 },
      { type: 'projectileFired', attackId: 2, projectile: 'rocket', source: playerUnit, target: enemyUnit, amount: 90 },
      { type: 'projectileFired', attackId: 3, projectile: 'flame', source: playerUnit, target: enemyUnit, amount: 30 },
      { type: 'entityDestroyed', entity: enemyUnit, cause: 'projectile', byTeam: 'player', attackId: 1 },
      {
        type: 'towerDestroyed',
        tower: {
          id: 'enemy-left', team: 'enemy', kind: 'relay', lane: 'left', x: 500, y: 120,
          hp: 0, maxHp: 1_000, cooldown: 0, damage: 60, range: 200, attackInterval: 1,
          projectile: 'bullet', weapon: 'gun', splashRadius: 0, splashMultiplier: 0,
        },
      },
      { type: 'matchEnded', result: { winner: 'player', reason: 'core', headline: 'Won', detail: 'Core destroyed.' } },
    ];

    for (const event of events) {
      const context = renderEvent(event);
      expect(context.oscillatorCount + context.noiseCount, event.type).toBeGreaterThan(0);
    }
  });

  it('renders the full Power Drain warning and countdown sound bed', () => {
    const context = renderEvent({
      type: 'powerDrainStarted',
      warningMs: POWER_DRAIN_WARNING_MS,
      durationMs: POWER_DRAIN_DURATION_MS,
    });

    expect(context.noiseCount).toBe(1);
    expect(context.oscillatorCount).toBe(12);
  });

  it('renders all card identities and suppresses new nodes immediately while muted', () => {
    const context = new FakeAudioContext();
    const engine = new SoundEngine({ createContext: () => context as unknown as AudioContext });

    engine.playCardSelected('zip');
    const activeNodeCount = context.oscillatorCount + context.noiseCount;
    expect(activeNodeCount).toBeGreaterThan(0);

    engine.setMuted(true);
    engine.playCardSelected('gravity');
    engine.blip();
    expect(context.oscillatorCount + context.noiseCount).toBe(activeNodeCount);

    engine.dispose();
  });

  it('preloads recorded assets once and prefers them over procedural synthesis', async () => {
    const context = new FakeAudioContext();
    let loadCount = 0;
    const engine = new SoundEngine({
      createContext: () => context as unknown as AudioContext,
      loadSample: async () => {
        loadCount += 1;
        return new FakeAudioBuffer(20) as unknown as AudioBuffer;
      },
    });

    await Promise.all([engine.preload(), engine.preload()]);
    expect(loadCount).toBe(RECORDED_PRELOAD_PATHS.length);

    engine.playCardSelected('zip');
    expect(context.oscillatorCount).toBe(0);
    expect(context.noiseCount).toBe(1);

    engine.dispose();
  });

  it('suspends active sounds and suppresses new sounds until resumed', async () => {
    const context = new FakeAudioContext();
    const engine = new SoundEngine({ createContext: () => context as unknown as AudioContext });

    engine.blip();
    const activeNodeCount = context.oscillatorCount + context.noiseCount;
    engine.pause();
    await Promise.resolve();

    expect(context.state).toBe('suspended');
    engine.blip();
    expect(context.oscillatorCount + context.noiseCount).toBe(activeNodeCount);

    engine.resume();
    await Promise.resolve();
    expect(context.state).toBe('running');
    context.currentTime += 0.1;
    engine.blip();
    expect(context.oscillatorCount + context.noiseCount).toBeGreaterThan(activeNodeCount);

    engine.dispose();
  });
});
