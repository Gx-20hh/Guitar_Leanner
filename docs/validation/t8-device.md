# T8 Device Input + RMS — Validation Evidence

Date: 2026-09-30. Owner: Claude (native). Status: unit/CTest verified offline; **hardware gate NOT passed** (no GE200 capture evidence).

## Scope delivered (bounded)

- `native/audio/rms_meter.{h,cpp}` — RMS calc, dBFS conversion, PeakHold (owned `std::vector` storage, window = windowSeconds × sampleRate/blockSize, realtime-callback push with no alloc/lock/IO).
- `native/audio/device_input.{h,cpp}` — AudioDeviceManager wrapper:
  - enumerate with `backend::name` id, per-backend visibility check (JUCE `getAvailableDeviceTypes()` itself calls `scanDevicesIfNeeded`, confirmed 2026-09-30).
  - backend pre-validation before `initialise` (rejects unknown backend, no silent fallback to default type).
  - explicit xml attrs `deviceType/audioInputDeviceName/audioDeviceRate/audioDeviceBufferSize/audioDeviceInChans` (JUCE `initialiseFromXML` overrides setup from xml; missing `audioDeviceInChans` would set `useDefaultInputChannels=true` and ignore the input mask).
  - single native sample clock: per-open epoch (`clockEpoch`), samples accumulate in callback; reopen resets to 0 (explicit, not monotonic across reopen).
  - null/zero input channels invalidate stale levels (rms -inf, peak 0); `audioDeviceStopped`/`closeDevice` clear running + invalidate levels; `getSettings().running` reflects live atomic `running_` (not stale true after stop).
  - real channel count read from device after open (`getActiveInputChannels`); enumerate reports `-1` (unknown) — no device open during enumeration.
- `contracts/device-api.md` — device command/event contract draft (T8 scope only).
- `tests/audio-fixtures/` — `rms_meter_tests.cpp`, `device_input_tests.cpp` (pure-logic, no hardware), `device_input_smoke_tests.cpp` (bounded, constrained).

## Commands and exit codes (documented reproducibility)

Reconfigure (vs2022-x64 preset):
```
cmake --preset vs2022-x64 -S D:/临时工作/GU → CFG:0
```
Build all native targets:
```
cmake --build D:/临时工作/GU/build --config Debug → BUILD:0
```
Targets produced:
- build/Debug/GuitarLearner.exe
- build/Debug/rms_meter_tests.exe
- build/Debug/device_input_tests.exe
- build/Debug/device_input_smoke_tests.exe
- build/Debug/guitar_bridge_protocol_tests.exe

CTest (unit tests, bounded `--timeout 15`):
```
ctest --test-dir D:/临时工作/GU/build -C Debug --output-on-failure --timeout 15 \
  -R "^(rms_meter_tests|device_input_tests|guitar_bridge_protocol_tests)$" → CTEST:0
```
Result: 100% tests passed, 0/3 failed.

Individual test evidence:
- `rms_meter_tests.exe`: passed: 14, failed: 0 (incl. PeakHold dual-boundary eviction: 0.9 evicted first leaving 0.2, then 0.2 evicted → 0; unconfigured PeakHold returns 0 and `isConfigured()==false`; null/constant/sine/dBFS cases).
- `device_input_tests.exe`: passed: 16, failed: 0 (deviceId format & ch=-1 unknown; empty/malformed deviceId fails with lastError; clock advance; null input channel invalidates levels while clock continues; zero input channels invalidates; closeDevice clears running + invalidates; levels stay invalid until real input returns).
- `guitar_bridge_protocol_tests.exe`: passed: 22, failed: 0 (T7 regression, unchanged).

Smoke (constrained hardware, bounded spin ≤2 s on clock-poll):
```
D:/临时工作/GU/build/Debug/device_input_smoke_tests.exe → EXIT:0
```
Output:
```
enumerated 3 input device(s)
  device: DirectSound::主声音捕获驱动程序 (backend=DirectSound, asio=no, ch=-1=unknown)
  device: DirectSound::Line 1 (Virtual Audio Cable) (backend=DirectSound, asio=no, ch=-1=unknown)
  device: DirectSound::麦克风阵列 (适用于数字麦克风的英特尔® 智音技术) (backend=DirectSound, asio=no, ch=-1=unknown)
GE200 NOT present; hardware gate NOT passed (pending real device)
opened: DirectSound::主声音捕获驱动程序 sr=48000 buf=256 chOpen=1 totalCh=1
clock advanced to 256 (epoch 1)
```

## What this proves

- RMS math, dBFS, PeakHold window semantics (real-time-safe path) verified by unit tests.
- Device layer logic: enumeration format, backend/name separation, backend pre-validation (no silent fallback), null/stop invalidation, single sample clock + epoch, real channel read after open — verified by pure-logic tests (no hardware dependency).
- Real open path is reachable on this machine via DirectSound default input (48 kHz/256 open, totalCh=1, clock advances) — **not** evidence of GE200 support.

## Hardware limits (NOT passed)

- **GE200 (MOOER) not present/not tested.** No capture, no dry-input routing, no latency, no ASIO driver verification.
- This machine enumerates DirectSound only (no visible ASIO/WASAPI input). GE200 vendor ASIO driver + real device are required for the M0 hardware gate (framework §3, §12; documents 2026-09-30 review).
- Input dry-signal, per-string separation, device re-plug, sample-rate/buffer negotiation against GE200 are all pending hardware.
- No hardware success claim is made from mocks/synthetic or from this smoke run.

## Known limitations (bounded scope)

- T8 deliberately excludes WAV recording, DSP scoring, latency calibration (T10/T9/T13 scope).
- `configureAudio`/`listDevices` bridge commands are documented in the contract draft but not yet exposed over `guitarBridge` at runtime (bridge wiring is part of T7/T13 host work).
- Backend list on a given machine may be DirectSound/WASAPI/ASIO subsets; openDevice requires `backend::name` exactly as enumerated.

## Files changed (Claude ownership)

- native/audio/rms_meter.{h,cpp}
- native/audio/device_input.{h,cpp}
- contracts/device-api.md
- tests/audio-fixtures/rms_meter_tests.cpp, device_input_tests.cpp, device_input_smoke_tests.cpp
- CMakeLists.txt, CMakePresets.json (source-relative WebView2 package path; pinned 1.0.2739.15; clear FATAL if SDK missing; ninja preset `/build-ninja,/packages` → `${sourceDir}/...`)
- docs/validation/t8-device.md (this file)

Backups: docs/backups/t8-lead-fixes-20260930/ (pre-fix copies of the above).
No commit/push. No frontend/score-contract edits. Task board untouched.

## Ready-for-T7-host-repair assessment

T8 correction package is complete and verified offline. The **remaining M0 blocker is the actual WebView2 request/reply + bundled page load** (T7 host step), which this session has not exercised: host `goToURL("ui/index.html")` and the JUCE resource-provider root mapping are unverified for real WebView2, and there is still no runnable frontend bundle from Pi. Next bounded step should be T7-host repair (host resource root + real ping round-trip), not T9/T10.
