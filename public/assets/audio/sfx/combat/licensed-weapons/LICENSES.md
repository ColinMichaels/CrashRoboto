# Licensed weapon audio

These browser-ready MP3 files replace the generated primary gun, Pulse Ranger laser, Arc Sentry, Relay gun, and matching impact sounds. Character voices and card identity sounds are not derived from these sources.

## SnakeF8 — Snake's Authentic Gun Sounds

- Source: https://f8studios.itch.io/snakes-authentic-gun-sounds
- Author: SnakeF8 / F8 Studios
- Source files: self-recorded 5.56, 7.62×39, and 7.62×54R isolated WAV gunshots and a 5.56 double-tap
- Permission stated by the author: commercial use is allowed and credit is not required
- Used in: `GUN_LIGHT_FIRE`, `GUN_HEAVY_FIRE`, `GUN_SENTRY_BURST`, and `GUN_TOWER_FIRE`

## Kenney — Sci-fi Sounds

- Source: https://kenney.nl/assets/sci-fi-sounds
- Author: Kenney
- License: Creative Commons CC0 1.0 Universal
- Source files: `laserSmall`, `laserLarge`, and `impactMetal` OGG variants
- Used in: `LASER_PULSE_FIRE`, `IMPACT_BALLISTIC`, and `IMPACT_ENERGY`

## Processing

The sources were edited for a dense top-down battle mix using FFmpeg: high/low-pass filtering, light compression and limiting, short fades, duration trimming, and layering for the energy families. Output is stereo 44.1 kHz MP3 at 128 kbps. The shipped set retains one canonical take per non-voice family. No generative audio was used for these replacement files.
