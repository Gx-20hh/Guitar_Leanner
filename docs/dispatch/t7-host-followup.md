# T7 host follow-up (queued, not dispatched)

Owner: Claude after the current T8 correction report. Reviewer: Codex. T7 remains started.

Read AGENTS.md, .agents/claude.md, .codex/PROJECT_LEAD.md, the development framework, contracts/ping-protocol.md and docs/validation/lead-review-20260930-followup.md before implementation.

## Scope

Repair packaged WebView2 page loading and verify actual JavaScript/native request/reply. Existing native protocol tests are necessary but do not validate this boundary.

Allowed writes: native/app/webview_host.*, narrowly necessary root CMake configuration, tests/integration/ host resource tests, docs/validation/t7-real-bridge.md and backups. No frontend writes while Pi owns frontend. Contracts remain unchanged for this task.

## Acceptance

- Use the locked JUCE resource-provider root API rather than an unexplained relative ui/index.html URL. Map the provider root to packaged index.html and serve actual bundled assets with appropriate MIME types.
- Restrict resources to the packaged ui directory. Cover traversal, absolute paths, sibling-prefix escapes, missing resources and malformed paths. Reject untrusted navigation before exposing the native bridge.
- Launch the actual built Windows host and verify a packaged page loads without a development server.
- Exercise ping, unsupported version, unknown command and malformed request through the actual WebView2/native bridge. Record request IDs, replies and actual test/observation evidence. A browser mock or direct call to makePingReply does not satisfy this.
- Preserve the user's device settings. This task does not require opening an audio input device.
- Run native build and relevant CTest checks with full exit codes. Record limitations explicitly. If a GUI observation cannot be performed, submit the working host and verification procedure for Codex; do not claim the UI was verified.

## Stop

Back up existing files before edits. Do not delete user files, commit, push, change models, or start subsequent tasks. Submit for review after the evidence is available.
