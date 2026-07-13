# Crash Roboto audio

## Shipped playback

The app has two independent audio channels:

- `SoundEngine` generates original card-specific robot acknowledgements and combat effects through Web Audio. Its mute and level are stored as `crash-roboto-sfx-muted` and `crash-roboto-sfx-volume`.
- `MusicEngine` streams the local playlist through one `HTMLAudioElement`. Its mute and level are stored separately as `crash-roboto-music-muted` and `crash-roboto-music-volume`.

The bundled playlist is declared in `src/audio/musicCatalog.ts`. Music URLs must use `import.meta.env.BASE_URL`; the deployed app uses a relative Vite base for GitHub Pages. The music console can also load several local audio files as a session-only playlist. Object URLs are released when the playlist is replaced or the app closes, so local files are never uploaded or persisted.

The initial theme is `public/assets/audio/music/crash-roboto.mp3` with its embedded cover extracted to `crash-roboto-cover.jpg`. A valid **Deploy Loadout** gesture starts playback whenever music is unmuted; unmuting during a match starts it then. The explicit play control is also available, satisfying normal browser autoplay restrictions. A one-track playlist loops; a multi-track playlist advances and wraps.

Music and SFX levels are independently adjustable from the signal mixer. New players start at 50% on both channels; valid stored preferences—including intentional 0%—are preserved. Muting never changes either saved level, so players can set safe levels while a channel remains muted.

## Procedural SFX palette

`src/audio/soundDesign.ts` defines an exhaustive voice profile for all 18 cards. Each profile has its own base pitch, formant, rhythm, grit, and pitch glide. Card selection produces a short identity acknowledgement; successful player unit/Commander placement produces a longer three- or four-syllable modem-grunt. Programs and Installations use their own cast/deploy signature so placement never doubles the acknowledgement.

The palette is original and nonverbal—it evokes chunky robot chatter without reproducing Warcraft recordings, dialogue, or character voices. Shared combat families include high-passed gun snaps, rocket thrust plus travel-timed impacts, throttled flame noise, small robot bursts, Installation collapses, relay/core blasts, and rising/falling result signals.

The mixer counts logical sounds rather than individual oscillators. It limits concurrent acknowledgements to two, throttles rapid weapons, and lets critical start/tower/result cues replace older lower-priority sounds. UI, voice, combat, and critical buses feed a shared SFX master and dynamics compressor; music remains independent.

## Why Suno playlist URLs are not loaded directly

Decision checked July 12, 2026:

- Suno has a public single-song embed URL, but playlist pages block third-party framing. Suno documents playlists as shareable links, not embeddable players: [playlist release notes](https://suno.com/release-notes/playlists).
- Suno has announced only a curated developer-API exploration, not a public self-service playlist API: [official API intake](https://sunomusic.typeform.com/apiform).
- A cross-origin embed would not let the game reliably control playback, share mute state, advance tracks, or inspect errors. Browser audible autoplay also remains gesture-gated: [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
- Unofficial APIs or scraping are not an acceptable dependency under Suno's current [Terms](https://suno.com/terms).

The supported workflow is therefore: download owned Suno songs, add release tracks to the app-owned manifest, or select several exports with **Load Playlist** for a temporary local session. Suno documents multi-song downloads in its [download guide](https://help.suno.com/en/articles/2409921).

## Release-rights check

The supplied MP3 identifies the song and artist but does not record the Suno plan under which it was created. Before a commercial release, confirm that it was generated while the creator had a Pro or Premier subscription and that all supplied lyrics/inputs were owned. Suno says qualifying paid-plan songs may be used in video games, while free-plan generations are noncommercial and a later subscription does not apply retroactively: [commercial-use guidance](https://help.suno.com/en/articles/9601665), [license timing](https://help.suno.com/en/articles/2410177).

## Adding recorded one-shots later

No recorded one-shot files are currently present, so the procedural palette is the complete fallback. When designed or recorded samples arrive:

1. Put normalized, tightly trimmed assets under `public/assets/audio/sfx/`.
2. Decode them into `AudioBuffer`s through the existing Web Audio context.
3. Create a fresh `AudioBufferSourceNode` per event so rapid projectiles can overlap.
4. Replace one family at a time: card voices, bullet/rocket/flame, program casts, destruction, then match cues.
5. Preserve the current 16-logical-sound priority cap and procedural fallback for missing or failed samples.

Music and SFX must continue using separate mute preferences throughout that migration.
