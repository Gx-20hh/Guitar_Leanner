# T12 Dispatch: ScorePlaybackAdapter Implementation

Owner: Pi | Depends: T11 done | Status: started

## Objective
Implement ScorePlaybackAdapter: single-pass expand via MidiFileGenerator+IMidiFileHandler -> MIDI events + TrainingTarget + score mapping.

## Allowed Files (Pi exclusive write)
- frontend/src/score/ScorePlaybackAdapter.ts (new)
- frontend/src/score/playbackTypes.ts (new)
- frontend/src/score/ScorePlaybackAdapter.test.ts (new)
- tests/score-fixtures/ (new fixtures)
- docs/validation/t12-implementation.md (new)

contracts/score-format.md read-only.

## Requirements
1. Run MidiFileGenerator.generate() once with custom IMidiFileHandler recorder
2. Produce: MidiEvent[], PlaybackOccurrence[], TrainingTarget[]
3. identity resolution (Section 2 of T12 proposal):
   - **precise mapping**: single note per beat+voice, unique key -> (voice,beat,noteIndex) verified
   - **explicit rejection**: unison (same key diff strings), multi-voice same-tick same-key, grace/ornament -> identityUnresolved or excluded; no silent wrong assignment
4. repeats: tickLookup.masterBars linear expansion; each occurrence gets unique occurrenceId, same sourceKey
5. tempo: use MasterBarTickLookupTempoChange.tick/tempo (not Automation.value/ratioPosition)
6. Golden values from proof spike: bar starts [0,3840,7680,11520] for 2-bar 4/4 repeat-2; tempo 120->60@tick960 -> times 0/500/1500ms; timeAt truncation correct
7. DTO: tick/position as decimal string (int64); no browser AudioContext; native sample clock is sole authority
8. Extend tests/score-fixtures/ with real alphaTab-generated GP5 fixtures for repeat, tempo change, alternate endings, ties

## Verification
- npm run typecheck passes
- npm test all pass (include playback tests)
- npm run build passes
- Evidence: docs/validation/t12-implementation.md

## Stop
No commit/push. No contracts/ write. No task board edit.
