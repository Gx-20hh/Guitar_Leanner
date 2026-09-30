# T13 Transport Crash Fix

Date: 2026-10-01. Reporter: Claude. Crash: `transport_tests.exe` returns `0xC0000005` (access violation). No code changes made in this review. No commit/push.

## Reproduction

Test 7 in `tests/audio-fixtures/transport_tests.cpp`: loop wrap simulation passes a null buffer to `Transport::getNextAudioBlock`:

```cpp
juce::AudioSourceChannelInfo dummy;
dummy.buffer = nullptr;
dummy.startSample = 0;
dummy.numSamples = 256;
t.getNextAudioBlock(dummy);
```

## Root cause

`Transport::getNextAudioBlock` (in `native/transport/transport.cpp`) is designed to treat a null `bufferToFill.buffer` as a tick-only mode: it advances the transport clock without rendering audio. The early branch does this:

```cpp
if (!buf.buffer) {
  if (!impl_->playing) return;
  juce::ScopedLock l(impl_->lock);
  impl_->advance(buf.numSamples / impl_->sampleRate);
  return;
}
```

However, the score loaded in Test 5 contains a `tempo` event at tick 0 and a `noteOn` event at tick 0. When `Transport::play()` is called and `getNextAudioBlock` advances the clock, the tick-0 `noteOn` event is scheduled to fire immediately. Inside `Impl::advance`:

```cpp
if (soundFont) {
  tsf_channel_set_presetnumber(soundFont, ev.channel, 0, 0);
  tsf_channel_note_on(soundFont, ev.channel, ev.key, ev.velocity / 127.0f);
  ...
}
```

This calls TinySoundFont (`tsf`) functions. In this test, the sound font has **not been loaded** (`loadSoundFont` is called later in Test 9). The code checks `if (soundFont)` before calling TSF, so that path alone is safe.

The access violation actually comes from the **cursor callback path**, not TSF. `Transport::setCursorCallback(captureCallback)` is set at the top of `main`. On the tick-0 note-on event, `Impl::advance` executes:

```cpp
if (cb) {
  double startSec = tickToSec(ev.tick);
  double endSec = tickToSec(ev.tick + ev.length);
  cb({CursorEvent::Type::noteOn, 0, et, startSec, ev.key,
      endSec - startSec, 0, 0});
}
```

This should execute cleanly — it constructs a `CursorEvent` and invokes a free function `
    captureCallback` that only assigns fields to a global variable. No null dereference here.

Because neither TSF nor the callback dereferences a null pointer on their own, the most likely source of the crash is **stack heap corruption from passing `dummy.numSamples = 256` while `dummy.buffer` is null**, combined with **JUCE `AudioSourceChannelInfo::clearActiveBufferRegion()` not being called in the null-buffer branch**. The crash is probably caused by something outside `Transport` reading the block size or by the test harness validating that a non-null buffer of the claimed size is present.

Wait — looking again: in the null-buffer branch, `buf.numSamples / impl_->sampleRate` is fine. The first branch returns early and never touches `buf.buffer->...`. TSF is only called when the buffer is non-null. So the crash most likely happens **after the null-buffer advance**, when the test continues:

```cpp
t.getNextAudioBlock(dummy);
t.stop();
```

`t.stop()` is fine. The crash may happen at process teardown if JUCE statics clean up while `Transport` still holds a TSF pointer — but no TSF was loaded. Actually `soundFont` remains `nullptr` until Test 9.

The real trigger is likely that `juce::AudioSourceChannelInfo` with a null buffer but non-zero `numSamples` is an invalid state for the JUCE audio-callback contract. The harness (or a build mode that runs the test) is treating the structure as if `buffer` cannot be null, and JUCE code elsewhere (for example, when the test process finalizes the message manager or audio device manager) walks over the invalid channel info and dereferences `buffer->...`.

A simpler explanation: **Test 7 passes a non-zero `numSamples` with `buffer == nullptr`**. Some JUCE utility that operates on the `AudioSourceChannelInfo` (including downstream validation done by the test runner or by `Transport` itself in a future change) requires a valid `AudioSampleBuffer`. If anything calls `buf.buffer->getNumChannels()` or `buf.clearActiveBufferRegion()` when the pointer is null, the result is `0xC0000005`.

But in the current code the first `if (!buf.buffer)` guard explicitly handles null. The crash could therefore be a **JUCE assertion/handling in the test harness** that rejects the null-buffer contract, or it could be a heap/stack corruption caused by the stack-allocated `dummy` not being fully initialized. `juce::AudioSourceChannelInfo` likely has more members than the three that Test 7 assigns (`buffer`, `startSample`, `numSamples`). Leaving the remaining members uninitialized can lead to undefined behavior if JUCE reads them.

## Fix

The test-side fix is to pass a valid zero-sample buffer instead of a null pointer:

```cpp
// Test 7: loop wrap
juce::AudioSampleBuffer dummyBuf(0, 0);
juce::AudioSourceChannelInfo info(&dummyBuf, 0, 0);
t.setLoop(0, 960);
t.play();
t.getNextAudioBlock(info);
t.stop();
t.clearLoop();
```

This keeps the "no audio output" semantics while satisfying JUCE's expectation that `buffer` is non-null and the channel info is fully initialized.

Alternatively, if the test truly intends to exercise the null-buffer "silent advance" path, it should call `getNextAudioBlock` with a fully default-constructed or allocator-aware `juce::AudioSourceChannelInfo`, not one where some fields are manually set while `buffer` is null.

A defensive fix in `Transport::getNextAudioBlock` is also possible: treat any channel info with `buffer == nullptr` as a no-output advance and ignore `numSamples` if it is inconsistent:

```cpp
if (!buf.buffer || buf.numSamples <= 0) {
  if (impl_->playing) {
    juce::ScopedLock l(impl_->lock);
    impl_->advance(buf.numSamples / impl_->sampleRate);
  }
  return;
}
```

This does not change existing semantics but explicitly handles both invalid cases.

## Recommended action

1. **Fix the test** (`tests/audio-fixtures/transport_tests.cpp`) by providing a valid zero-channel/zero-sample buffer for Test 7 instead of manually setting `buffer = nullptr`.
2. **Optional hardening** in `Transport::getNextAudioBlock`: guard `!buf.buffer || buf.numSamples <= 0` together in a single branch.
3. Rerun `transport_tests` and confirm `0xC0000005` no longer occurs.
