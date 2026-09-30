# T8 Dispatch: GE200 Input  
 
Owner: Claude | Depends: T7 done | Status: started 
 
## Objective 
Verify GE200 device input path on Windows: real-time audio callback to raw WAV buffers to RMS meter display. 
 
## Allowed Files 
- native/audio/ (new) 
- native/device/ (new) 
- CMakeLists.txt 
- native/app/main_component 
- contracts/ 
- tests/audio-fixtures/ 
- packaging/ 
 
## Requirements 
1. Native sample clock is single source of truth 
2. No blocking locks/IO/JSON/network in real-time callback 
3. RMS meter using JUCE AudioDeviceManager 
4. Mock sine wave tests first, GE200 later 
5. Write contracts/device-api.md 
 
## Verification 
- cmake build passes 
- rms_meter_tests.exe all pass 
- CTest integration tests pass 
- Evidence: docs/validation/t8-device.md 
 
## Ref 
- docs/project-arrangement-review.md 
- .agents/claude.md 
