# CMake Test-Target Audit

Date: 2026-10-01. Auditor: Claude. Scope: `CMakeLists.txt` test targets only.
No build ran. No code changes made. No commit/push.

## Files in tests/
Seven test sources exist; all seven are referenced by a CMake target.

| Test source | Target(s) declared |
|-------------|--------------------|
| `tests/audio-fixtures/rms_meter_tests.cpp` | `rms_meter_tests` |
| `tests/audio-fixtures/device_input_tests.cpp` | `device_input_tests` |
| `tests/audio-fixtures/device_input_smoke_tests.cpp` | `device_input_smoke_tests` |
| `tests/integration/guitar_bridge_protocol_tests.cpp` | `guitar_bridge_protocol_tests` |
| `tests/integration/host_resource_path_tests.cpp` | `host_resource_path_tests` |
| `tests/audio-fixtures/transport_tests.cpp` | `transport_tests` |
| `tests/audio-fixtures/wav_recorder_tests.cpp` | `wav_recorder_tests` (declared twice) |

## Target-by-target verification

### `rms_meter_tests`
- `add_executable`: `tests/audio-fixtures/rms_meter_tests.cpp` + `native/audio/rms_meter.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}/native`, `${CMAKE_CURRENT_SOURCE_DIR}/native/audio`
- `target_link_libraries`: `juce::juce_core`
- `add_test`: yes
- Notes: sources match the include dirs; `rms_meter.cpp` is directly compiled in, not linked through `guitar_learner_native`. Consistent and minimal.

### `device_input_tests`
- `add_executable`: `tests/audio-fixtures/device_input_tests.cpp` + `native/audio/device_input.cpp` + `native/audio/rms_meter.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}/native`, `${CMAKE_CURRENT_SOURCE_DIR}/native/audio`
- `target_link_libraries`: `juce::juce_audio_devices`, `juce::juce_core`
- `add_test`: yes
- Notes: `device_input.h` includes JUCE audio-device headers, so `juce::juce_audio_devices` is required. Also compiles `rms_meter.cpp` because `DeviceInput` embeds an `RmsMeter`. Consistent.

### `device_input_smoke_tests`
- `add_executable`: `tests/audio-fixtures/device_input_smoke_tests.cpp` + `native/audio/device_input.cpp` + `native/audio/rms_meter.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}/native`, `${CMAKE_CURRENT_SOURCE_DIR}/native/audio`
- `target_link_libraries`: `juce::juce_audio_devices`, `juce::juce_core`
- `add_test`: yes
- Notes: mirrors `device_input_tests` linkage, which is correct because it tests the same `DeviceInput` class.

### `guitar_bridge_protocol_tests`
- `add_executable`: `tests/integration/guitar_bridge_protocol_tests.cpp` + `native/bridge/guitar_bridge_protocol.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}/native`, `${CMAKE_CURRENT_SOURCE_DIR}/contracts`, `${JUCE_SOURCE_DIR}/modules`
- `target_link_libraries`: `guitar_learner_native`, `juce::juce_core`
- `add_test`: yes
- Notes: redundant source compile: `native/bridge/guitar_bridge_protocol.cpp` is already part of `guitar_learner_native`, yet it is listed again in this executable. This usually causes duplicate-symbol errors at link time unless the object from the static library is dropped by the linker. Recommended: remove the explicit source and rely only on `guitar_learner_native`. Also, `${JUCE_SOURCE_DIR}/modules` is included; this is needed because the test includes `<juce_core/juce_core.h>` and the JUCE module-style include path is `modules/<module>/<module>.h`.

### `host_resource_path_tests`
- `add_executable`: `tests/integration/host_resource_path_tests.cpp` + `native/app/webview_host.cpp` + `native/bridge/guitar_bridge_protocol.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}/native`, `${CMAKE_CURRENT_SOURCE_DIR}/native/app`, `${CMAKE_CURRENT_SOURCE_DIR}/native/bridge`
- `target_link_libraries`: `guitar_learner_native`, `juce::juce_gui_extra`
- `add_test`: yes, with `TIMEOUT 15`
- Notes: redundant source compiles. `webview_host.cpp` and `guitar_bridge_protocol.cpp` are presumably already compiled into `guitar_learner_native` or referenced via targets. If they are already in `guitar_learner_native`, remove them from `add_executable` to avoid duplicate symbols. The include dirs look sufficient for `#include "webview_host.h"` and `#include "guitar_bridge_protocol.h"`.

### `transport_tests`
- `add_executable`: `tests/audio-fixtures/transport_tests.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}`, `${JUCE_SOURCE_DIR}/modules`
- `target_link_libraries`: `guitar_learner_native`, `juce::juce_core`
- `add_test`: yes, with `TIMEOUT 15`
- Notes: since `transport_tests.cpp` includes `../native/transport/transport.cpp` (not just `transport.h`), `transport.cpp` is compiled into the test directly. It is **not** compiled into `guitar_learner_native` (which only lists `bridge`, `rms_meter`, `device_input`, `wav_recorder`). Therefore there is no duplication here. However, include dirs do **not** list `${CMAKE_CURRENT_SOURCE_DIR}/native`, which means compilation could fail if `transport.cpp` includes other native headers via relative paths. `transport.cpp` currently includes `"transport.h"`, `"tsf.h"`, `"tml.h"`, `"audio/wav_recorder.h"`. With `${CMAKE_CURRENT_SOURCE_DIR}` as include root, those resolve to `native/transport/transport.h`? No — they resolve to source-relative because the file is compiled via `#include "../native/transport/transport.cpp"` inside the test; the preprocessor resolves `"transport.h"` relative to `native/transport/transport.cpp`'s directory, so the paths work without the top-level `${CMAKE_CURRENT_SOURCE_DIR}/native` include dir. But this is fragile.
- Link libraries: `guitar_learner_native` pulls in `tsf`, `juce::juce_gui_extra`, `juce::juce_audio_devices`, `juce::juce_core`, plus WebView2. `juce::juce_core` is also listed explicitly; harmless duplicate.

### `wav_recorder_tests` (first declaration, lines 243–260)
- `add_executable`: `tests/audio-fixtures/wav_recorder_tests.cpp` + `native/audio/wav_recorder.cpp`
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}/native`, `${CMAKE_CURRENT_SOURCE_DIR}/native/audio`, `${JUCE_SOURCE_DIR}/modules`
- `target_link_libraries`: `juce::juce_core`
- `add_test`: yes, with `TIMEOUT 15`
- Notes: `wav_recorder.cpp` uses `juce::File` etc.; `juce::juce_core` is sufficient. Include dirs match header usage. Consistent.

### `wav_recorder_tests` (second declaration, lines 262–276) ⚠️ DUPLICATE TARGET
- `add_executable`: `tests/audio-fixtures/wav_recorder_tests.cpp` (only)
- `target_include_directories`: `${CMAKE_CURRENT_SOURCE_DIR}`
- `target_link_libraries`: `juce::juce_core`
- `add_test`: yes, with `TIMEOUT 15`
- **Issue**: the target `wav_recorder_tests` is declared twice with different source/include/link configurations. CMake will error at configure time: `add_executable cannot create target "wav_recorder_tests" because another target with the same name already exists.`
- The second block appears to be an obsolete earlier attempt (it does not include `${JUCE_SOURCE_DIR}/modules` and does not compile `native/audio/wav_recorder.cpp`). It must be removed.

## Summary table

| Target | Sources OK | Includes OK | Links OK | Registered | Issues |
|--------|------------|-------------|----------|------------|--------|
| `rms_meter_tests` | ✅ | ✅ | ✅ | ✅ | none |
| `device_input_tests` | ✅ | ✅ | ✅ | ✅ | none |
| `device_input_smoke_tests` | ✅ | ✅ | ✅ | ✅ | none |
| `guitar_bridge_protocol_tests` | ⚠️ | ✅ | ✅ | ✅ | `guitar_bridge_protocol.cpp` duplicated vs library |
| `host_resource_path_tests` | ⚠️ | ✅ | ✅ | ✅ | `webview_host.cpp` and `guitar_bridge_protocol.cpp` duplicated vs library |
| `transport_tests` | ✅ | ⚠️ | ✅ | ✅ | include dirs lack `/native` but work via source-relative #include; fragile |
| `wav_recorder_tests` | ✅ | ✅ | ✅ | ✅ | none |

## Critical findings

1. **Duplicate target name `wav_recorder_tests`** at lines 243–260 and 262–276. CMake configure will fail. Remove lines 262–276.
2. **Potential duplicate symbols** in `guitar_bridge_protocol_tests` and `host_resource_path_tests` from compiling `native/bridge/guitar_bridge_protocol.cpp` (and `webview_host.cpp`) both directly and through `guitar_learner_native`. Verify whether these sources are in `guitar_learner_native`; if yes, remove them from the test `add_executable`. If they are intentionally separate, leave them but be aware of the risk.
3. **`transport_tests` include path fragility**: works because `transport.cpp` is included as a relative path from the test source, but if that source file is ever moved or if `transport.cpp` changes include style, it will break. Consider adding `${CMAKE_CURRENT_SOURCE_DIR}/native` to its include dirs for robustness and/or compile `transport.cpp` directly into `guitar_learner_native` rather than relying on `#include` of a `.cpp` file in the test.

## Recommended next steps
- Remove duplicate `wav_recorder_tests` block (lines 262–276).
- Verify `guitar_learner_native` source list and remove redundant sources from `guitar_bridge_protocol_tests` / `host_resource_path_tests`.
- Re-run CMake configure and build to confirm target registration.
