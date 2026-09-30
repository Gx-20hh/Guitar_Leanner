# T12 Boundary: Alternate Endings, Multi-Voice, Grace Notes

Owner: Pi | Depends: T12 core done (expandScore + golden tests pass) | Status: started

## Objective
Add boundary tests for ScorePlaybackAdapter edge cases that are NOT covered by the current 9 golden tests.

## Allowed Files
- frontend/src/score/ScorePlaybackAdapter.test.ts (append tests)
- frontend/src/score/ScorePlaybackAdapter.ts (fix if needed)
- tests/score-fixtures/ (add fixtures if needed)
- docs/validation/t12-boundary.md (new)

## Requirements
1. **Alternate endings (volta)**: 2-bar section with 2 endings. Verify masterBar source sequence = [0,1,0,2] (not [0,1,2,3]).
2. **Multi-voice beat**: two voices in same bar, verify MIDI events are interleaved but identity maps to correct voice per track/voice index.
3. **Triplets**: verify 3-in-2 eighth triplets produce starts at [0,320,640].
4. **Rest beats**: verify no MIDI note events for rests.
5. **Grace note exclusion**: verify grace note MIDI events are excluded from TrainingTarget or marked identityUnresolved.

## Verification
- npm run typecheck passes
- npm test all pass (extended from 69 tests)
- npm run build passes
- Evidence: docs/validation/t12-boundary.md

## Stop
No commit/push. No contracts/ edits. No task board edits.
