# T12 independent repeat probe

Reviewer: Codex. Date: 2026-09-30. Test-only in-memory Node ESM probe; no application code changes.

Executed against the installed alphaTab 1.8.4 package in the physical frontend directory. A single six-string track contains two 4/4 bars, each with four quarter notes. Set isRepeatStart on the first master bar and repeatCount=2 on the second master bar BEFORE adding them to Score. Then call score.finish(new Settings()) and MidiFileGenerator.generate() once with a recording IMidiFileHandler.

Exit code: 0. Observed master-bar sequence:

| Source bar | Start tick | End tick |
|---|---:|---:|
| 0 | 0 | 3840 |
| 1 | 3840 | 7680 |
| 0 | 7680 | 11520 |
| 1 | 11520 | 15360 |

Observed 16 recorded notes, starting at ticks 0, 960, 1920, 2880, 3840, 4800, 5760, 6720, 7680, 8640, 9600, 10560, 11520, 12480, 13440, 14400. This agrees with independent PPQ960 expectations for two bars played twice.

Source inspection: Score.addMasterBar builds repeat groups at insertion; Score.rebuildRepeatGroups can reconstruct them after edits. Setting repeatCount on the opening bar instead of the closing bar does not encode the intended two-bar repeat.

This probe does not prove full source-note identity, unison disambiguation, alternate endings, ties, timing integration, actual sound or native bridge operation. It is not a complete playback adapter.
