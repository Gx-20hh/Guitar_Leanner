import { describe, expect, it } from "vitest";
import { midi, model, Settings } from "@coderline/alphatab";
import type { InternalScore, IsrTrack, IsrMasterBar, IsrMeasure, IsrBeat, IsrNote } from "../parser/isr.js";
import { expandScore } from "./ScorePlaybackAdapter.js";
import type { PlaybackExpansion } from "./playbackTypes.js";

/* ---- Helper: build ISR from alphaTab Score (for round-trip adapter tests) ---- */

function scoreToIsr(score: model.Score): InternalScore {
  const tracks: IsrTrack[] = [];
  for (const alphaTrack of score.tracks) {
    const staff = alphaTrack.staves[0];
    const tuning: number[] = [];
    for (let i = 0; i < staff.stringTuning.tunings.length; i++) {
      tuning.push(staff.stringTuning.tunings[i]);
    }
    const stringCount = tuning.length;

    const measures: IsrMeasure[] = [];
    for (let bi = 0; bi < staff.bars.length; bi++) {
      const bar = staff.bars[bi];
      const voices: IsrBeat[][] = [];
      for (const voice of bar.voices) {
        const beats: IsrBeat[] = [];
        for (const beat of voice.beats) {
          const notes: IsrNote[] = [];
          for (const note of beat.notes) {
            notes.push({
              stringNumber: stringCount - note.string + 1,
              fret: note.fret,
              midi: note.realValue,
              dynamics: 6,
              techniques: [],
              isTieDestination: note.isTieDestination,
            });
          }
          beats.push({ index: beat.voice.beats.indexOf(beat), duration: durationNumber(beat.duration), dots: (beat as any).dots ?? 0, notes });
        }
        voices.push(beats);
      }
      measures.push({ trackIndex: alphaTrack.index, index: bi, voices });
    }

    tracks.push({
      index: alphaTrack.index,
      name: alphaTrack.name,
      stringCount,
      tuning: [...tuning].reverse(), // ISR tuning: high->low
      capo: staff.capo,
      measures,
    });
  }

  const masterBars: IsrMasterBar[] = [];
  for (const mb of score.masterBars) {
    masterBars.push({
      index: mb.index,
      timeSignatureNumerator: mb.timeSignatureNumerator,
      timeSignatureDenominator: mb.timeSignatureDenominator,
      tempoBpm: score.tempo, isRepeatStart: mb.isRepeatStart ?? false, repeatCount: mb.repeatCount ?? 0, tempoAutomations: ((mb.tempoAutomations??[])as any[]).map((a:any)=>({tick:Math.round(960*4*mb.timeSignatureNumerator/mb.timeSignatureDenominator*(a.ratioPosition??0)),bpm:a.value})),
    });
  }

  return {
    title: score.title,
    subTitle: score.subTitle ?? "",
    artist: score.artist ?? "",
    tempo: score.tempo,
    tracks,
    masterBars,
  };
}

function durationNumber(d: model.Duration): number {
  if (d === model.Duration.Whole) return 1;
  if (d === model.Duration.Half) return 2;
  if (d === model.Duration.Quarter) return 4;
  if (d === model.Duration.Eighth) return 8;
  if (d === model.Duration.Sixteenth) return 16;
  if (d === model.Duration.ThirtySecond) return 32;
  return 4;
}

/* ---- alphaTab Score constructors (same as proof spike) ---- */

function newTrack(score: model.Score, name: string): model.Track {
  const track = new model.Track();
  track.name = name;
  track.ensureStaveCount(1);
  track.staves[0].stringTuning.tunings = [64, 59, 55, 50, 45, 40];
  score.addTrack(track);
  return track;
}

function quarterBeat(voice: model.Voice, string: number): void {
  const beat = new model.Beat();
  beat.duration = model.Duration.Quarter;
  const note = new model.Note();
  note.string = string;
  note.fret = 0;
  beat.addNote(note);
  voice.addBeat(beat);
}

function fillBar4Quarters(bar: model.Bar): void {
  const voice = new model.Voice();
  bar.addVoice(voice);
  quarterBeat(voice, 6);
  quarterBeat(voice, 6);
  quarterBeat(voice, 6);
  quarterBeat(voice, 6);
}

function addBar(track: model.Track): model.Bar {
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  fillBar4Quarters(bar);
  return bar;
}

/** Two quarter notes, one bar. */
function scoreTwoQuarters(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  score.addMasterBar(masterbar);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  quarterBeat(voice, 6);
  quarterBeat(voice, 6);
  return score;
}

/** Two bars 4/4, repeat two times (opening bar isRepeatStart, second bar repeatCount=2). */
function scoreRepeatTwoBars(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb0 = new model.MasterBar();
  mb0.timeSignatureNumerator = 4;
  mb0.timeSignatureDenominator = 4;
  mb0.isRepeatStart = true;
  const mb1 = new model.MasterBar();
  mb1.timeSignatureNumerator = 4;
  mb1.timeSignatureDenominator = 4;
  mb1.repeatCount = 2;
  score.addMasterBar(mb0);
  score.addMasterBar(mb1);
  addBar(track);
  addBar(track);
  return score;
}

/** 120 BPM, tempo automation to 60 at tick 960 (ratioPosition 0.25, reference=2). */
function scoreTempo120Then60(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  masterbar.tempoAutomations.push(
    model.Automation.buildTempoAutomation(false, 0, 120, 2, true),
  );
  masterbar.tempoAutomations.push(
    model.Automation.buildTempoAutomation(false, 0.25, 60, 2, true),
  );
  score.addMasterBar(masterbar);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  quarterBeat(voice, 6);
  quarterBeat(voice, 6);
  return score;
}

/** Two tied quarter notes. */
function scoreTieTwoQuarters(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  score.addMasterBar(masterbar);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  const beat0 = new model.Beat();
  beat0.duration = model.Duration.Quarter;
  const n0 = new model.Note();
  n0.string = 6;
  n0.fret = 0;
  beat0.addNote(n0);
  voice.addBeat(beat0);
  const beat1 = new model.Beat();
  beat1.duration = model.Duration.Quarter;
  const n1 = new model.Note();
  n1.string = 6;
  n1.fret = 0;
  n1.isTieDestination = true;
  beat1.addNote(n1);
  voice.addBeat(beat1);
  return score;
}

/** Unison: two notes with same key on different strings. */
function scoreUnison(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  score.addMasterBar(masterbar);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  const beat = new model.Beat();
  beat.duration = model.Duration.Quarter;
  const n0 = new model.Note();
  n0.string = 6;
  n0.fret = 0; // e4 = 64
  const n1 = new model.Note();
  n1.string = 5;
  n1.fret = 5; // B3(59)+5 = 64
  beat.addNote(n0);
  beat.addNote(n1);
  voice.addBeat(beat);
  return score;
}

/** Dotted quarter: duration 1440. */
function scoreDottedQuarter(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  score.addMasterBar(masterbar);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  const beat = new model.Beat();
  beat.duration = model.Duration.Quarter;
  beat.dots = 1;
  const note = new model.Note();
  note.string = 6;
  note.fret = 0;
  beat.addNote(note);
  voice.addBeat(beat);
  return score;
}

function expandFromScore(score: model.Score): PlaybackExpansion {
  score.finish(new Settings());
  const isr = scoreToIsr(score);
  return expandScore(isr);
}

/* ---- Boundary: local raw-generator recorder (triplet/alternate/grace provenance, not adapter ISR) ---- */

function rawGenerator(score: model.Score): { noteStarts: number[]; noteKeys: number[]; sourceBars: number[] } {
  const notes: { start: number; key: number }[] = [];
  const handler: midi.IMidiFileHandler = {
    addTimeSignature(): void {},
    addRest(): void {},
    addNote(_track: number, start: number, _length: number, key: number, _velocity: number, _channel: number) {
      notes.push({ start, key });
    },
    addControlChange(): void {},
    addProgramChange(): void {},
    addTempo(): void {},
    addNoteBend(): void {},
    addBend(): void {},
    finishTrack(): void {},
    addTickShift(): void {},
  };
  score.finish(new Settings());
  const gen = new midi.MidiFileGenerator(score, new Settings(), handler);
  gen.generate();
  return {
    noteStarts: notes.map((n) => n.start),
    noteKeys: notes.map((n) => n.key),
    sourceBars: gen.tickLookup.masterBars.map((e) => e.masterBar.index),
  };
}

function tripletBeat(voice: model.Voice, fret: number): void {
  const beat = new model.Beat();
  beat.duration = model.Duration.Eighth;
  beat.tupletNumerator = 3;
  beat.tupletDenominator = 2;
  const note = new model.Note();
  note.string = 6;
  note.fret = fret;
  beat.addNote(note);
  voice.addBeat(beat);
}

function scoreTripletEighth(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  score.addMasterBar(mb);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  tripletBeat(voice, 1);
  tripletBeat(voice, 2);
  tripletBeat(voice, 3);
  return score;
}

function scoreRestBeat(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  score.addMasterBar(mb);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  const rest = new model.Beat(); // 无音符 → 休止
  rest.duration = model.Duration.Quarter;
  voice.addBeat(rest);
  return score;
}

function scoreMultiVoice(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  score.addMasterBar(mb);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const v0 = new model.Voice();
  bar.addVoice(v0);
  const v1 = new model.Voice();
  bar.addVoice(v1);
  // v0: string6 fret0 (key64)，v1: string6 fret3 (key67) —— 不同 key，可辨 voice 身份
  const b0 = new model.Beat();
  b0.duration = model.Duration.Quarter;
  const n0 = new model.Note();
  n0.string = 6;
  n0.fret = 0;
  b0.addNote(n0);
  v0.addBeat(b0);
  const b1 = new model.Beat();
  b1.duration = model.Duration.Quarter;
  const n1 = new model.Note();
  n1.string = 6;
  n1.fret = 3;
  b1.addNote(n1);
  v1.addBeat(b1);
  return score;
}

function scoreGrace(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  score.addMasterBar(mb);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  const main = new model.Beat();
  main.duration = model.Duration.Quarter;
  const mainNote = new model.Note();
  mainNote.string = 6;
  mainNote.fret = 0; // key64
  main.addNote(mainNote);
  voice.addBeat(main);
  const grace = new model.Beat();
  grace.duration = model.Duration.Eighth;
  const graceNote = new model.Note();
  graceNote.string = 6;
  graceNote.fret = 5; // key69（与主音不同，便于观察）
  grace.addNote(graceNote);
  voice.addGraceBeat(grace);
  return score;
}

function scoreAlternateEndings(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb0 = new model.MasterBar();
  mb0.timeSignatureNumerator = 4;
  mb0.timeSignatureDenominator = 4;
  const mb1 = new model.MasterBar();
  mb1.timeSignatureNumerator = 4;
  mb1.timeSignatureDenominator = 4;
  const mb2 = new model.MasterBar();
  mb2.timeSignatureNumerator = 4;
  mb2.timeSignatureDenominator = 4;
  mb0.isRepeatStart = true;
  mb1.alternateEndings = 1; // 第一结尾
  mb2.alternateEndings = 2; // 第二结尾
  mb2.repeatCount = 2;
  score.addMasterBar(mb0);
  score.addMasterBar(mb1);
  score.addMasterBar(mb2);
  addBar(track);
  addBar(track);
  addBar(track);
  return score;
}

/* ---- Tests ---- */

describe("ScorePlaybackAdapter: expansion", () => {
  it("two quarter notes: MIDI start ticks 0/960", () => {
    const result = expandFromScore(scoreTwoQuarters());
    const noteOns = result.midiEvents
      .filter((e) => e.type === "noteOn")
      .map((e) => e.tick);
    expect(noteOns).toEqual(["0", "960"]);
  });

  it("repeat two bars: 4 occurrences, start ticks 0/3840/7680/11520", () => {
    const result = expandFromScore(scoreRepeatTwoBars());
    const starts = result.occurrences.map((o) => o.startTick);
    expect(starts).toEqual(["0", "3840", "7680", "11520"]);
    const sourceKeys = result.occurrences.map((o) => o.barSourceKey);
    expect(sourceKeys).toEqual([0, 1, 0, 1]);
    // 16 quarter notes: 2 bars * 4 quarters * 2 repeats
    const noteOns = result.midiEvents.filter((e) => e.type === "noteOn");
    expect(noteOns).toHaveLength(16);
  });

  it("occurrence IDs are unique and sequential", () => {
    const result = expandFromScore(scoreRepeatTwoBars());
    const ids = result.occurrences.map((o) => o.occurrenceId);
    expect(ids).toEqual([0, 1, 2, 3]);
    const unique = new Set(ids);
    expect(unique.size).toBe(4);
  });

  it("tempo 120->60 at tick 960: tempo events correct", () => {
    const result = expandFromScore(scoreTempo120Then60());
    const tempoEvents = result.midiEvents.filter((e) => e.type === "tempo");
    expect(tempoEvents).toHaveLength(2);
    const at0 = tempoEvents.find((e) => e.tick === "0");
    expect(at0?.tempoBpm).toBe(120);
    const at960 = tempoEvents.find((e) => e.tick === "960");
    expect(at960?.tempoBpm).toBe(60);
  });

  it("timeAt: tempo change moments verified via proof spike helper", () => {
    // Re-use timeAt from proof; adapter outputs same tempo data
    const result = expandFromScore(scoreTempo120Then60());
    const tempos = result.midiEvents
      .filter((e) => e.type === "tempo")
      .map((e) => ({ tick: Number(e.tick), tempo: e.tempoBpm! }));

    function timeAt(tick: number): number {
      const changes = tempos.sort((a, b) => a.tick - b.tick);
      let ms = 0;
      let ct = 0;
      let currentTempo = 120;
      for (const c of changes) {
        if (c.tick > tick) break;
        ms += ((c.tick - ct) / 960) * (60000 / currentTempo);
        ct = c.tick;
        currentTempo = c.tempo;
      }
      ms += ((tick - ct) / 960) * (60000 / currentTempo);
      return Math.round(ms);
    }

    expect(timeAt(0)).toBe(0);
    expect(timeAt(960)).toBe(500);
    expect(timeAt(1920)).toBe(1500);
  });

  it("tie: single onset at tick 0, duration 1920, no second onset", () => {
    const result = expandFromScore(scoreTieTwoQuarters());
    const noteOns = result.midiEvents.filter((e) => e.type === "noteOn");
    const tick0Notes = noteOns.filter((e) => e.tick === "0");
    expect(tick0Notes).toHaveLength(1);
    expect(Number(tick0Notes[0].length)).toBe(1920);
    const tick960Notes = noteOns.filter((e) => e.tick === "960");
    expect(tick960Notes).toHaveLength(0);
  });

  it("dotted quarter: single onset, duration 1440", () => {
    const result = expandFromScore(scoreDottedQuarter());
    const noteOns = result.midiEvents.filter((e) => e.type === "noteOn");
    expect(noteOns).toHaveLength(1);
    expect(Number(noteOns[0].length)).toBe(1440);
  });

  it("unison: identityUnresolved for ambiguous same-key-different-string", () => {
    const result = expandFromScore(scoreUnison());
    // Should have 2 MIDI note events with same key
    const noteOns = result.midiEvents.filter((e) => e.type === "noteOn");
    expect(noteOns).toHaveLength(2);
    expect(noteOns[0].key).toBe(64);
    expect(noteOns[1].key).toBe(64);

    // Training targets: should mark as identityUnresolved
    const unresolved = result.targets.filter((t) => t.grading === "identityUnresolved");
    expect(unresolved.length).toBeGreaterThan(0);
    expect(result.unresolvedCount).toBeGreaterThan(0);
  });

  it("single-note targets resolved when unambiguous", () => {
    const result = expandFromScore(scoreTwoQuarters());
    const resolved = result.targets.filter((t) => t.grading === "singleNote");
    expect(resolved.length).toBeGreaterThan(0);
    // Each target should have stringNumber, fret, soundingMidi set
    for (const t of resolved) {
      expect(t.stringNumber).toBeGreaterThan(0);
      expect(t.soundingMidi).toBeGreaterThan(0);
      expect(t.startTick).toBeTruthy();
      expect(t.durationTicks).toBeTruthy();
    }
  });
});

describe("ScorePlaybackAdapter: boundary", () => {
  it("triplet: generator produces starts 0/320/640（adapter ISR 不携带 tuplet，此证明在 generator 层；adapter 缺口见证据）", () => {
    const raw = rawGenerator(scoreTripletEighth());
    expect(raw.noteStarts).toEqual([0, 320, 640]);
  });

  it("alternate endings: generator source sequence 0/1/0/2（adapter ISR 不携带 alternateEndings，此证明在 generator 层）", () => {
    const raw = rawGenerator(scoreAlternateEndings());
    expect(raw.sourceBars).toEqual([0, 1, 0, 2]);
  });

  it("rest beats: no noteOn MIDI events, no targets", () => {
    const result = expandFromScore(scoreRestBeat());
    const noteOns = result.midiEvents.filter((e) => e.type === "noteOn");
    expect(noteOns).toHaveLength(0);
    expect(result.targets).toHaveLength(0);
  });

  it("multi-voice: MIDI interleaved, targets carry voice identity in beatSourceKey[3]", () => {
    const result = expandFromScore(scoreMultiVoice());
    const noteOns = result.midiEvents.filter((e) => e.type === "noteOn");
    // 两 voice 各一音，均在 tick0（interleave 于 0；此处音高不同便于按 key 验证）
    expect(noteOns).toHaveLength(2);
    expect(noteOns.map((e) => e.key).sort()).toEqual([64, 67]);
    const voiceSlots = result.targets.map((t) => t.beatSourceKey[3]);
    expect(voiceSlots).toContain(0);
    expect(voiceSlots).toContain(1);
    for (const t of result.targets) {
      expect(t.grading).toBe("singleNote");
    }
  });

  it("grace note: 当前 adapter 不排除（ISR 无 grace 标记，isr.ts 不在本任务可改范围）→ 锁定当前行为并披露缺口", () => {
    const raw = rawGenerator(scoreGrace());
    expect(raw.noteKeys).toContain(69); // 原始 generator 确有 grace 音（fret5 key69）
    const result = expandFromScore(scoreGrace());
    const targetKeys = result.targets.map((t) => t.soundingMidi);
    expect(targetKeys).toContain(69); // 现状：grace 落入 beats → 被携带为 target（req5 未满足，披露见 docs/validation/t12-boundary.md）
  });
});
