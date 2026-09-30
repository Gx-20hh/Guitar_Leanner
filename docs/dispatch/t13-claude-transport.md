# T13 Native Accompaniment: TinySoundFont Transport + Cursor Sync

Owner: Claude (native transport/audio) | Depends: T7 (host skeleton), T8 (device), T12 (DTO stable) | Status: started

## Objective
Implement native sample clock-driven playback: TinySoundFont renderer, tempo map, bar/beat cursor emission via bridge events.

## Allowed Files
- native/transport/ (new)
- native/audio/ (extend)
- tests/audio-fixtures/ (transport tests)
- docs/validation/t13-native-transport.md (new)
- contracts/ (read-only: device-api.md, score-format.md)

No frontend/ edits. No contracts/ writes.

## Requirements
1. **Unique native sample clock**: one AudioDeviceManager-based clock; epoch on start/stop. No browser audio.
2. **TinySoundFont integration**: load GM/GS SoundFont; render MIDI events from expandScore DTO (tick->sample via tempo map).
3. **Tempo map**: consume PlaybackMidiEvent[] tempo events; tick->sample conversion via proportional integration per bar.
4. **Cursor events via bridge**: emit barStart/beatTick/noteOn events through guitarBridge event channel; Pi consumes for cursor rendering.
5. **No blocking in audio callback**: render in audio thread; no IO/JSON/network/lock.
6. **Seek/loop/speed**: seek invalidates old detection epoch; loop boundaries; speed ratio multiplies sample offset per tick.

## Verification
- cmake --build build --config Debug passes
- ctest --test-dir build -C Debug: new transport tests pass
- Evidence: docs/validation/t13-native-transport.md

## Stop
No commit/push. No frontend/ contracts/ edits. No task board edits.
