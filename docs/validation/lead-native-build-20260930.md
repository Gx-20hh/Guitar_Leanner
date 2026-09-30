# Independent native build verification

Date: 2026-09-30. Reviewer: Codex.

## Executed results

- CMake configure using vs2022-x64: exit 0.
- GuitarLearner Debug target: built successfully after Claude corrected the mutable layout rectangle and reserved the status strip before browser bounds.
- Initial host_resource_path_tests build failed because juce::String::fromUUID does not exist in the locked JUCE headers.
- After explicitly taking ownership of that integration-test file, Codex backed it up to docs/backups/host-resource-tests-before-uuid-fix.cpp and replaced the invalid call with juce::Uuid().toString(). No application implementation was changed by Codex.
- Rebuild of host_resource_path_tests: exit 0.
- CTest in build, configuration Debug, output-on-failure, timeout 15, selecting exactly rms_meter_tests, device_input_tests, guitar_bridge_protocol_tests and host_resource_path_tests: exit 0; all four executables passed.
- frontend/dist/index.html and build/Debug/ui/index.html have matching SHA256 B806E9A40B2831E76D3F6164AD4151A84F2E12EEC05EE3374696622388F977A4.

## Limits

- These results prove build/test execution and matching packaged entry HTML, not actual WebView2 page rendering or JavaScript/native request/reply.
- No audio smoke test or GE200 hardware validation was run in this verification.
- MSBuild warns MSB8028 about shared intermediate-directory state. No clean or recursive deletion was performed to suppress it.
- T7 remains started pending actual runtime bridge evidence. No commit or push was performed.

## Parallel work

- Pi saved a revised T12 design proposal, then hit provider TPM rate limits again. No tight retry loop or model change was attempted.
- The proposal still needs review before implementation: note identity ambiguity must fail closed; golden values must remain independent expectations rather than being rewritten to match implementation output. The requested tempo case is BPM120 to BPM60 at tick960, giving 0/500/1500ms at ticks0/960/1920 with PPQ960.
