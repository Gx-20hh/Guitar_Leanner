import { describe, expect, it } from "vitest";
import { midi, model, Settings } from "@coderline/alphatab";

/**
 * T12 证明 spike（测试专用，非成品适配器）。
 * 用已装 MidiFileGenerator + 自定义 IMidiFileHandler 执行确定性播放场景，
 * 断言**独立音乐期望值**（PPQ=960）；不改期望以迁就输出。
 * 反复构造遵循 lead 探针：opening bar isRepeatStart + 第二 bar repeatCount，
 * 两标志在 score.addMasterBar 之前设置。tempo reference 依 core.mjs 506–521（索引乘子表）。
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
  const voice = new model.Voice();
  bar.addVoice(voice);
  quarterBeat(voice, 6);
  quarterBeat(voice, 6);
  return score;
}

/** 两小节 4/4 反复两次：opening bar isRepeatStart；第二 bar repeatCount=2；均在 addMasterBar 前。 */
function scoreRepeatTwoBars(): model.Score {
  const score = new model.Score();
  const track = newTrack(score, "Guitar");
  const mb0 = new model.MasterBar();
  mb0.timeSignatureNumerator = 4;
  mb0.timeSignatureDenominator = 4;
  mb0.isRepeatStart = true; // opening（Lead 探针：flags 在 addMasterBar 前）
  const mb1 = new model.MasterBar();
  mb1.timeSignatureNumerator = 4;
  mb1.timeSignatureDenominator = 4;
  mb1.repeatCount = 2; // 第二 bar 的 repeatCount（总播 2 遍）
  score.addMasterBar(mb0);
  score.addMasterBar(mb1);
  addBar(track);
  addBar(track);
  return score;
}

/** tempo 120 起步，小节内 tick960（ratioPosition 0.25）经 masterbar 自动化变 60。reference=2（乘子 1，core.mjs 506–521）。 */
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

function tieQuarters(voice: model.Voice): void {
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
  n1.isTieDestination = true; // 延音到前音：不重击
  beat1.addNote(n1);
  voice.addBeat(beat1);
}

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
  tieQuarters(voice);
  return score;
}

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
  beat.dots = 1; // 附点：960+480=1440
  const note = new model.Note();
  note.string = 6;
  note.fret = 0;
  beat.addNote(note);
  voice.addBeat(beat);
  return score;
}

function tripletBeat(voice: model.Voice, fret: number): void {
  // 每拍：duration Eighth + tupletNumerator=3 → 一拍=三连音八分（320 tick）
  const beat = new model.Beat();
  beat.duration = model.Duration.Eighth;
  beat.tupletNumerator = 3;
  beat.tupletDenominator = 2; // 三连音 3-in-2 → 一拍 Eighth×(2/3)=320
  const note = new model.Note();
  note.string = 6;
  note.fret = fret;
  beat.addNote(note);
  voice.addBeat(beat);
}

function scoreTripletEighth(): model.Score {
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
  tripletBeat(voice, 1);
  tripletBeat(voice, 2);
  tripletBeat(voice, 3);
  return score;
}

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
  // unison：同音（key 64）在不同弦上
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
  mb0.isRepeatStart = true; // 播放主小节后接反复
  mb1.alternateEndings = 1; // 第一结尾（bit0）
  mb2.alternateEndings = 2; // 第二结尾（bit1）
  mb2.repeatCount = 2; // 结尾组（mb1..mb2）总播 2 遍
  score.addMasterBar(mb0);
  score.addMasterBar(mb1);
  score.addMasterBar(mb2);
  addBar(track);
  addBar(track);
  addBar(track);
  return score;
}

function generate(score: model.Score) {
  const rec = makeRecorder();
  score.finish(new Settings()); // 建立 absoluteStart / 反复组 / 拍级自动化
  const generator = new midi.MidiFileGenerator(score, new Settings(), rec.handler);
  generator.generate();
  return { rec, generator };
}

/** 由 tempo 事件建 tick→ms（集成到 requested tick；首个变化晚于 tick 时只用初始 tempo 并对剩余 span 积分）。 */
function timeAt(tempos: RecordedTempo[], tick: number): number {
  const changes = [...tempos].sort((a, b) => a.tick - b.tick);
  let ms = 0;
  let currentTick = 0;
  let currentTempo = 120;
  for (const change of changes) {
    if (change.tick > tick) break; // 不要积分晚于查询点的变化
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

  it("两小节 4/4 反复两次：start tick 0/3840/7680/11520，源序列 0/1/0/1，occurrence 独立", () => {
    const { generator, rec } = generate(scoreRepeatTwoBars());
    const entries = generator.tickLookup.masterBars;
    const starts = entries.map((entry) => entry.start);
    expect(starts).toEqual([0, 3840, 7680, 11520]);
    // 16 个四分音符（两小节 × 4 × 两遍）
    expect(rec.notes).toHaveLength(16);
    // 源身份：序列 0/1/0/1（第 idx 项对应 source bar）
    const sourceBars = entries.map((entry) => entry.masterBar.index);
    expect(sourceBars).toEqual([0, 1, 0, 1]);
    // occurrence 独立：每次播放为独立条目（各 index 不同）
    const unique = new Set(entries.map((entry) => entry.start));
    expect(unique.size).toBe(4);
  });

  it("tempo 120 起步、tick960 变 60：时刻 0/500/1500ms @ tick 0/960/1920", () => {
    const { rec } = generate(scoreTempo120Then60());
    const at960 = rec.tempos.find((entry) => entry.tick === 960);
    expect(at960).toBeDefined();
    expect(at960?.tempo).toBe(60);
    expect(timeAt(rec.tempos, 0)).toBe(0);
    expect(timeAt(rec.tempos, 960)).toBe(500);
    expect(timeAt(rec.tempos, 1920)).toBe(1500);
  });

  it("timeAt 截断回归：首个变化晚于查询点时不积分晚点变化", () => {
    const lateOnly = [{ tick: 960, tempo: 60 }];
    // 查询 480 < 首个变化 960：只用初始 tempo120 对 0..480 积分 → 250ms
    expect(timeAt(lateOnly, 480)).toBe(250);
    expect(timeAt(lateOnly, 0)).toBe(0);
  });

  it("两个延音连四分：单个起音、持续 1920", () => {
    const { rec } = generate(scoreTieTwoQuarters());
    const tieNotes = rec.notes.filter((note) => note.start === 0);
    expect(tieNotes).toHaveLength(1); // 只一次起音
    expect(tieNotes[0].length).toBe(1920); // 960+960
    expect(rec.notes.filter((note) => note.start === 960)).toHaveLength(0); // 第二拍不再起音
  });

  it("三连音八分：起音 tick 0/320/640", () => {
    const { rec } = generate(scoreTripletEighth());
    const starts = rec.notes.map((note) => note.start);
    expect(starts).toEqual([0, 320, 640]);
  });

  it("附点四分：持续 1440（960+480）", () => {
    const { rec } = generate(scoreDottedQuarter());
    const notes = rec.notes.filter((note) => note.start === 0);
    expect(notes).toHaveLength(1);
    expect(notes[0].length).toBe(1440);
  });

  it("第一/第二结尾：源小节序独立书写 = 实际播放序", () => {
    const expectedSourceOrder = [0, 1, 0, 2]; // 独立期望（生成前书写）
    const { generator } = generate(scoreAlternateEndings());
    const actual = generator.tickLookup.masterBars.map((entry) => entry.masterBar.index);
    expect(actual).toEqual(expectedSourceOrder);
  });

  it("unison 歧义：同拍同 key 不同弦 → 事件 key 非唯一，不得标成功身份", () => {
    const { rec } = generate(scoreUnison());
    const notes = rec.notes.filter((note) => note.start === 0);
    expect(notes).toHaveLength(2);
    // 同 key、同 tick：`addNote.key` 无法区分两根弦（同一拍、相异 string、同音）
    expect(notes[0].key).toBe(64);
    expect(notes[1].key).toBe(64);
    expect(notes[0].key).toBe(notes[1].key);
    // 结论：仅凭 key 不能唯一标识该拍的两音符 → 此类必须 identityUnresolved，绝不标"成功身份"
  });
});
