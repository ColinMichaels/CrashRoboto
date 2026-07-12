# Crash Roboto architecture

Crash Roboto separates deterministic game rules from rendering. This keeps matches reproducible, makes the rule set testable without a browser, and lets the React interface and Phaser presentation evolve independently.

## Runtime flow

1. React owns lobby drafts, sound preference, transient drag/Lab state, and the visible application phase.
2. UI actions dispatch typed commands through `GameBridge`.
3. `MatchEngine` validates the command, advances the deterministic simulation, and produces an immutable `MatchSnapshot`.
4. React reads snapshots for the HUD and overlays. Phaser reads the same snapshots for arena presentation.
5. Typed game events drive short-lived presentation such as projectiles, explosions, guidance, and synthesized audio.

The Phaser bundle is loaded only after a match starts, keeping the lobby's initial JavaScript smaller. Development-only debug hooks are gated by Vite's `DEV` flag and are absent from production output.

## State ownership

- `MatchEngine`: decks, shuffled queues, charge, the configured Firmware baseline, battle upgrades, units, installations, zones, towers, timers, scoring, and results.
- `GameBridge`: subscriptions, command forwarding, and fixed-step frame advancement.
- React: lobby draft, stored preferences, selected Robot Lab panel, drag origin, and modal focus.
- `BattleScene`: visual objects keyed to engine entity IDs; it never decides combat outcomes.
- `SoundEngine`: a capped set of temporary Web Audio voices, muted state, and audio-context lifecycle.

Loadout persistence stores the selected pilot and protocol independently from the last valid eight-card deck. Removing a card can therefore create a temporary lobby draft without erasing the last playable loadout. Firmware allocations are validated against the active robot cards and the six-point budget before they are persisted or accepted by the match engine.

## Presentation assets

Runtime assets live under `public/assets/game/`. Card portraits use the original robot/system sheets. Arena units use the separate six-column, three-frame-per-direction locomotion atlas so battle poses, direction, gait frames, projection scale, and shadows can change without altering lobby art.

The generated concept studies in `docs/concepts/` are design references only. Keeping them outside `public/` prevents Vite from copying unused multi-megabyte images into every build.

## Extending the game

- Add or tune cards in `src/game/core/content.ts`, then cover new mechanics in `MatchEngine.test.ts`.
- Add new commands/events to `src/game/core/types.ts`, implement rules in `MatchEngine`, and let presentation subscribe through `GameBridge`.
- Keep combat decisions out of React and Phaser. Both should present engine state rather than mutate it directly.
- Preserve seeded behavior: all match randomness must use the engine's seeded random source.
- Run `npm run check` before committing. This enforces strict TypeScript, unused-code checks, simulation/presentation/storage tests, and a production build.
