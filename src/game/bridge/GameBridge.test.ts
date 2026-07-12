import { describe, expect, it, vi } from 'vitest';
import { GameBridge } from './GameBridge';

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
