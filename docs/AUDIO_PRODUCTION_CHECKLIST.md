# Crash Roboto Custom Audio Production Checklist

Use this document to plan, create, review, and integrate the custom audio package for Crash Roboto.

## Status legend

- `[ ]` Not complete
- `[x]` Complete or already supplied
- **P0**: required for the first complete custom-audio pass
- **P1**: card identity and gameplay clarity
- **P2**: polish, variation, and ambience

## Asset and export setup

- [ ] **P0** Create `public/assets/audio/sfx/ui/`.
- [ ] **P0** Create `public/assets/audio/sfx/combat/`.
- [ ] **P0** Create `public/assets/audio/sfx/cards/`.
- [ ] **P0** Create `public/assets/audio/sfx/match/`.
- [ ] **P0** Create `public/assets/audio/sfx/rewards/`.
- [ ] **P0** Preserve uncompressed WAV masters outside the runtime asset directory.
- [ ] **P0** Export browser-ready SFX in a consistent format and sample rate.
- [ ] **P0** Trim one-shots tightly and add short fades to prevent clicks.
- [ ] **P0** Make sustained ambience and machinery assets seamlessly loopable.
- [ ] **P0** Normalize perceived loudness by family rather than peak-normalizing every file identically.
- [ ] **P0** Keep music and SFX on separate buses and preserve their independent volume settings.
- [ ] **P0** Preserve the procedural sound engine as a fallback when a recorded asset cannot load.
- [ ] **P1** Produce two or more variations for frequently repeated shots, impacts, and acknowledgements.
- [ ] **P1** Add asset credits, creator, license, source-project, and approval status to release metadata.

Suggested naming format:

```text
family_subject_action_variant
ui_card_pickup_01
weapon_rocket_launch_heavy_02
card_zip_select_01
music_core_surge_loop
```

## Shared UI sounds

- [ ] **P0** `ui_confirm_01` — general positive button confirmation.
- [ ] **P0** `ui_reject_01` — invalid card play, insufficient Charge, locked action, or rejected upgrade.
- [ ] **P0** `ui_card_pickup_01` — card selected or drag started.
- [ ] **P0** `ui_card_drop_valid_01` — card successfully deployed.
- [ ] **P0** `ui_card_drop_invalid_01` — card released outside a legal deployment area.
- [ ] **P1** `ui_card_add_01` — card added to the lobby loadout.
- [ ] **P1** `ui_card_remove_01` — card removed from the lobby loadout.
- [ ] **P1** `ui_panel_open_01` — Robot Lab, collection, pilot selector, or audio mixer opened.
- [ ] **P1** `ui_panel_close_01` — panel or modal closed.
- [ ] **P1** `ui_mode_select_01` — game protocol selected.
- [ ] **P1** `ui_pilot_select_01` — active pilot selected.
- [ ] **P1** `ui_tower_weapon_select_01` — Relay weapon package selected.
- [ ] **P1** `ui_loadout_preset_01` — deck preset applied.
- [ ] **P1** `ui_upgrade_tier_1_01` — first firmware upgrade purchased.
- [ ] **P1** `ui_upgrade_tier_2_01` — second firmware upgrade purchased.
- [ ] **P1** `ui_upgrade_remove_01` — lobby firmware point removed.
- [ ] **P2** `ui_pause_01` — game paused.
- [ ] **P2** `ui_resume_01` — game resumed.
- [ ] **P2** `ui_mute_01` — master mute enabled.
- [ ] **P2** `ui_unmute_01` — master mute disabled.

## Match and round sounds

- [ ] **P0** `match_launch_01` — Deploy Loadout accepted.
- [ ] **P0** `match_start_core_siege_01` — Core Siege begins.
- [ ] **P0** `match_start_turbo_grid_01` — Turbo Grid begins.
- [ ] **P0** `match_start_relay_rush_01` — Relay Rush begins.
- [ ] **P0** `match_start_best_of_three_01` — Best of Three begins.
- [ ] **P0** `round_start_01` — later series round begins.
- [ ] **P1** `stage_relay_war_01` — opening Charge bonus ends and Relay War begins.
- [ ] **P1** `stage_core_surge_01` — Core Surge and double Charge begin.
- [ ] **P0** `power_drain_warning_01` — Power Drain warning starts.
- [ ] **P0** `power_drain_pulse_01` — repeating drain pulse.
- [ ] **P0** `round_victory_01` — player wins a non-final series round.
- [ ] **P0** `round_defeat_01` — enemy wins a non-final series round.
- [ ] **P0** `match_victory_01` — final player victory stinger.
- [ ] **P0** `match_defeat_01` — final player defeat stinger.
- [ ] **P0** `match_draw_01` — final draw stinger.

## Shared weapon and impact sounds

### Bullet and pulse weapons

- [ ] **P0** `weapon_bullet_light_fire_01` and `_02`.
- [ ] **P0** `weapon_bullet_heavy_fire_01` and `_02`.
- [ ] **P0** `weapon_sentry_burst_01` and `_02`.
- [ ] **P0** `weapon_pulse_fire_01` and `_02`.
- [ ] **P0** `impact_bullet_armor_01`, `_02`, and `_03`.
- [ ] **P1** `impact_bullet_shield_01` and `_02`.
- [ ] **P1** `impact_pulse_01` and `_02`.

### Rockets and siege weapons

- [ ] **P0** `weapon_rocket_launch_light_01` and `_02`.
- [ ] **P0** `weapon_rocket_launch_heavy_01` and `_02`.
- [ ] **P1** `weapon_rocket_flight_loop_01`.
- [ ] **P0** `impact_rocket_small_01` and `_02`.
- [ ] **P0** `impact_rocket_heavy_01` and `_02`.
- [ ] **P0** `impact_rocket_splash_01` and `_02`.
- [ ] **P1** `weapon_siege_charge_01`.

### Flame weapon

- [ ] **P0** `weapon_flame_ignite_01`.
- [ ] **P0** `weapon_flame_loop_01`.
- [ ] **P0** `weapon_flame_stop_01`.
- [ ] **P0** `impact_flame_01` and `_02`.

### Electrical effects

- [ ] **P0** `weapon_arc_charge_01`.
- [ ] **P0** `impact_arc_primary_01` and `_02`.
- [ ] **P0** `impact_arc_chain_01` and `_02`.
- [ ] **P1** `electronics_disabled_loop_01`.
- [ ] **P1** `electronics_recover_01`.

## Healing, shields, and defensive effects

- [ ] **P1** `repair_beam_start_01`.
- [ ] **P1** `repair_beam_loop_01`.
- [ ] **P1** `repair_beam_stop_01`.
- [ ] **P1** `repair_complete_01` and `_02`.
- [ ] **P1** `shield_activate_01`.
- [ ] **P1** `shield_impact_01`, `_02`, and `_03`.
- [ ] **P1** `shield_break_01`.
- [ ] **P1** `damage_reduction_ping_01` and `_02`.
- [ ] **P1** `lifesteal_siphon_01`.
- [ ] **P1** `self_repair_01`.

## Movement and machinery

- [ ] **P2** `movement_light_step_01`, `_02`, `_03`, and `_04`.
- [ ] **P2** `movement_heavy_step_01`, `_02`, `_03`, and `_04`.
- [ ] **P2** `movement_servo_light_01` and `_02`.
- [ ] **P2** `movement_servo_heavy_01` and `_02`.
- [ ] **P2** `movement_hover_loop_01`.
- [ ] **P1** `movement_phase_depart_01`.
- [ ] **P1** `movement_phase_arrive_01`.
- [ ] **P2** `movement_sentry_rotate_loop_01`.
- [ ] **P2** `movement_sentry_lock_01`.

## Destruction and tower sounds

- [ ] **P0** `destroy_robot_small_01`, `_02`, and `_03`.
- [ ] **P0** `destroy_robot_heavy_01` and `_02`.
- [ ] **P0** `destroy_robot_flying_01` and `_02`.
- [ ] **P0** `destroy_installation_01` and `_02`.
- [ ] **P1** `destroy_installation_decay_01`.
- [ ] **P0** `destroy_relay_friendly_01`.
- [ ] **P0** `destroy_relay_enemy_01`.
- [ ] **P0** `destroy_core_friendly_01`.
- [ ] **P0** `destroy_core_enemy_01`.
- [ ] **P1** `tower_damage_alarm_friendly_01`.
- [ ] **P1** `tower_damage_alarm_enemy_01`.
- [ ] **P0** `tower_relay_gun_fire_01` and `_02`.
- [ ] **P0** `tower_relay_rocket_fire_01` and `_02`.
- [ ] **P0** `tower_relay_flame_loop_01`.
- [ ] **P0** `tower_core_rocket_fire_01` and `_02`.

## Card identity rule

For every playable card:

- [ ] Create at least two short selection acknowledgements.
- [ ] Keep selection acknowledgements readable at low volume and under music.
- [ ] Avoid spoken copyrighted references or imitation of recognizable characters.
- [ ] Give player and enemy playback distinguishable pitch, filtering, or spatial treatment.
- [ ] Create at least two deploy acknowledgements for Units and the Commander.
- [ ] Review repeated playback for fatigue before final approval.

## Unit and Commander card sounds

### Bolt Hound / ZIP

- [ ] **P1** `card_zip_select_01` and `_02` — robotic bark/chirp.
- [ ] **P1** `card_zip_deploy_01` and `_02` — fast deployment acknowledgement.
- [ ] **P2** `card_zip_sprint_loop_01` — lightweight servos at speed.
- [ ] **P1** Assign and tune rapid close-range weapon sounds.
- [ ] **P1** Approve small-unit destruction treatment.

### Microbit Swarm

- [ ] **P1** `card_swarm_select_01` and `_02` — layered digital chatter.
- [ ] **P1** `card_swarm_deploy_01` and `_02` — multi-unit deployment burst.
- [ ] **P1** `card_swarm_attack_01` and `_02` — clustered rapid attacks.
- [ ] **P1** `card_swarm_destroy_01` and `_02` — layered microbot collapse.

### Titan-0 / BRUTE

- [ ] **P1** `card_brute_select_01` and `_02` — deep armored voice.
- [ ] **P1** `card_brute_deploy_01` and `_02` — heavy landing.
- [ ] **P2** `card_brute_movement_01` and `_02` — armored steps and servos.
- [ ] **P1** Assign heavy rocket launch and impact sounds.
- [ ] **P1** Approve heavy-unit destruction treatment.

### Rail Strider

- [ ] **P1** `card_rail_select_01` and `_02` — target-lock identity.
- [ ] **P1** `card_rail_deploy_01` and `_02` — hydraulic deployment.
- [ ] **P1** `card_rail_charge_01` — siege weapon charge.
- [ ] **P1** `card_rail_fire_01` and `_02` — long-range launch.
- [ ] **P1** `card_rail_impact_01` and `_02` — heavy structure impact.

### Pulse Ranger

- [ ] **P1** `card_pulse_select_01` and `_02` — clean tactical voice.
- [ ] **P1** `card_pulse_deploy_01` and `_02`.
- [ ] **P2** `card_pulse_tracking_01` and `_02` — tracking servo.
- [ ] **P1** `card_pulse_fire_01` and `_02` — distinctive pulse rifle.
- [ ] **P1** `card_pulse_impact_01` and `_02`.

### Arc Crawler

- [ ] **P1** `card_arc_select_01` and `_02` — crackling voice.
- [ ] **P1** `card_arc_deploy_01` and `_02` — electrical boot.
- [ ] **P1** `card_arc_charge_01`.
- [ ] **P1** `card_arc_primary_impact_01` and `_02`.
- [ ] **P1** `card_arc_chain_01` and `_02` — splash discharge.

### Jet Drone

- [ ] **P1** `card_drone_select_01` and `_02` — filtered airborne voice.
- [ ] **P1** `card_drone_deploy_01` and `_02` — liftoff.
- [ ] **P2** `card_drone_hover_loop_01`.
- [ ] **P1** Assign aerial rocket launch and impact sounds.
- [ ] **P1** `card_drone_damaged_loop_01`.
- [ ] **P1** `card_drone_crash_01` and `_02`.

### Patch Bot

- [ ] **P1** `card_patch_select_01` and `_02` — friendly diagnostic voice.
- [ ] **P1** `card_patch_deploy_01` and `_02`.
- [ ] **P1** Assign repair beam start, loop, stop, and completion sounds.
- [ ] **P1** Assign a lighter defensive weapon sound.
- [ ] **P1** Approve small-unit destruction treatment.

### VECTOR-9

- [ ] **P1** `card_vector_select_01`, `_02`, and `_03` — Commander voice set.
- [ ] **P1** `card_vector_deploy_01` and `_02` — authoritative deployment.
- [ ] **P1** `card_vector_weapon_01` and `_02`.
- [ ] **P1** `card_vector_overdrive_start_01`.
- [ ] **P1** `card_vector_overdrive_loop_01`.
- [ ] **P1** `card_vector_overdrive_end_01`.

### AEGIS-4

- [ ] **P1** `card_aegis_select_01` and `_02` — defensive voice.
- [ ] **P1** `card_aegis_deploy_01` and `_02` — heavy deployment.
- [ ] **P1** `card_aegis_barrier_boot_01`.
- [ ] **P1** Assign shield hit variations and shield break.
- [ ] **P1** Assign normal weapon sounds.

### Wraith Coil

- [ ] **P1** `card_wraith_select_01` and `_02` — distorted voice.
- [ ] **P1** `card_wraith_deploy_01` and `_02` — phase deployment.
- [ ] **P1** Assign Phase Step departure and arrival sounds.
- [ ] **P1** `card_wraith_attack_01` and `_02`.
- [ ] **P1** `card_wraith_destroy_01` and `_02` — destabilized destruction.

### Scrap Viper

- [ ] **P1** `card_viper_select_01` and `_02` — aggressive voice.
- [ ] **P1** `card_viper_deploy_01` and `_02`.
- [ ] **P1** `card_viper_attack_01` and `_02`.
- [ ] **P1** Assign Salvage Siphon and self-repair sounds.
- [ ] **P1** Approve small-unit destruction treatment.

## Program card sounds

### EMP Flash

- [ ] **P0** `card_emp_select_01` and `_02`.
- [ ] **P0** `card_emp_target_charge_01`.
- [ ] **P0** `card_emp_detonate_01` and `_02`.
- [ ] **P1** `card_emp_shutdown_01`.
- [ ] **P1** Assign disabled-electronics loop and recovery sounds.

### Nano Cloud

- [ ] **P0** `card_nano_select_01` and `_02`.
- [ ] **P0** `card_nano_release_01`.
- [ ] **P0** `card_nano_cloud_loop_01`.
- [ ] **P1** `card_nano_damage_tick_01`, `_02`, and `_03`.
- [ ] **P0** `card_nano_dissipate_01`.

### Gravity Well

- [ ] **P0** `card_gravity_select_01` and `_02`.
- [ ] **P0** `card_gravity_charge_01`.
- [ ] **P0** `card_gravity_implode_01` and `_02`.
- [ ] **P1** `card_gravity_pull_01`.
- [ ] **P1** `card_gravity_slow_loop_01`.
- [ ] **P0** `card_gravity_collapse_01`.

## Installation card sounds

### Arc Sentry

- [ ] **P0** `card_sentry_select_01` and `_02`.
- [ ] **P0** `card_sentry_place_01`.
- [ ] **P0** `card_sentry_boot_01`.
- [ ] **P1** Assign rotating-servo and target-lock sounds.
- [ ] **P0** Assign sentry burst variations.
- [ ] **P1** `card_sentry_shutdown_01` — lifetime expiration.

### Microbot Foundry

- [ ] **P0** `card_foundry_select_01` and `_02`.
- [ ] **P0** `card_foundry_place_01`.
- [ ] **P0** `card_foundry_start_01`.
- [ ] **P1** `card_foundry_loop_01`.
- [ ] **P0** `card_foundry_spawn_wave_01` and `_02`.
- [ ] **P1** `card_foundry_shutdown_01`.

### Firewall Node

- [ ] **P0** `card_firewall_select_01` and `_02`.
- [ ] **P0** `card_firewall_place_01`.
- [ ] **P0** `card_firewall_expand_01`.
- [ ] **P1** `card_firewall_aura_loop_01`.
- [ ] **P1** Assign protected-hit variations.
- [ ] **P1** `card_firewall_collapse_01`.

## Foundry Microbot sounds

- [ ] **P1** `microbot_spawn_01` and `_02`.
- [ ] **P2** `microbot_movement_01` and `_02`.
- [ ] **P1** `microbot_attack_01` and `_02`.
- [ ] **P1** `microbot_destroy_01` and `_02`.

## Reward and progression sounds

- [ ] **P1** `reward_xp_01`.
- [ ] **P1** `reward_level_up_01`.
- [ ] **P1** `reward_cache_reveal_01`.
- [ ] **P1** `reward_fragment_01`.
- [ ] **P1** `reward_card_unlock_01`.
- [ ] **P1** `reward_mastery_upgrade_01`.
- [ ] **P2** `reward_firmware_capacity_01`.

## Music production checklist

### Existing music

- [x] **P0** `crash-roboto-lobby-entrance.mp3` — app launch and lobby loop.
- [x] **P0** `crash-roboto.mp3` — current main battle loop.
- [ ] Confirm commercial-use rights and retain proof with the release records.
- [ ] Confirm both existing tracks loop cleanly or create loop-safe edits.
- [ ] Create lossless masters for both existing tracks.

### Required music and stingers

- [ ] **P0** `music_deploy_transition` — bridge lobby music into battle.
- [ ] **P0** `music_battle_opening` — short match/round introduction.
- [ ] **P1** `music_opening_stage_loop` — restrained opening-stage energy.
- [ ] **P0** `music_relay_war_loop` — final loop-safe edit of the main battle theme.
- [ ] **P0** `music_core_surge_loop` — high-intensity double-Charge stage.
- [ ] **P0** `music_power_drain_loop` — warning and drain-resolution tension.
- [ ] **P1** `music_relay_destroyed_friendly_sting`.
- [ ] **P1** `music_relay_destroyed_enemy_sting`.
- [ ] **P1** `music_core_critical_layer`.
- [ ] **P1** `music_overdrive_sting`.
- [ ] **P0** `music_round_victory_sting`.
- [ ] **P0** `music_round_defeat_sting`.
- [ ] **P0** `music_match_victory`.
- [ ] **P0** `music_match_defeat`.
- [ ] **P0** `music_match_draw_sting`.

### Music trigger behavior

- [x] Start the lobby playlist on app entry.
- [x] Restart the lobby playlist when returning from a match.
- [x] Start the battle playlist when Deploy Loadout is accepted.
- [x] Stop music when the match finishes.
- [x] Pause music when the game pauses.
- [x] Resume the active track when gameplay resumes.
- [ ] Trigger the deployment transition before the battle loop.
- [ ] Trigger the opening-stage music when a match or round starts.
- [ ] Transition to Relay War music when the opening bonus ends.
- [ ] Transition to Core Surge music when double Charge begins.
- [ ] Duck or replace battle music during Power Drain.
- [ ] Duck music briefly for friendly and enemy Relay-destruction stingers.
- [ ] Add a critical layer when the friendly Core reaches the chosen health threshold.
- [ ] Add an Overdrive musical accent without restarting the battle track.
- [ ] Play round victory/defeat stingers during non-final Best of Three results.
- [ ] Play the correct final victory, defeat, or draw music after battle music stops.
- [ ] Ensure Return to Lobby stops every result or battle layer before restarting lobby music.

## New code hooks required

The current event system already covers match starts, round starts, Power Drain, card selection, successful card play, rejected actions, program casts, Installation placement, Wraith dashes, Overdrive, upgrades, projectiles, destruction, Towers, and match results.

Add dedicated events or state-driven triggers for the following sounds:

- [ ] **P0** Generic projectile and program impact variations; the current `impact` event is silent.
- [ ] **P1** AEGIS shield hit.
- [ ] **P1** AEGIS shield break.
- [ ] **P1** Patch Bot repair start or repair impact.
- [ ] **P1** Scrap Viper lifesteal/self-repair.
- [ ] **P1** Nano Cloud damage tick and field expiration.
- [ ] **P1** EMP disabled-state expiration.
- [ ] **P1** Gravity slow expiration.
- [ ] **P1** Foundry Microbot spawn wave.
- [ ] **P1** Installation lifetime expiration distinct from combat destruction.
- [ ] **P1** Firewall protected-hit feedback.
- [ ] **P1** Sentry target acquisition and rotation.
- [ ] **P1** Friendly Core critical-health threshold.
- [ ] **P0** Opening-to-Relay-War stage transition.
- [ ] **P0** Relay-War-to-Core-Surge stage transition.
- [ ] **P1** Reward, cache, fragment, unlock, and level-up events.

## Integration checklist

- [ ] Add an asset manifest mapping every logical cue to its recorded file variants.
- [ ] Preload or lazily decode the first-use SFX without blocking match launch.
- [ ] Reuse the existing Web Audio context and bus structure.
- [ ] Create a new `AudioBufferSourceNode` for every overlapping one-shot.
- [ ] Randomize repeated variations without immediately repeating the same file.
- [ ] Preserve the current 16-logical-sound concurrency cap.
- [ ] Preserve the two-voice acknowledgement limit.
- [ ] Allow critical match, Tower, and result cues to replace lower-priority audio.
- [ ] Stop or fade looping assets when their entity is destroyed or state expires.
- [ ] Stop all SFX loops and music when the game pauses.
- [ ] Resume only loops and music that were active before pausing.
- [ ] Stop battle music and persistent SFX when a match finishes.
- [ ] Restart lobby music cleanly when returning to the lobby.
- [ ] Make the compact master-mute button silence music and all SFX.
- [ ] Keep individual Music and SFX mute controls in the expanded settings panel.
- [ ] Keep Music and SFX volume preferences independent.

## QA and approval checklist

- [ ] Verify every card selection cue in the lobby.
- [ ] Verify every card selection cue in the battle hand.
- [ ] Verify every Unit and Commander deploy cue.
- [ ] Verify all three Program casts.
- [ ] Verify all three Installation placements and expirations.
- [ ] Verify all Relay and Core weapon packages.
- [ ] Verify player and enemy variants remain distinguishable.
- [ ] Verify rapid attacks do not produce clipping or excessive loudness.
- [ ] Verify overlapping rockets do not cut off critical match cues.
- [ ] Verify loops stop when their source entity is destroyed.
- [ ] Verify shield, healing, lifesteal, and damage-reduction feedback.
- [ ] Verify all destruction causes: projectile, program, decay, and Power Drain.
- [ ] Verify single-round victory, defeat, and draw results.
- [ ] Verify every Best of Three round transition and final result.
- [ ] Verify Opening, Relay War, Core Surge, and Power Drain music transitions.
- [ ] Verify pause/resume with one-shots, persistent loops, and music active.
- [ ] Verify master mute silences every audio source.
- [ ] Verify individual Music and SFX mute controls affect only their channel.
- [ ] Verify stored volume preferences survive reloads.
- [ ] Verify the game remains playable when one or more audio assets fail to load.
- [ ] Test Chrome, Safari, Firefox, desktop, and mobile autoplay behavior.
- [ ] Run a final loudness and headphone-safety review.
- [ ] Confirm commercial rights for every recorded, generated, and musical asset.

## Relevant implementation files

- `src/audio/SoundEngine.ts` — procedural playback engine and audio buses.
- `src/audio/soundDesign.ts` — mapping from game events to logical sound cues.
- `src/audio/MusicEngine.ts` — music playback, pause, stop, and playlist behavior.
- `src/audio/musicCatalog.ts` — bundled lobby and battle music manifests.
- `src/game/core/types.ts` — game event definitions.
- `src/game/core/MatchEngine.ts` — gameplay event emission.
- `src/app/App.tsx` — music phase transitions, mute, volume, and pause behavior.
- `docs/AUDIO.md` — current audio architecture and licensing notes.

