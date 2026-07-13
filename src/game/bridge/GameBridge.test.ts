import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAYER_DECK, FIXED_STEP_MS } from '../core/content';
import { POWER_DRAIN_DURATION_MS, POWER_DRAIN_WARNING_MS } from '../core/MatchEngine';
import { GameBridge } from './GameBridge';

type GameBridgeHarness = {
  engine: {
    remainingMs: number;
    aiDecisionMs: number;
  };
};

const harness = (bridge: GameBridge) => bridge as unknown as GameBridgeHarness;

const settlePowerDrain = (bridge: GameBridge) => {
  const maxSteps = Math.ceil(
    (POWER_DRAIN_WARNING_MS + POWER_DRAIN_DURATION_MS + FIXED_STEP_MS) / FIXED_STEP_MS,
  );
  for (let steps = 0; steps < maxSteps && bridge.getSnapshot().phase === 'resolving'; steps += 1) {
    bridge.tick(FIXED_STEP_MS);
  }
  expect(bridge.getSnapshot().phase).not.toBe('resolving');
};

describe('GameBridge ticking', () => {
  it('does not publish no-op snapshots outside active play', () => {
    const bridge = new GameBridge(0xc0ffee);
    const listener = vi.fn();
    bridge.subscribe(listener);

    bridge.tick(1_000);
    expect(listener).not.toHaveBeenCalled();

    bridge.dispatch({ type: 'start' });
    listener.mockClear();
    bridge.tick(50);
    expect(listener).toHaveBeenCalledTimes(1);

    bridge.dispatch({ type: 'togglePause' });
    expect(bridge.getSnapshot().phase).toBe('paused');
    listener.mockClear();
    bridge.tick(1_000);
    expect(listener).not.toHaveBeenCalled();

    bridge.dispose();
  });

  it('keeps ticking and publishing snapshots throughout power-drain resolution', () => {
    const bridge = new GameBridge(1);
    const listener = vi.fn();
    bridge.subscribe(listener);
    bridge.dispatch({ type: 'start' });
    bridge.debugDamageTower('enemy-left', 100);
    harness(bridge).engine.aiDecisionMs = Number.POSITIVE_INFINITY;
    harness(bridge).engine.remainingMs = FIXED_STEP_MS;

    bridge.tick(FIXED_STEP_MS);
    expect(bridge.getSnapshot()).toMatchObject({
      phase: 'resolving',
      result: null,
      towerDamage: { player: 100, enemy: 0 },
      powerDrain: {
        stage: 'warning',
        remainingMs: POWER_DRAIN_WARNING_MS + POWER_DRAIN_DURATION_MS,
        progress: 0,
      },
    });
    const hpAtResolution = Object.fromEntries(
      bridge.getSnapshot().towers.map((tower) => [tower.id, tower.hp]),
    );

    listener.mockClear();
    for (let elapsed = 0; elapsed < POWER_DRAIN_WARNING_MS; elapsed += FIXED_STEP_MS) {
      bridge.tick(FIXED_STEP_MS);
    }
    expect(listener).toHaveBeenCalledTimes(POWER_DRAIN_WARNING_MS / FIXED_STEP_MS);
    expect(bridge.getSnapshot().powerDrain).toEqual({
      stage: 'draining',
      remainingMs: POWER_DRAIN_DURATION_MS,
      progress: 0,
    });
    expect(Object.fromEntries(bridge.getSnapshot().towers.map((tower) => [tower.id, tower.hp])))
      .toEqual(hpAtResolution);

    listener.mockClear();
    bridge.tick(FIXED_STEP_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bridge.getSnapshot().phase).toBe('resolving');
    expect(bridge.getSnapshot().powerDrain).toEqual({
      stage: 'draining',
      remainingMs: POWER_DRAIN_DURATION_MS - FIXED_STEP_MS,
      progress: FIXED_STEP_MS / POWER_DRAIN_DURATION_MS,
    });
    expect(bridge.getSnapshot().towers.some((tower) => tower.hp < hpAtResolution[tower.id]))
      .toBe(true);

    settlePowerDrain(bridge);
    expect(bridge.getSnapshot()).toMatchObject({
      phase: 'ended',
      powerDrain: null,
      result: { winner: 'player', reason: 'power-drain' },
    });

    bridge.dispose();
  });

  it('ticks a series Power Drain into round-ended and clears partial time before the next round', () => {
    const bridge = new GameBridge(9);
    const listener = vi.fn();
    bridge.subscribe(listener);
    expect(bridge.dispatch({
      type: 'start',
      config: { modeId: 'best-of-three', playerDeck: DEFAULT_PLAYER_DECK },
    })).toBe(true);

    listener.mockClear();
    bridge.tick(FIXED_STEP_MS / 2);
    expect(listener).not.toHaveBeenCalled();
    bridge.debugDamageTower('enemy-left', 100);
    bridge.debugExpireTimer();
    expect(bridge.getSnapshot()).toMatchObject({
      phase: 'resolving',
      powerDrain: { stage: 'warning', progress: 0 },
    });

    listener.mockClear();
    settlePowerDrain(bridge);
    expect(listener).toHaveBeenCalled();
    expect(bridge.getSnapshot()).toMatchObject({
      phase: 'round-ended',
      result: null,
      powerDrain: null,
      series: {
        currentRound: 1,
        wins: { player: 1, enemy: 0 },
        roundResult: { winner: 'player', reason: 'power-drain' },
      },
    });

    expect(bridge.dispatch({ type: 'nextRound' })).toBe(true);
    expect(bridge.getSnapshot()).toMatchObject({
      phase: 'playing',
      remainingMs: 180_000,
      powerDrain: null,
      series: { currentRound: 2, wins: { player: 1, enemy: 0 }, roundResult: null },
    });
    listener.mockClear();

    bridge.tick(FIXED_STEP_MS / 2);
    expect(listener).not.toHaveBeenCalled();
    expect(bridge.getSnapshot().remainingMs).toBe(180_000);
    bridge.tick(FIXED_STEP_MS / 2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bridge.getSnapshot().remainingMs).toBe(180_000 - FIXED_STEP_MS);

    bridge.dispose();
  });

  it('does not clear accumulated play time for a rejected nextRound command', () => {
    const bridge = new GameBridge(10);
    const listener = vi.fn();
    bridge.subscribe(listener);
    expect(bridge.dispatch({
      type: 'start',
      config: { modeId: 'best-of-three', playerDeck: DEFAULT_PLAYER_DECK },
    })).toBe(true);
    listener.mockClear();

    bridge.tick(FIXED_STEP_MS / 2);
    expect(bridge.dispatch({ type: 'nextRound' })).toBe(false);
    listener.mockClear();
    bridge.tick(FIXED_STEP_MS / 2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(bridge.getSnapshot().remainingMs).toBe(180_000 - FIXED_STEP_MS);
    bridge.dispose();
  });

  it('stops publishing ticks after the match ends', () => {
    const bridge = new GameBridge(0xc0ffee);
    const listener = vi.fn();
    bridge.subscribe(listener);
    bridge.dispatch({ type: 'start' });

    const enemyCore = bridge.getSnapshot().towers.find(
      (tower) => tower.team === 'enemy' && tower.kind === 'core',
    );
    expect(enemyCore).toBeDefined();
    bridge.debugDamageTower(enemyCore!.id, Number.MAX_SAFE_INTEGER);
    expect(bridge.getSnapshot().phase).toBe('ended');

    listener.mockClear();
    bridge.tick(1_000);
    expect(listener).not.toHaveBeenCalled();

    bridge.dispose();
  });
});
