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

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow that builds the Vite app and publishes `dist/` to GitHub Pages on pushes to `master`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

GitHub Pages must serve the built output, not the repository root. If Pages serves the source `index.html`, the browser will request `/src/main.tsx` and fail because TypeScript source files are not a production bundle.

## Controls

- In the Command Lobby, choose a pilot and battle protocol, then select exactly eight unique command chips for your loadout.
- Use the Tower Bay to equip the left and right Relay independently with fast Twin Guns, slow heavy Siege Rockets, or short-range Flame Jets.
- Open a robot card's lobby **LAB** control to allocate persistent Firmware points across Output, Range, and Speed; refunded tiers can be reassigned before deployment.
- Select a locked Vault card in the Chip Archive to inspect its ability, fragment requirement, and five-Mark Mastery track.
- Four shuffled chips are available at a time; playing one cycles the next chip into your hand.
- Click or tap a command card, then click or tap the highlighted deployment zone.
- Drag a command card onto your perspective-matched side of the arena; destroying an enemy Relay also unlocks deployment on that Relay's side of enemy territory.
- Placement previews report the selected lane, attack or ability range, enemy tower coverage, insufficient Charge, locked territory, and physical obstructions before a card is dropped.
- Use the lobby's Balanced, Rush, Siege, and Control presets or follow the live deck advisor when a loadout lacks openers, area control, support, Installations, or structure pressure.
- Choose **TRAINING** in the lobby for an action-driven tutorial covering Firmware, launch, card selection, deployment, and Relay breaches.
- Use a robot card's **LAB** control to inspect its abilities, range, output, and speed.
- Robot Lab firmware buttons spend match Charge on Output, Range, or Speed upgrades for that robot type.
- Programs can be targeted anywhere on the active battlefield; robots and Installations begin on your side and can later use only enemy lanes whose Relay has been destroyed.
- When VECTOR-9 is active, use the **Overdrive** control to spend 2 Charge on its command aura.
- Press `1`–`4` to select a card.
- Press `Esc` or right-click to cancel selection.
- Press `P` to pause, `M` to toggle sound, and `R` to restart after a match.

## Battle protocols

- **Core Siege** — a balanced three-minute battle using the standard tower network and Charge rate.
- **Turbo Grid** — a 90-second high-Charge fight with lighter Relay towers.
- **Relay Rush** — a two-minute race that ends as soon as either network breaches both enemy Relays.

The selected pilot, mode, last valid eight-chip loadout, and lobby Firmware allocation are stored locally. A seeded shuffle chooses the opening four-chip hand, then the remaining chips rotate fairly through the queue as cards are played.

Card collection progress is stored separately from the loadout. The original 13 cards begin unlocked; five Vault cards are recovered through Victory Caches. Locked-card fragments and permanent Mastery Marks survive reloads and apply to every future match.

## Rules

- Each network starts with two Relay towers and one central Core.
- The active battlefield is longer than it is wide, with each network's towers anchored to the mounting pads painted along the back edge of its board side.
- The battle canvas uses 80% of the frame height, with compact rear structures, health bars below the enemy line, and smaller command cards so the board remains readable beneath the HUD.
- Tower pads reserve only their visible footprint. The home deployment zone extends behind the rear line, allowing delayed flanking routes around or behind friendly towers.
- Relays and Cores defend only their own side of the bridge; they cannot target or splash robots that have not completed the crossing.
- Each Core begins dormant and activates its weapon only after one of its own Relays is destroyed.
- Relay weapon packages trade damage, firing cycle, range, and splash coverage; heavier rocket attacks fire substantially slower.
- Breaking a Relay scores one Data Point, exposes that lane's route to the Core, and unlocks card deployment in that lane's enemy-side territory.
- Battle Score rewards destroying robots (50), Installations (75), Relays (500), and the enemy Core (1,500), plus a 1,000-point victory bonus.
- Destroying the enemy Core wins immediately.
- If a protocol's timer expires, Data Points decide the winner; remaining tower integrity breaks a tie.
- Matches move through a 15-second Opening Window with 25% faster Charge, a Relay War midgame, and a Core Surge endgame with doubled Charge regeneration.

## Robot-tech card systems

- **Combat Units** move and fight autonomously with Omni-Track, Ground-Lock, Structure-Lock, splash, single-target, melee, ranged, and support roles.
- **Command Programs** bypass lanes. EMP Flash bursts and disables systems; Nano Cloud creates a persistent damage field. Programs deal only 35% damage to towers.
- **Installations** are stationary and decay throughout their lifetime. Arc Sentry defends a lane; Microbot Foundry fabricates pressure waves.
- **Tech classes**—Standard, Advanced, Prototype, Exotic, and Commander—signal mechanical complexity rather than raw power.
- **VECTOR-9** is a unique Commander. Only one can be active per team, and its manual Overdrive accelerates nearby allied units.
- **Vault cards** add five unlockable specials: AEGIS-4 enters with a damage-absorbing barrier; Wraith Coil phase-dashes to distant targets; Scrap Viper repairs itself from direct damage; Gravity Well pulls and slows enemy robots; Firewall Node reduces incoming damage around its non-stacking Bulwark Matrix.
- **Robot Lab upgrades** have two tiers per stat and apply immediately to deployed and future robots. Lobby Firmware establishes each match's free baseline; Charge-funded battle upgrades reset to that baseline on restart.
- **Card Mastery** is permanent and separate from Firmware. Card fragments automatically unlock or advance cards through Marks I–V at 8, 12, 20, 32, and 48 copies. Each Mark above I adds 4% Output and Integrity, up to 16% at Mark V.
- Player XP persists between matches. Every match grants participation XP, result XP, and 10% of the player's Battle Score; every two player levels add one lobby Firmware point, from six at Level 1 to a maximum of twelve.
- Player victories award one to three random Victory Caches. Cache, Vault, and Core tiers contain increasingly large card-fragment drops and can include a direct Mastery upgrade; Vault and Core caches always include at least one Vault-card drop.
- **Tower Bay packages** persist with the lobby loadout. Twin Guns focus one target, Siege Rockets deliver slow heavy splash, and Flame Jets rapidly control clusters at short range, each with a distinct tower skin.
- Deployed robots use arena-specific elevated three-quarter sprites with separate away/toward poses, smoothed four-step locomotion cycles with dedicated transition frames, projection-aware foreshortening, and grounded shadows; card and lobby portraits remain unchanged.
- Robot and tower attacks launch visible bullets or rockets; target locks, damage/healing numbers, status rings, impacts, and destroyed combatants make each exchange readable at arena scale.

## Verification

```bash
npm run check
```

This runs the TypeScript compiler, Vitest suite, and production build. The deterministic simulation tests cover deck validation and shuffle behavior, custom card cycling, all three battle protocols, Charge regeneration, Robot Lab upgrades, Card Mastery, all five Vault abilities, Relay weapon packages and splash behavior, projectile/destruction event ordering, Program damage and control, Installation decay and fabrication, Commander Overdrive, pausing, terminal-event ordering, Relay scoring, instant Core victory, lobby return, and seeded replay consistency. Progression tests cover chest odds and reward boundaries, fragment promotions, direct upgrades, corrupted random input, and collection normalization. Presentation tests cover atlas mapping, direction hysteresis, gait timing, paused/disabled/dead frames, and chassis metadata. Storage tests cover unavailable browser storage, partial loadout edits, card-collection recovery, and persistent Tower Bay selections.

For a reproducible local match, add a positive integer seed to the URL, such as `?seed=12345`. Development builds expose a small `window.__CRASH_ROBOTO__` test bridge; production builds do not.

## Project structure

- `src/game/core/` owns the deterministic match rules and card definitions. It has no Phaser or React dependency.
- `src/game/bridge/` publishes immutable match snapshots and translates UI commands into engine actions.
- `src/game/phaser/` owns the deck-aware asset manifest and renders the arena, perspective units, projectiles, impacts, and destruction effects.
- `src/features/` contains pilot presentation, the Command Lobby, battle HUD, card presentation, progression/reward ownership, overlays, and Robot Lab.
- `src/app/` composes the application, persists preferences/loadouts, and lazy-loads the Phaser battle bundle.
- `public/assets/game/` contains only assets required by the shipped game. Early visual studies and the legacy flat board live in `docs/concepts/` so they are not copied into production builds.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for state ownership, runtime flow, and extension notes.
