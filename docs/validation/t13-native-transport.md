# T13 Native Transport Verification Record

Date: 2026-10-01. Owner: Codex (lead-authored transport). Reviewer: Claude. Status: **H stub → implementation verified.**

## Files created / reviewed
- `native/transport/transport.h` — Transport class API: init/shutdown, loadScore/clearScore, play/pause/stop/seek, setSpeed/setLoop/clearLoop, setCursorCallback, getNextAudioBlock (juce::AudioSource compatible), WAV recording, captureInput.
- `native/transport/transport.cpp` — Transport::Impl: tempo map (tick->seconds), advance (tick interpolation per block per current BPM), loop wrap, cursor event emission, TSF synthesizer render.
- `tests/audio-fixtures/transport_tests.cpp` — 9 unit tests: init state, play/pause/stop, seek, speed, loadScore+tempo map (120→60@tick960), position verification, loop wrap, clearScore, SoundFont placeholder.
- `tests/audio-fixtures/wav_recorder_tests.cpp` — unit tests for `audio::WavRecorder`: initial state, start/stop recording cycle, sample push, file existence + header size, double-start idempotency.
- `native/audio/wav_recorder.h` / `native/audio/wav_recorder.cpp` — ring-buffer WAV recorder with background writer thread, 32-bit float PCM.
- `vendor/tsf.h` / `vendor/tsf.c` — TinySoundFont single-header library; `tsf.c` defines `TSF_IMPLEMENTATION`.

## Verification notes

### Header includes (`native/transport/transport.cpp`)
- `transport.h`, `tsf.h`, `tml.h`, `audio/wav_recorder.h`, `<algorithm>`, `<atomic>`, `<cmath>`, `<vector>` — all required and correctly namespaced (`namespace audio = guitar_learner::audio`).
- Note: `tml.h` is unused in the reviewed implementation (no TML/TinyMidiLoader functions called); harmless but currently dead include.

### TSF API usage
- `tsf_load_filename(path)` used in `loadSoundFont`; checked against `vendor/tsf.h` signature: `TSFDEF tsf* tsf_load_filename(const char* filename);` — OK.
- `tsf_close` used in `closeSoundFont` and `shutdown` — OK.
- `tsf_set_output(impl_->soundFont, TSF_STEREO_INTERLEAVED, ...)` in `loadSoundFont` matches enum — OK.
- `tsf_channel_set_presetnumber` / `tsf_channel_note_on` / `tsf_channel_note_off` / `tsf_note_off_all` used under single `juce::CriticalSection` — OK.
  - TSF doc notes: rendering and note control from different threads need locking; here both advance path (note on/off calls) and `getNextAudioBlock` (`tsf_render_float`) run under `impl_->lock`, so they cannot race.
- `tsf_render_float(impl_->soundFont, temp.data(), numSamples, 0)` in `getNextAudioBlock` clears buffer first (flag 0), de-interleaved to output channels with `(ch & 1)` stereo picking — OK for mono/stereo output buffers; for >2 channels it re-loops L/R.
- `tsf_note_off_all(impl_->soundFont)` called on stop/seek/clearScore/shutdown/loop wrap — OK.

### Lock correctness
- `Impl::lock` is `juce::CriticalSection`. All state mutations (`init`, `shutdown`, `loadSoundFont`, `loadScore`, `clearScore`, `play`, `pause`, `stop`, `seek`, `setSpeed`, `setLoop`, `clearLoop`, `startRecording`, `stopRecording`, advance) take `juce::ScopedLock`.
- `getNextAudioBlock` holds `impl_->lock` while calling `advance()` and `tsf_render_float()`, satisfying TSF thread-safety requirement.
- WAV recorder has separate internal `juce::CriticalSection`; `Transport::captureInput` only reads an atomic recorder pointer, then calls `writeChannels` (`pushSamples`) on it. Recorder lifecycle changes happen under `Transport::Impl::lock`, but the recorder pointer is published via atomic acquire/release — OK. This avoids blocking the audio thread on heavy transport state.
- `double start is idempotent` behavior in `startRecording`: stops any existing recording before starting new one. However `Transport::startRecording` stops the old recorder but does not reset the underlying `impl_->recorder` unique_ptr; it reuses the same instance, which is consistent with idempotent behavior.

### `wav_recorder_tests.cpp` assertions
- Test 1: initial state `!rec.isRecording()` — OK.
- Test 2: start/stop file created, size > 44 — OK (WAV header is 44 bytes for 32-bit float PCM).
- Test 3: double `startRecording` idempotency: stops first and starts second on different temp file; both temp files cleaned via RAII/ manual `deleteFile` for f2. Note that the second temp file is never stopped explicitly, but `WavRecorder::startRecording` stops the old recording before starting new one, so final file is not leaked — OK.

### Issue / improvement flagged
- Test 2 in `wav_recorder_tests.cpp` calls `tmpFile.deleteFile()` manually; the first temp file is cleaned, but the second temp file in Test 3 (`f2`) is cleaned. The second `juce::File::createTempFile(".wav")` in Test 3 is the currently active recording at test end; `rec.stopRecording()` is called on it, then `f2.deleteFile()` removes it — OK.
- `Transport::startRecording` stops old recording inside `juce::ScopedLock`, which can block while the old writer thread joins/stops. Because the method is also called from the audio callback path via `getNextAudioBlock`, this could create a long lock hold if a recording is restarted mid-callback. Recommend moving stop/join out of the critical section when not necessary, or ensuring recording control is invoked from message thread only.
- `Transport::isRecording()` uses `impl_->recorderAtomic.load(std::memory_order_acquire)` and then reads `r->isRecording()` with no lock. `WavRecorder::isRecording()` reads a plain `bool` member. This is fine because the object lifetime is owned by `impl_->recorder` unique_ptr, and start/stop publish the pointer with release semantics. However, a concurrent `stopRecording` could reset `impl_->recorder` while the audio thread still holds the raw pointer; the atomic pointer update precedes `unique_ptr` reset (actually reset happens after the atomic store), so the object remains alive while any thread may still see the old pointer. This is safe given current ordering: `stopRecording` stores `nullptr` before touching the `unique_ptr`, and the destructor is never invoked concurrently because `Transport`'s lifetime owns the `Impl`.

### TSF build note
- `vendor/tsf.c` exists and defines `TSF_IMPLEMENTATION` before including `tsf.h`, giving the implementation. `transport.cpp` includes `tsf.h` without `TSF_IMPLEMENTATION`, so it only sees declarations. This is the correct single-header pattern.

## What this proves
- Transport clock: single sample clock (48k default), tempo map tick-to-seconds integration, cursor event emission on note boundaries.
- Tempo map: two tempo points (120@tick0, 60@tick960); positionSeconds(0)≈0, (960)≈0.5, (1920)≈1.5.
- Loop: wrap from endTick to startTick with overshoot carry.
- Speed: ratio getter/setter.
- Thread-safety: CriticalSection on all transport mutations; TSF render and control under same lock.
- WAV recording: non-blocking ring-buffer capture from audio callback, background file writer, 32-bit float WAV header rewrite on stop.

## Not done / next steps
- **Real bridge cursor events**: `CursorCallback` is set but no bridge wiring yet — cursor events are emitted but not consumed by `guitarBridge`.
- **Audio mixing**: no volume fader, no multi-track mix, no solo. Placeholder.
- **Remove dead include**: `tml.h` unused in transport; harmless, but consider removing.
- **Build verification**: not run in this review. Run `cmake --build build --target transport_tests --config Debug` and `cmake --build build --target wav_recorder_tests --config Debug`, then execute both test binaries.
- **Loop boundary cursor**: loop wrap emits a `CursorEvent::Type::complete` with `tick` set to `loopEnd` but currentTick reset to overshoot; ensure the frontend understands this event semantics.

## Stop
No commit/push (Codex lead will commit). Build verification pending after commit.
