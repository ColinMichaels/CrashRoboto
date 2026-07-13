import { FIXED_STEP_MS } from '../core/content';
import { MatchEngine } from '../core/MatchEngine';
import type { GameCommand, GameEvent, MatchSnapshot } from '../core/types';

type SnapshotListener = () => void;
type EventListener = (event: GameEvent) => void;

export class GameBridge {
  private readonly engine: MatchEngine;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly eventListeners = new Set<EventListener>();
  private snapshot: MatchSnapshot;
  private accumulator = 0;
  private disposed = false;

  constructor(seed = 0xc0ffee) {
    this.engine = new MatchEngine((event) => this.publishEvent(event), seed);
    this.snapshot = this.engine.getSnapshot();
  }

  readonly getSnapshot = (): MatchSnapshot => this.snapshot;

  readonly subscribe = (listener: SnapshotListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  subscribeToEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  dispatch(command: GameCommand): boolean {
    if (this.disposed) return false;
    const accepted = this.engine.dispatch(command);
    if (
      accepted &&
      (
        command.type === 'start' ||
        command.type === 'restart' ||
        command.type === 'nextRound' ||
        command.type === 'returnToLobby'
      )
    ) {
      this.accumulator = 0;
    }
    this.publishSnapshot();
    return accepted;
  }

  tick(deltaMs: number): void {
    if (
      this.disposed ||
      (this.snapshot.phase !== 'playing' && this.snapshot.phase !== 'resolving')
    ) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(Math.max(deltaMs, 0), 250);
    let stepped = false;
    while (this.accumulator >= FIXED_STEP_MS) {
      this.engine.step(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      stepped = true;
    }
    if (stepped) this.publishSnapshot();
  }

  advanceForTest(ms: number): void {
    const steps = Math.ceil(ms / FIXED_STEP_MS);
    for (let index = 0; index < steps; index += 1) this.engine.step(FIXED_STEP_MS);
    this.publishSnapshot();
  }

  debugDamageTower(id: string, amount: number): void {
    this.engine.debugDamageTower(id, amount);
    this.publishSnapshot();
  }

  debugExpireTimer(): void {
    this.engine.debugExpireTimer();
    this.publishSnapshot();
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    this.eventListeners.clear();
  }

  private publishSnapshot(): void {
    this.snapshot = this.engine.getSnapshot();
    for (const listener of this.listeners) listener();
  }

  private publishEvent(event: GameEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}
