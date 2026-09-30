import { describe, expect, it } from "vitest";
import { model } from "@coderline/alphatab";
import { toIsr } from "./importer";

/**
 * alphaTab 模型构造 Score，测试 toIsr 的弦号映射与直达保序。
 * 依核验公式 ISR stringNumber = stringCount - note.string + 1（1=最高弦）。
 * 数值：tuning 保序 [64,59,55,50,45,40]；高弦 alpha.note.string=6 → ISR 1；低弦 alpha=1 → ISR 6。
 */
function buildScore(): model.Score {
  const score = new model.Score();
  score.title = "GP5 Fixture";
  const track = new model.Track();
  track.name = "Guitar";
  track.ensureStaveCount(1);
  track.staves[0].stringTuning.tunings = [64, 59, 55, 50, 45, 40];
  score.addTrack(track);
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  score.addMasterBar(mb);
  const bar = new model.Bar();
  track.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);

  const b0 = new model.Beat();
  const n0 = new model.Note();
  n0.string = 6; // 最高弦（高 e）
  n0.fret = 0;
  n0.dynamics = model.DynamicValue.F;
  b0.addNote(n0);
  voice.addBeat(b0);

  const b1 = new model.Beat();
  const n1 = new model.Note();
  n1.string = 1; // 最低弦（低 E）
  n1.fret = 0;
  n1.dynamics = model.DynamicValue.MP;
  b1.addNote(n1);
  voice.addBeat(b1);

  return score;
}

describe("toIsr — 弦号映射(1=最高)与保序", () => {
  const isr = toIsr(buildScore());

  it("顶层拍号与单音轨", () => {
    expect(isr.title).toBe("GP5 Fixture");
    expect(isr.masterBars[0].timeSignatureNumerator).toBe(4);
    expect(isr.masterBars[0].timeSignatureDenominator).toBe(4);
    expect(isr.tracks).toHaveLength(1);
  });

  it("调弦保序直达（不按音高排序）", () => {
    expect(isr.tracks[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
    expect(isr.tracks[0].stringCount).toBe(6);
  });

  it("stringNumber：高弦 alpha6 → ISR 1；低弦 alpha1 → ISR 6；duration 数值；dynamics+1", () => {
    const beats = isr.tracks[0].measures[0].voices[0];
    expect(beats).toHaveLength(2);
    const [a, b] = beats;
    expect(a.duration).toBe(4);
    expect(a.notes[0].stringNumber).toBe(1); // 高弦
    expect(a.notes[0].fret).toBe(0);
    expect(a.notes[0].dynamics).toBe(6); // F=5 → +1
    expect(b.notes[0].stringNumber).toBe(6); // 低弦
    expect(b.notes[0].fret).toBe(0);
    expect(b.notes[0].dynamics).toBe(4); // MP=3 → +1
    expect(a.notes[0].midi).toBeTypeOf("number");
  });
});
