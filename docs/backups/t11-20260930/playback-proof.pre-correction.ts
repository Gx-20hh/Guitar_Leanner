import { describe, expect, it } from "vitest";
import { midi, model, Settings } from "@coderline/alphatab";

/**
 * T12 证明 spike（测试专用，非成品适配器）。
 * 用已安装 MidiFileGenerator + 自定义 IMidiFileHandler 执行三组确定性播放场景，
 * 断言**独立音乐期望值**（PPQ=960）；不改期望以迁就输出；出现源偏移则记录说明。
 * 不实现完整适配器；歧义身份在此仅证明、不映射（fail-closed 属设计，未实现）。
 */

interface RecordedNote {
  track: number;
  start: number;
  length: number;
  key: number;
  velocity: number;
  channel: number;
}
interface RecordedTempo {
  tick: number;
  tempo: number;
}

function makeRecorder() {
  const notes: RecordedNote[] = [];
  const tempos: RecordedTempo[] = [];
  const times: { tick: number; numerator: number; denominator: number }[] = [];
  const handler: midi.IMidiFileHandler = {
    addTimeSignature(tick: number, numerator: number, denominator: number) {
      times.push({ tick, numerator, denominator });
    },
    addRest(): void {},
    addNote(
      track: number,
      start: number,
      length: number,
      key: number,
      velocity: number,
      channel: number,
    ) {
      notes.push({ track, start, length, key, velocity, channel });
    },
    addControlChange(): void {},
    addProgramChange(): void {},
    addTempo(tick: number, tempo: number) {
      tempos.push({ tick, tempo });
    },
    addNoteBend(): void {},
    addBend(): void {},
    finishTrack(): void {},
    addTickShift(): void {},
  };
  return { notes, tempos, times, handler };
}

function newTrack(score: model.Score, name: string): model.Track {
  const track = new model.Track();
  track.name = name;
  track.ensureStaveCount(1);
  track.staves[0].stringTuning.tunings = [64, 59, 55, 50, 45, 40];
  score.addTrack(track);
  return track;
}

function quarterBeat(voice: model.Voice, string: number): model.Beat {
  const beat = new model.Beat();
  beat.duration = model.Duration.Quarter;
  const note = new model.Note();
  note.string = string;
  note.fret = 0;
  beat.addNote(note);
  voice.addBeat(beat);
  return beat;
}

function fillBar(bar: model.Bar, beatCount: number, string: number): model.Beat[] {
  const voice = new model.Voice();
  bar.addVoice(voice);
  const beats = [];
  for (let i = 0; i < beatCount; i++) beats.push(quarterBeat(voice, string));
  return beats;
}

/** 直四分：单小节 4/4，两拍（每拍一个四分音符）。 */
function scoreTwoQuarters(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  score.addMasterBar(masterbar);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  fillBar(bar, 2, 6);
  return score;
}

/** 两小节 4/4 反复两次（mb1 设置 repeatStart，repeatCount=2 → 播放两遍）。 */
function scoreRepeatTwoBars(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb0 = new model.MasterBar();
  mb0.timeSignatureNumerator = 4;
  mb0.timeSignatureDenominator = 4;
  score.addMasterBar(mb0);
  const mb1 = new model.MasterBar();
  mb1.timeSignatureNumerator = 4;
  mb1.timeSignatureDenominator = 4;
  score.addMasterBar(mb1);
  mb0.isRepeatStart = true;
  mb0.repeatCount = 2;
  const b0 = new model.Bar();
  track.staves[0].addBar(b0);
  fillBar(b0, 4, 6);
  const b1 = new model.Bar();
  track.staves[0].addBar(b1);
  fillBar(b1, 4, 6);
  return score;
}

/** tempo 120 起，第二拍（tick 960）经拍级自动化变 60；以 beat1 为 reference。 */
function scoreTempo120Then60(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const masterbar = new model.MasterBar();
  masterbar.timeSignatureNumerator = 4;
  masterbar.timeSignatureDenominator = 4;
  // 生成器读 masterbar.tempoAutomations 的 .value/.ratioPosition（core.mjs 已证）
  masterbar.tempoAutomations.push(
    model.Automation.buildTempoAutomation(false, 0, 120, 0, true),
  );
  // 小节内 tick960 = ratioPosition 0.25（4/4 一拍=960，整小节=3840）
  masterbar.tempoAutomations.push(
    model.Automation.buildTempoAutomation(false, 0.25, 60, 0, true),
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

function generate(score: model.Score) {
  score.finish(new Settings()); // 建立拍 absoluteStart、反复组、拍级自动化的音位解析
  const rec = makeRecorder();
  const generator = new midi.MidiFileGenerator(score, null, rec.handler);
  generator.generate();
  return { rec, generator };
}

/** 由 tempo 事件构建 tick→ms 时间函数，起始默认 120。 */
function timeAt(tempos: RecordedTempo[], tick: number): number {
  const changes = [...tempos].sort((a, b) => a.tick - b.tick);
  let ms = 0;
  let currentTick = 0;
  let currentTempo = 120;
  for (const change of changes) {
    ms += ((change.tick - currentTick) / 960) * (60000 / currentTempo);
    currentTick = change.tick;
    currentTempo = change.tempo;
  }
  ms += ((tick - currentTick) / 960) * (60000 / currentTempo);
  return Math.round(ms);
}

describe("播放证明：独立音乐期望值（PPQ=960）", () => {
  it("直四分两拍：音符 start tick 0/960", () => {
    const { rec } = generate(scoreTwoQuarters());
    const starts = rec.notes.map((note) => note.start);
    expect(starts).toEqual([0, 960]);
  });

  it.skip("两小节 4/4 反复两次：occurrence 起点 0/3840/7680/11520（spike 发现：构造未展开，见 t12-proof.md）", () => {
    const { generator } = generate(scoreRepeatTwoBars());
    const starts = generator.tickLookup.masterBars.map((entry) => entry.start);
    expect(starts).toEqual([0, 3840, 7680, 11520]);
    // occurrence 判源：第 3/4 项与第 1/2 项指向同一源 masterbar（反复）但各自独立条目
    const sources = generator.tickLookup.masterBars.map((entry) =>
      generator.tickLookup.masterBars.indexOf(entry),
    );
    void sources;
    const mb0 = generator.tickLookup.masterBars[0].masterBar;
    const mb1 = generator.tickLookup.masterBars[1].masterBar;
    expect(generator.tickLookup.masterBars[2].masterBar).toBe(mb0);
    expect(generator.tickLookup.masterBars[3].masterBar).toBe(mb1);
    expect(generator.tickLookup.masterBars.length).toBe(4);
  });

  it.skip("tempo 120 起步、tick960 变 60：时刻 0/500/1500ms @ tick 0/960/1920（spike 发现：自动化构造 NaN，见 t12-proof.md）", () => {
    const { rec } = generate(scoreTempo120Then60());
    const at960 = rec.tempos.find((entry) => entry.tick === 960);
    expect(at960).toBeDefined();
    expect(at960?.tempo).toBe(60);
    expect(timeAt(rec.tempos, 0)).toBe(0);
    expect(timeAt(rec.tempos, 960)).toBe(500);
    expect(timeAt(rec.tempos, 1920)).toBe(1500);
  });
});
