# T12 independent tempo probe

Date: 2026-09-30. Reviewer: Codex. In-memory Node ESM test against installed alphaTab 1.8.4; no application edits.

Construct one 4/4 bar with four quarter notes. Add two master-bar tempo automations using buildTempoAutomation(false, 0, 120, 2) and buildTempoAutomation(false, 0.25, 60, 2). Finish the score, then generate MIDI once using new Settings() and a recording IMidiFileHandler.

Execution exit code: 0.

- Source automations: ratio 0/value 120, ratio 0.25/value 60.
- Recorded tempo events: tick 0/BPM120, tick 960/BPM60.
- The generated master-bar tick lookup contains identical tick/tempo pairs.

Independent expected time integration with PPQ960: tick0 is 0ms, tick960 is 500ms, tick1920 is 1500ms. Queries must not integrate tempo changes later than the queried tick. This arithmetic is the expected assertion, not proof of a production adapter, which is not implemented.

Source inspection at core.mjs buildTempoAutomation shows numeric reference 2 uses multiplier 1; out-of-range numeric reference 0 is also normalized to 2. The previous NaN must not be generalized into a library limitation: the valid construction above produces finite values.
