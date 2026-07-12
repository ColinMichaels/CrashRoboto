# Crash Roboto architecture

Crash Roboto separates deterministic game rules from rendering. This keeps matches reproducible, makes the rule set testable without a browser, and lets the React interface and Phaser presentation evolve independently.

## Runtime flow

1. React owns lobby drafts, sound preference, transient drag/Lab state, and the visible application phase.
2. UI actions dispatch typed commands through `GameBridge`.
3. `MatchEngine` validates the command, advances the deterministic simulation, and produces an immutable `MatchSnapshot`.
4. React reads snapshots for the HUD and overlays. Phaser reads the same snapshots for arena presentation.
5. Typed game events drive short-lived presentation such as projectiles, explosions, guidance, card acknowledgements, and combat audio. Selection and match-start events keep mouse, keyboard, launch, and restart cues authoritative and single-fire. A separate browser media element streams background music independently of the deterministic match loop.

The Phaser runtime is isolated in its own vendor chunk and loaded only when the player signals launch intent, keeping it out of the lobby's initial JavaScript while allowing the browser to cache the engine independently from arena feature changes. Production builds enforce a 500 kB budget for application chunks and a separate 1,400 kB budget for the deferred Phaser runtime. Development-only debug hooks are gated by Vite's `DEV` flag and are absent from production output.

## State ownership

- `MatchEngine`: decks, shuffled queues, charge, the configured Firmware baseline, battle upgrades, units, installations, zones, towers, timers, scoring, and results.
- `GameBridge`: subscriptions, command forwarding, and fixed-step frame advancement.
- React: lobby draft, stored preferences, selected Robot Lab/card-intel panel, music-player presentation, drag origin, and modal focus.
- `useMatchRewards`: persistent player progress, card collection, once-per-match reward claims, and immutable Victory Cache reveals.
- `BattleScene`: visual objects keyed to engine entity IDs; it never decides combat outcomes.
- `SoundEngine`: a priority-aware Web Audio mixer with UI, robot-voice, combat, and critical buses; it owns SFX mute, logical-voice limits, deterministic noise, cue throttling, and audio-context lifecycle.
- `MusicEngine`: the app-level playlist, streamed media element, playback position, music level/mute state, and track lifecycle. It is intentionally independent from Phaser so the theme can play in the lobby before the arena bundle loads.

Loadout persistence stores the selected pilot and protocol independently from the last valid eight-card deck. Removing a card can therefore create a temporary lobby draft without erasing the last playable loadout. Firmware allocations are validated against the active robot cards and the six-point budget before they are persisted or accepted by the match engine. Card collection persistence is a separate normalized record: starter cards can never be relocked by partial or corrupt data, while Vault fragments and Mastery levels can evolve without changing the loadout schema.

Victory Cache generation lives outside `MatchEngine`. Match simulation stays seeded and replayable; `useMatchRewards` claims a win reward once per ended revision, applies it to the collection immediately, saves it, and then presents the immutable before/after reveal. The animation can therefore be closed or interrupted without losing or rerolling the reward.

## Presentation assets

Runtime assets live under `public/assets/game/`. `spriteSheets.ts` is the shared, exhaustive catalog for portrait-sheet layout and Phaser texture keys. `arenaAssets.ts` builds each match's preload manifest from the two active decks: portrait-only robot art is never uploaded to Phaser, and Vault card/unit textures are loaded only when that match can use them. Arena units use separate six-column, three-frame-per-direction locomotion atlases so battle poses, direction, gait frames, projection scale, and shadows can change without altering lobby art. Victory Caches use an isolated open-cache asset while all reward copy and progress remain code-native.

The generated concept studies in `docs/concepts/` are design references only. Keeping them outside `public/` prevents Vite from copying unused multi-megabyte images into every build. Shipped music lives in `public/assets/audio/music/` and is addressed through `import.meta.env.BASE_URL` so relative GitHub Pages builds resolve it correctly.

## Extending the game

- Add or tune cards in `src/game/core/content.ts`, then cover new mechanics in `MatchEngine.test.ts`.
- Keep new card sheets registered in `src/game/core/spriteSheets.ts`; catalog and arena-manifest tests guard frame capacity and conditional loading.
- Add new commands/events to `src/game/core/types.ts`, implement rules in `MatchEngine`, and let presentation subscribe through `GameBridge`.
- Give every new card an exhaustive profile in `src/audio/soundDesign.ts`; route new high-value game events there before adding Web Audio rendering in `SoundEngine`.
- Add owned background tracks to `public/assets/audio/music/` and register them in `src/audio/musicCatalog.ts`. Do not put music in the Phaser asset manifest.
- Keep combat decisions out of React and Phaser. Both should present engine state rather than mutate it directly.
- Preserve seeded behavior: all match randomness must use the engine's seeded random source.
- Run `npm run check` before committing. This enforces strict TypeScript, unused-code checks, simulation/presentation/storage tests, and a production build.
