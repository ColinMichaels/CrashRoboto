# Extending Crash Roboto

This guide answers two questions before an addon starts: **who owns the new behavior**, and **which contracts are allowed to cross a layer**. Following these boundaries keeps a card, reward, panel, or presentation effect from becoming a second source of truth.

## Dependency direction

Dependencies should flow from later rows toward earlier, more stable rows. A layer should not import a later row; `app` is the only composition root.

| Layer | Owns | May depend on | Must not own |
| --- | --- | --- | --- |
| `src/game/core/` | Deterministic rules, content definitions, commands, events, snapshots | Other core modules | React state, Phaser objects, browser storage, audio playback |
| `src/persistence/` | Defensive browser storage access and schema adapters | Core normalization and types | UI workflows, match rules, presentation state |
| `src/game/bridge/` | Command forwarding, subscriptions, fixed-step advancement | `game/core` | Match rules or presentation state |
| `src/audio/` | Playback engines, cue catalogs, event-to-cue mapping | Core types and events | React lifecycle, match decisions, component state |
| `src/game/phaser/` | Arena assets and snapshot/event presentation | `game/core`, `game/bridge` | Combat outcomes, rewards, storage, UI workflows |
| `src/features/` | Lobby, HUD, overlays, audio controls, progression workflows | Stable contracts from core, bridge, audio, and persistence | A second combat simulation or direct Phaser mutation |
| `src/app/` | Composition and boot/deployment orchestration | All public layer contracts | Reimplementing feature internals |

`App.tsx` is the composition root. It may connect features, but reusable behavior should live with the feature that owns it. For example, audio lifecycle and preferences belong to `features/audio/useGameAudio.ts`; the app only asks it to switch playlists or play interface cues.

## Choose the owner first

- If it can change who wins, what can be deployed, damage, timing, Charge, targeting, or score, it belongs in `game/core`.
- If it is persistent between matches, put the normalization rule in core and the browser read/write adapter in `app`.
- If it turns an existing snapshot or event into pixels, it belongs in `game/phaser` or a React feature component.
- If it turns an existing event into sound, route it through `audio/soundDesign.ts` and let `SoundEngine` render it.
- If it is a multi-step UI workflow such as collecting caches, keep the transition pure and tested beside the owning feature, then let a hook coordinate storage and React state.
- If two screens need the same calculation, move that calculation to the lowest framework-free owner. Do not synchronize duplicate derived state with effects.

## Common addon routes

### Add a card

1. Add the ID and definition in `game/core/types.ts` and `game/core/content.ts`.
2. Add or extend the mechanic in `MatchEngine.ts`; consume only the engine's seeded random source.
3. Register card and arena sheets in `game/core/spriteSheets.ts` and `game/phaser/arenaAssets.ts` when new art is required.
4. Add the exhaustive voice/cue profile in `audio/soundDesign.ts`.
5. Decide whether the card is a starter or Vault item in `game/core/collection.ts`.
6. Test rules in `MatchEngine.test.ts`, catalog coverage in content/asset tests, and cue coverage in audio tests.

Avoid card-specific branches in `Lobby.tsx`, `Hud.tsx`, or `BattleScene.ts` when the behavior can be expressed by definition metadata or a typed event.

### Add a battle mechanic

1. Define the smallest typed command, event, and snapshot field required in `game/core/types.ts`.
2. Implement validation and state changes in `MatchEngine`.
3. Expose the command through `GameBridge`; keep the bridge free of rule decisions.
4. Render persistent state from snapshots and one-shot effects from events.
5. Add seeded replay and rejection-path tests before presentation polish.

Events are authoritative for one-shot effects. Do not infer a projectile, voice line, or explosion by comparing snapshots in multiple renderers.

### Add progression or rewards

1. Keep reward odds, normalization, and before/after reveal generation in `game/core/collection.ts` or `game/core/progression.ts`.
2. Keep browser persistence in a focused `persistence/*Storage.ts` adapter with corrupt/unavailable-storage tests.
3. Coordinate the match boundary in `features/progression/useMatchRewards.ts`.
4. Model multi-step claiming as a pure transition beside the feature, following `cacheCollection.ts`.

Victory Cache reveals are generated once after the final match result. Collection applies those immutable reveals in order; exiting the flow claims all remaining reveals before transient reward state is cleared.

### Add a lobby panel or overlay

1. Put the component in the feature that owns the interaction.
2. Keep local open/close, focus return, and animation state in that component or feature hook.
3. Pass typed values and actions from `App`; do not pass the entire bridge when a narrow callback is enough.
4. Derive labels, counts, and disabled states during render unless the calculation is genuinely expensive.
5. Add accessible names, keyboard behavior, and a focused presentation/helper test.

If a component file grows because it contains several independently testable panels, extract those panels before adding another mode flag.

### Add music or sound

- Add bundled tracks to `public/assets/audio/music/` and register them in `audio/musicCatalog.ts` using `import.meta.env.BASE_URL`.
- Keep playlist switching, mute migration, saved levels, pause/resume behavior, and engine disposal in `features/audio/useGameAudio.ts`.
- Map match events to cues in `audio/soundDesign.ts`; implement synthesis or recorded playback in `SoundEngine`.
- Do not load music through Phaser or create extra global keyboard/document listeners in audio components.

### Add runtime art

- Store editable PNG sources and optimized WebP runtime files under `public/assets/game/`.
- Register shared sheets in `game/core/spriteSheets.ts` and deck-conditional arena textures in `game/phaser/arenaAssets.ts`.
- Add startup-visible files to the initial preloader and non-critical files to deferred warmup. Match-only files belong in the deck-aware manifest.
- Keep concept studies in `docs/concepts/`; files under `public/` ship in the production bundle whether code references them or not.

## Persistence rules

- Components and game rules never access `localStorage` directly. Use `persistence/browserStorage.ts` through a focused adapter or a feature controller.
- Treat stored data as `unknown`, normalize every field, and return usable defaults on missing, malformed, or unavailable storage.
- Version a schema when its shape changes. Preserve migration support until intentionally removed.
- Persist the last valid playable loadout while allowing the current lobby draft to be temporarily incomplete.
- An intentional numeric value of zero is valid for audio preferences and must not be replaced by a default.

## Before merging an addon

- There is one owner for each new piece of state.
- Core behavior is deterministic and has no browser or renderer dependency.
- One-shot presentation is driven by typed events; durable presentation is driven by snapshots.
- New assets are in the narrowest preload path.
- Storage input is normalized and failure-tested.
- Existing exhaustive catalogs still compile and have coverage.
- `npm run check` passes, including the production chunk budgets.
