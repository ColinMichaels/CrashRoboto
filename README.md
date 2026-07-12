# Crash Roboto

Crash Roboto is a standalone real-time robot arena strategy game built with React, TypeScript, Vite, and Phaser. It uses original tech-themed boards, towers, robots, terminology, and generated production art.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm 10 or newer

## Play locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a static production bundle:

```bash
npm run build
npm run preview
```

The generated `dist/` directory can be hosted on any static web host.

## Controls

- In the Command Lobby, choose a pilot and battle protocol, then select exactly eight unique command chips for your loadout.
- Open a robot's lobby **LAB** control to allocate up to six persistent Firmware points across Output, Range, and Speed; refunded tiers can be reassigned before deployment.
- Four shuffled chips are available at a time; playing one cycles the next chip into your hand.
- Click or tap a command card, then click or tap the highlighted deployment zone.
- Drag a command card directly onto your side of the arena.
- Use a robot card's **LAB** control to inspect its abilities, range, output, and speed.
- Robot Lab firmware buttons spend match Charge on Output, Range, or Speed upgrades for that robot type.
- Programs can be targeted anywhere on the battlefield; Installations must be placed on your side.
- When VECTOR-9 is active, use the **Overdrive** control to spend 2 Charge on its command aura.
- Press `1`–`4` to select a card.
- Press `Esc` or right-click to cancel selection.
- Press `P` to pause, `M` to toggle sound, and `R` to restart after a match.

## Battle protocols

- **Core Siege** — a balanced three-minute battle using the standard tower network and Charge rate.
- **Turbo Grid** — a 90-second high-Charge fight with lighter Relay towers.
- **Relay Rush** — a two-minute race that ends as soon as either network breaches both enemy Relays.

The selected pilot, mode, last valid eight-chip loadout, and lobby Firmware allocation are stored locally. A seeded shuffle chooses the opening four-chip hand, then the remaining chips rotate fairly through the queue as cards are played.

## Rules

- Each network starts with two Relay towers and one central Core.
- Breaking a Relay scores one Data Point and exposes that lane's route to the Core.
- Destroying the enemy Core wins immediately.
- If a protocol's timer expires, Data Points decide the winner; remaining tower integrity breaks a tie.
- Charge regenerates automatically and doubles after the selected protocol reaches its Charge Surge threshold.

## Robot-tech card systems

- **Combat Units** move and fight autonomously with Omni-Track, Ground-Lock, Structure-Lock, splash, single-target, melee, ranged, and support roles.
- **Command Programs** bypass lanes. EMP Flash bursts and disables systems; Nano Cloud creates a persistent damage field. Programs deal only 35% damage to towers.
- **Installations** are stationary and decay throughout their lifetime. Arc Sentry defends a lane; Microbot Foundry fabricates pressure waves.
- **Tech classes**—Standard, Advanced, Prototype, Exotic, and Commander—signal mechanical complexity rather than raw power.
- **VECTOR-9** is a unique Commander. Only one can be active per team, and its manual Overdrive accelerates nearby allied units.
- **Robot Lab upgrades** have two tiers per stat and apply immediately to deployed and future robots. Lobby Firmware establishes each match's free baseline; Charge-funded battle upgrades reset to that baseline on restart.
- Deployed robots use arena-specific elevated three-quarter sprites with separate away/toward poses, two-frame locomotion cycles, projection-aware foreshortening, and grounded shadows; card and lobby portraits remain unchanged.
- Robot and tower attacks launch visible bullets or rockets; impacts and destroyed combatants use perspective-scaled explosions.

## Verification

```bash
npm run check
```

This runs the TypeScript compiler, Vitest suite, and production build. The deterministic simulation tests cover deck validation and shuffle behavior, custom card cycling, all three battle protocols, Charge regeneration, Robot Lab upgrades, projectile/destruction event ordering, Program damage and control, Installation decay and fabrication, Commander Overdrive, pausing, terminal-event ordering, Relay scoring, instant Core victory, lobby return, and seeded replay consistency. Presentation tests cover atlas mapping, direction hysteresis, gait timing, paused/disabled/dead frames, and chassis metadata. Storage tests cover unavailable browser storage and partial loadout edits.

For a reproducible local match, add a positive integer seed to the URL, such as `?seed=12345`. Development builds expose a small `window.__CRASH_ROBOTO__` test bridge; production builds do not.

## Project structure

- `src/game/core/` owns the deterministic match rules and card definitions. It has no Phaser or React dependency.
- `src/game/bridge/` publishes immutable match snapshots and translates UI commands into engine actions.
- `src/game/phaser/` renders the arena, perspective units, projectiles, impacts, and destruction effects.
- `src/features/` contains pilot presentation, the Command Lobby, battle HUD, card presentation, overlays, and Robot Lab.
- `src/app/` composes the application, persists preferences/loadouts, and lazy-loads the Phaser battle bundle.
- `public/assets/game/` contains only assets required by the shipped game. Early visual studies and the legacy flat board live in `docs/concepts/` so they are not copied into production builds.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for state ownership, runtime flow, and extension notes.
