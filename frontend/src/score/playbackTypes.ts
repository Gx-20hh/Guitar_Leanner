/**
 * Playback DTO types for ScorePlaybackAdapter.
 * Tick/position values are decimal strings (int64 safe).
 * No browser audio; native sample clock is the sole time authority.
 */

/** A MIDI event emitted by MidiFileGenerator via IMidiFileHandler. */
export interface PlaybackMidiEvent {
  /** Tick position as decimal string. */
  tick: string;
  type: "noteOn" | "noteOff" | "tempo" | "timeSig" | "controlChange" | "programChange";
  channel: number;
  key: number;
  velocity: number;
  /** For note events: duration in ticks. */
  length: string | null;
  /** For tempo events: BPM. */
  tempoBpm: number | null;
  /** For time sig events. */
  timeSigNumerator: number | null;
  timeSigDenominator: number | null;
  /** Occurrence identity when resolved. */
  occurrenceId: number | null;
}

/** One playback occurrence of a bar (from tickLookup.masterBars linear expansion). */
export interface PlaybackOccurrence {
  /** Global linear auto-increment id (tickLookup.masterBars order). */
  occurrenceId: number;
  /** Stable source bar index (not expanded). */
  barSourceKey: number;
  /** Start tick as decimal string. */
  startTick: string;
  /** Tempo at this occurrence start (BPM, null if unknown). */
  tempoBpm: number | null;
}

/** One beat within a playback occurrence. */
export interface PlaybackBeat {
  occurrenceId: number;
  /** Stable source key: (trackIndex, staffIndex, barIndex, voiceIndex, beatIndex). */
  beatSourceKey: number[];
  /** Start tick as decimal string. */
  tick: string;
  /** Duration in ticks as decimal string. */
  duration: string;
}

/** Training/evaluation target for one note. */
export interface TrainingTarget {
  id: string;
  occurrenceId: number;
  beatSourceKey: number[];
  noteSourceKey: number[];
  /** ISR string number (1 = highest). */
  stringNumber: number;
  fret: number;
  /** Sounding MIDI (includes capo). */
  soundingMidi: number;
  startTick: string;
  durationTicks: string;
  techniques: string[];
  /** Grading disposition. */
  grading: "singleNote" | "excluded" | "identityUnresolved";
  /** Reason when not singleNote. */
  exclusionReason?: string;
}

/** Result of expanding a score for playback. */
export interface PlaybackExpansion {
  midiEvents: PlaybackMidiEvent[];
  occurrences: PlaybackOccurrence[];
  targets: TrainingTarget[];
  /** Notes that could not be uniquely identified. */
  unresolvedCount: number;
}
