# Generated voice and SFX delivery

Source: `/Volumes/colinserver/Documents/SoundGenAPI/output/crash-roboto-audio/audio/delivery-mp3/`

The source delivery imported July 13, 2026 contained:

- `sfx/`: 494 browser-ready MP3 files
- `voice/`: 75 browser-ready MP3 files
- `music/`: intentionally not imported; Crash Roboto keeps its existing higher-quality music

The source package labels all generated assets `needs_review`. Before a commercial release, confirm ownership, generator/model license terms, creative similarity, and commercial-use approval. Runtime mappings live in `src/audio/recordedSoundDesign.ts`; unmapped or unavailable sounds fall back to the procedural `SoundEngine` palette.

The repository intentionally retains only runtime-mapped audio. Voice families keep their three alternate performances; generated non-voice families keep the canonical `v01` take. The bulk manifest describes the source delivery, not the smaller shipped subset.

The files under `sfx/combat/licensed-weapons/` are not part of this generated delivery. Their independently licensed sources and processing notes are documented in that folder's `LICENSES.md`.
