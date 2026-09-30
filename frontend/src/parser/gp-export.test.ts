import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { exporter, model } from "@coderline/alphatab";
import { importGpToIsr } from "./importer";

const GP_FIXTURE = resolve(__dirname, "../../../tests/score-fixtures/out.gp");

/**
 * 弦向语义（依核验 getStringTuning=staff.tuning[len-noteString]）：
 * alpha note.string=1 ↔ ISR stringNumber 6（低弦）；note.string=6 ↔ ISR stringNumber 1（高弦）。
 * 即 ISR stringNumber = stringCount - note.string + 1，ISR 1 = 最高音弦。
 */
function buildGp(opts: { capo?: number; tuning?: number[]; tempo?: number; lowFret?: number; highFret?: number } = {}): Uint8Array {
  const g = new model.Score();
  g.title = "GP Fixture";
  const t = new model.Track();
  t.name = "Guitar";
  t.ensureStaveCount(1);
  t.staves[0].stringTuning.tunings = opts.tuning ?? [64, 59, 55, 50, 45, 40];
  t.staves[0].capo = opts.capo ?? 0;
  g.addTrack(t);
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  // 正确的 tempo 自动化（buildTempoAutomation；直接 new Automation 导出后 value 丢失）
  mb.tempoAutomations.push(model.Automation.buildTempoAutomation(false, 0, opts.tempo ?? 120, 0, true));
  g.addMasterBar(mb);
  const bar = new model.Bar();
  t.staves[0].addBar(bar);
  const voice = new model.Voice();
  bar.addVoice(voice);
  // 低弦（string6 → ISR 1）? 不：string=6 → ISR stringNumber 1 = 高弦。
  // 高弦 note.string=6、低弦 note.string=1。
  const low = new model.Beat();
  const l = new model.Note();
  l.string = 1; // 低弦（ISR 6）
  l.fret = opts.lowFret ?? 2;
  low.addNote(l);
  voice.addBeat(low);
  const high = new model.Beat();
  const h = new model.Note();
  h.string = 6; // 高弦（ISR 1）
  h.fret = opts.highFret ?? 3;
  high.addNote(h);
  voice.addBeat(high);
  return new exporter.Gp7Exporter().export(g);
}

function listedNotes(isr: import("./isr").InternalScore) {
  return isr.tracks[0].measures[0].voices.flatMap((voice) => voice.flatMap((b) => b.notes));
}

describe("自产 GP 二进制 roundtrip（独立音乐值、序化断言）", () => {
  it("持久化 out.gp：tempo120 已知；低弦 ISR6 fret2=42，高弦 ISR1 fret3=67（独立于实现）", () => {
    const isr = importGpToIsr(readFileSync(GP_FIXTURE));
    expect(isr.title).toBe("GP Fixture");
    expect(isr.tempo).toBe(120); // 由 buildTempoAutomation 写出的已知 BPM
    expect(isr.masterBars[0].timeSignatureNumerator).toBe(4);
    expect(isr.masterBars[0].timeSignatureDenominator).toBe(4);
    expect(isr.tracks[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
    const notes = listedNotes(isr);
    expect(notes).toHaveLength(2);
    // 序化音乐期望（非 find-only）：按实际导入顺序断言
    const [low, high] = notes;
    expect(low.stringNumber).toBe(6); // 低弦
    expect(low.fret).toBe(2);
    expect(low.midi).toBe(42); // 40 + fre2 + capo0
    expect(high.stringNumber).toBe(1); // 高弦
    expect(high.fret).toBe(3);
    expect(high.midi).toBe(67); // 64 + fret3
  });

  it("capo=2：低弦 fret0→42，高弦 fret0→66（fret=0 明确）", () => {
    const isr = importGpToIsr(buildGp({ capo: 2, lowFret: 0, highFret: 0 }));
    const notes = listedNotes(isr);
    expect(notes.find((n) => n.stringNumber === 6)?.midi).toBe(42); // 40+2
    expect(notes.find((n) => n.stringNumber === 1)?.midi).toBe(66); // 64+2
  });

  it("distinct fret 覆盖：高弦 fr3、低弦 fr2 为不同品且各自独立音高", () => {
    const isr = importGpToIsr(buildGp());
    const notes = listedNotes(isr);
    const high = notes.find((n) => n.stringNumber === 1);
    const low = notes.find((n) => n.stringNumber === 6);
    expect(high?.fret).toBe(3);
    expect(low?.fret).toBe(2);
    expect(high?.fret).not.toBe(low?.fret);
    expect(high?.midi).toBe(67);
    expect(low?.midi).toBe(42);
  });

  it("非单调调弦保序（不按音高排序）", () => {
    const tuning = [40, 64, 50, 55, 59, 45]; // 非单调
    const isr = importGpToIsr(buildGp({ tuning }));
    expect(isr.tracks[0].tuning).toEqual(tuning); // 保原序，不排序
    expect(isr.tracks[0].stringCount).toBe(6);
  });
});
