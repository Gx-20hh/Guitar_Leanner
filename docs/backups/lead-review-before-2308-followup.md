# T7 / T8 / T11 follow-up review

Date: 2026-09-30. Reviewer: Codex. This record supersedes earlier blanket completion claims; no implementation acceptance is implied by compilation alone.

## Status and evidence

- T7 remains started in the live tsk board. Prior native protocol evidence is 22/22 assertions and 1/1 CTest tests; actual WebView2 request/reply and bundled page loading remain unverified. The historical tasks-after-20260930.json snapshot was backed up and corrected to started with bridge step incomplete; tsk remains the live board.
- T8 and T11 are started in the live board. Claude owns native work; Pi owns frontend work. Neither task is accepted yet.
- Pi first delivery reports 35 passed and 1 skipped. The skipped binary import acceptance test prevents accepting T11. Pi has been sent a correction task through Herdr w11:p1.
- No GE200 capture, dry-input routing or hardware latency acceptance evidence exists in this review.

## T11 review findings

- Installed alphaTab 1.8.4 alphaTab.d.ts documents Note.string as 1 for the lowest string. Current stringCount - alphaStr mapping is off by one.
- Beat.duration is a numeric enum; reading duration.key loses duration information.
- Staff tuning order must be verified from the locked library and real fixtures before applying reverse().
- Synthetic objects repeating mapping assumptions do not validate the library adapter. Require actual alphaTab models, self-created GP5 and GP binaries, expected tuning/capo/pitch/duration assertions, and visible import/track selection/tablature.
- Use the PyGuitarPro distribution for investigating self-created GP5 generation; guitarpro is its import name. This is a proposed unblock route, not a verified dependency installation.

## T8 review findings to resolve

- DeviceInfo.inputChannels is hardcoded to 2; report unknown or query actual channels.
- openDevice passes backend::name as inputDeviceName without selecting the backend and separating the real device name. Default fallback must not silently select another device.
- handleAudioCallback dereferences inputChannelData[0] without checking null channel pointers. Missing input must invalidate stale level data.
- audioDeviceStopped does not clear running state or invalidate level data.
- settings_ is copied without synchronization despite claiming cross-thread snapshot safety; specify message-thread ownership or implement safe publication outside the realtime callback.
- PeakHold allocates a raw array without an owning destructor and assumes 256-sample blocks. Use owned storage prepared off the realtime thread and a verified sample-duration window.
- Sample-clock reset/reopen semantics must be explicit; no claim of monotonic continuity across an unmarked reset.

## T7 follow-up

- Inspect WebViewHost goToURL("ui/index.html") against JUCE resource-provider root API. Verify / maps to index.html and resource containment rejects traversal and sibling-prefix paths.
- Require actual WebView2 ping, unsupported-version, unknown-command and malformed-request evidence; protocol-only CTest is insufficient.
- Review portable WebView2 CMake discovery and Ninja preset paths. Hardcoded local paths and edited caches are not reproducible build configuration.

## Ownership and stop boundary

- Claude is the sole current writer of contracts/ and root CMake files. Pi proposes score-contract corrections in its validation document until the contract write slot is released.
- Agents must back up existing files, report actual commands and exit codes, and stop after the assigned correction package. No autonomous T12/T13 advancement, commit or push.

## Independent follow-up at 22:08

- Both agents were idle when inspected. Claude had stopped after configure, without a completed build/test report. Pi had stopped after repeated provider HTTP 429 TPM-limit failures. Each received one bounded continuation prompt through Herdr.
- Codex ran `npm test` from `D:/GuitarLearner/frontend`: exit 1, eight suites could not load because Vite resolved files to the physical directory while using the junction root. No test cases executed in that run.
- Codex reran `npm test` from `D:/临时工作/GU/frontend`: exit 0, eight suites and 37 tests passed, with no skipped tests. Three tests now parse a generated GP5 binary.
- Passing GP5 tests does not yet validate product semantics: current assertions adopt observed pass-through string numbers/tuning, while the generator reverses conventional tuning order. Require known highest/lowest string pitch and capo expectations independent of observed output before accepting the adapter.
- Pi continuation covers that semantic verification, a generated GP binary, file import, track selection, tablature rendering with browser audio disabled, and an updated evidence document.
- Claude continuation covers remaining JUCE device-selection/channel-mask/state issues, SDK selection failure diagnostics, actual build/test exit codes and a T8 evidence report. GE200 hardware remains unverified.
- T7 actual WebView2 bridge remains pending. No task is promoted to done by this follow-up.

## Independent follow-up at 22:17

- Codex ran CTest in build, Debug, output-on-failure, timeout 12 seconds, selecting rms_meter_tests, device_input_tests and guitar_bridge_protocol_tests. Exit 1: RMS 13 passed / 1 failed; device and bridge test executables passed. These were existing built binaries; rebuilt evidence remains required after corrections.
- The RMS test sequence contains two nonzero values (0.9, 0.2). The first window eviction must produce 0.2; the next produces zero. Claude received the exact boundary correction and a request to execute the edits/build, rather than stop after a plan.
- JUCE source inspection retracts the extra-scan concern: getAvailableDeviceTypes calls scanDevicesIfNeeded. initialiseFromXML preserves preferred rate/buffer defaults but overwrites channel-mask defaults and can select another backend if the requested backend is unknown. The backend/mask concerns remain actionable.
- alphaTab Note.getStringTuning uses staff.tuning[length - noteString]; GP5 readNote sets note.string = length - stringIndex. The standard physical string conversion is therefore length - note.string + 1, with tuning entries kept in their source string order. Do not sort by pitch or infer format-dependent semantics from the reversed-tuning test generator.
- Pi received a bounded correction requiring conventional high/low open-string expectations (64/40, and 66/42 with capo 2), distinct frets, both GP5 and GP, and a persistent GP fixture. Passing prior pass-through assertions is not acceptance of ISR semantics.
- docs/dispatch/t7-host-followup.md prepares the next host-only task, queued until Claude reports the current T8 package; it has not yet been dispatched.

## Independent follow-up at 22:58

- Codex independently ran frontend typecheck, tests and production build from the physical workspace: exit 0; 10 suites, 47 passed, none skipped. The large bundle warning remains. JUCE placeholder warnings in tests are not native bridge evidence.
- Pi corrected conventional string mapping, persistent GP tempo automation, distinct frets and non-monotonic tuning preservation. GP5 capo is supported through PyGuitarPro track.offset; local reader/writer source disproved the earlier limitation and a real capo-2 fixture now verifies MIDI 66/42.
- T11-R2 fixes single-voice beat/rest/chord columns and measure separators. Review still finds multi-voice array-index alignment misleading when durations differ, and the import controls disappear after the first successful load. Pi received T11-R3 scoped to score UI/tests/evidence, not T12.
- Claude remains blocked on an outside-workspace read of D:/temp/GU/native/audio/device_input.cpp. A transient idle status was misleading; the visible permission dialog confirms the block. No permission was approved by Codex. User cancellation of the erroneous request is needed before dispatching a corrected physical-workspace path.
- T8 build evidence and T7 actual WebView2 request/reply remain outstanding. No task was marked done and no commit or push was performed.
