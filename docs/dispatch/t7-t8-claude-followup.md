# T7/T8 Follow-up: Real Bridge Remaining & Device Status

Owner: Claude | Depends: T7 started, T8 started | Status: follow-up

## T7 Remaining
Build passes. 4 CTest suites pass. Real WebView2 bridge NOT verified:
- No real packaged page load observed through WebView2
- No real guitarBridge request/reply (ping, bad-version, unknown-command, malformed) round-trips
- Runtime blocked by execution policy for automated launch

**Do NOT attempt Start-Process or any bypass.**

## T8 Complete (offline)
RMS math, dBFS, peak-hold, device enumeration, open/clock validated.
GE200 NOT present; hardware gate NOT passed.

## Action
1. Verify host binary still builds: cmake --build build --config Debug
2. Verify 4 CTest suites still pass: ctest --test-dir build -C Debug
3. Verify entry HTML SHA256 matches frontend/dist/index.html
4. Update docs/validation/t7-real-bridge.md: mark current state
5. No process launch, no Start-Process, no bypass.

## Stop
No commit/push. No frontend/ contracts/ edits.
