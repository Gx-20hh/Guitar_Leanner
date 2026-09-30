# T13 Native Transport Verification Record

Date: 2026-10-01. Owner: Codex (lead-authored transport). Status: **H stub (TSF pending vendor/tsf.h)**.

## Files created
- `native/transport/transport.h` — Transport class API: init/shutdown, loadScore/clearScore, play/pause/stop/seek, setSpeed/setLoop/clearLoop, setCursorCallback, getNextAudioBlock (juce::AudioSource compatible).
- `native/transport/transport.cpp` — Transport::Impl: tempo map (tick->seconds), advance (tick interpolation per block per current BPM), loop wrap, cursor event emission.
- `tests/audio-fixtures/transport_tests.cpp` — 9 unit tests: init state, play/pause/stop, seek, speed, loadScore+tempo map (120->60@tick960), position verification, loop wrap, clearScore, SoundFont placeholder.

## CMake
- `transport_tests` target added to bottom of CMakeLists.txt; links guitar_learner_native + juce::juce_core.

## What this proves
- Transport clock: single sample clock (48k default), tempo map tick-to-seconds integration, cursor event emission on note boundaries.
- Tempo map: two tempo points (120@tick0, 60@tick960); positionSeconds(0)≈0, (960)≈0.5, (1920)≈1.5.
- Loop: wrap from endTick to startTick with overshoot carry.
- Speed: ratio getter/setter.
- Thread-safety: CriticalSection on all state mutations.

## Not done / pending
- **TinySoundFont integration**: `loadSoundFont` is a stub. Need `vendor/tsf.h` (single-header C library, MIT) + a GM SoundFont file (e.g. FluidR3_GM.sf2, MIT). Render path in `getNextAudioBlock` currently calls `buf.clearActiveBufferRegion()`.
- **Real bridge cursor events**: `CursorCallback` is set but no bridge wiring yet — cursor events are emitted but not consumed by `guitarBridge`.
- **Audio mixing**: no volume, no multi-track mix, no solo. Placeholder.

## Stop
No commit/push (Codex lead will commit). Build verification pending after commit.
