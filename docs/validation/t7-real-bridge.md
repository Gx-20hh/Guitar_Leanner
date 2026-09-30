# T7 Host — Real Bridge Verification Record

Date: 2026-09-30. Owner: Claude (native host). Reviewer: Codex.
Status: **Real GUI WebView2 bridge NOT yet verified.** Runtime verification is blocked by execution policy (no host launched by any attempt). No GE200/hardware claim. This file records actual evidence and separates historical build/test failures from the current state.

## Current state (actionable facts)

- **Host binary builds**: `GuitarLearner.exe` produced successfully after the `resized()` C2662 fix (mutable rectangle; status strip reserved bottom 24 before browser bounds).
- **All four selected CTest executables pass** (independent lead run):
  - `rms_meter_tests`, `device_input_tests`, `guitar_bridge_protocol_tests`, `host_resource_path_tests` → CTest exit 0, all pass (timeout 15, Debug, output-on-failure).
- **Packaged entry HTML matches**: SHA256 of `frontend/dist/index.html` == SHA256 of `build/Debug/ui/index.html` = `B806E9A40B2831E76D3F6164AD4151A84F2E12EEC05EE3374696622388F977A4`.
- **Host source changes for this task** (backed up in `docs/backups/t7-host-20260930/`):
  - `native/app/webview_host.{h,cpp}` — `BridgedBrowser` subclass owns navigation hooks; strict resource-root origin boundary (`https://juce.backend/`, trailing slash excludes sibling-origin prefixes); loads via `getResourceProviderRoot()` (not relative `ui/index.html`); resource provider = `resolveResourcePath` (rejects `//` network-path, `..`, absolute/backslash/colon, `?`/`#`, empty segments, missing resources, non-`/` requests); strict local-content bridge policy; `newWindowAttemptingToLoad` ignores (no popup).

## Historical (NOT current) — resolved during this task

- Earlier `host_resource_path_tests` failed to build on `juce::String::fromUUID` (C2039/C3861). Codex (test-file owner) replaced it with `juce::Uuid().toString()` and rebuilt exit 0. **This is history; the current state is all four tests pass.**

## Unverified — the actual remaining gap

- **No real packaged page load observed**: no render/observation of `GuitarLearner.exe` serving `index.html` from packaged `ui/` without a dev server.
- **No real `guitarBridge` request/reply through WebView2**: ping / bad-version / unknown-command / malformed-request round-trips across the actual WebView2/native bridge have no evidence. Offline unit tests do not satisfy this.
- **Runtime verification attempt was blocked by execution policy**: lead's attempt to `Start-Process` the host (hidden window, loopback-only WebView2 debug routing) was rejected by policy BEFORE execution. No host process was launched by that attempt. Do not retry that route or an equivalent.

## Manual verification checklist (for the user, via a real desktop session)

1. Launch the built host: `D:\临时工作\GU\build\Debug\GuitarLearner.exe` (needs an interactive desktop; WebView2 Runtime is present on this machine).
2. Observe the packaged page: the window should render the local `ui/index.html` bundle (no dev server, no external URL). Confirm title/status strip shows a WebView2-available state (green "WebView2 runtime available").
3. Exercise the real bridge round-trip from the page (requires frontend wiring owned by Pi to call `guitarBridge`):
   - `ping` → expect `{ok:true, payload:{message:"pong from native"}}` with the request's `requestId` echoed.
   - `protocolVersion: 3` (bad version) → expect `E_VERSION_UNSUPPORTED` with requestId echoed.
   - `type: "frobnicate"` (unknown command) → expect `E_UNKNOWN_COMMAND` with requestId echoed.
   - malformed payload / unparseable request → expect `E_BAD_PAYLOAD` / `E_MALFORMED_REQUEST` (requestId null when not safely extractable).
   Record actual request IDs and replies; a browser mock or direct `makePingReply` call does not count as runtime evidence.
4. Exactly the pending tests above (bad-version / unknown / malformed) still require a real bridge session — none has run.

## Stop boundary

- No source edits, no process launch, no CMake/test changes in this documentation step.
- No frontend/ or contracts/ writes (Pi owns frontend and score-format reconciliation).
- No audio input device opened; **no GE200 hardware claim**.
- No commit/push; no task-board mutation. Backups preserved; no recursive cleanup.
