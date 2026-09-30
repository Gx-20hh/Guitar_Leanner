import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importGpToIsr } from "./importer";

const FIXTURE = resolve(__dirname, "../../../tests/score-fixtures/out.gp5");

/**
 * 真实 GP5 roundtrip（不跳过）。out.gp5 由 PyGuitarPro 生成（gen_fixtures.py）：
 * 约定标准调弦 string1=64(高e)…string6=40(低E)；track.offset=2（capo=2，PyGuitarPro
 * 以 track.offset 表示 capo，见 GP5File.writeTrack）；两音皆 fret0。
 * 独立音乐值（含 capo）：高弦(ISR1) fret0 → 64+2 = 66；低弦(ISR6) fret0 → 40+2 = 42。
 * ISR stringNumber = stringCount - note.string + 1（1=最高弦）。
 */
describe("真实 GP5 二进制谱例 → ISR（独立音乐值 + capo）", () => {
  const bytes = readFileSync(FIXTURE);
  const isr = importGpToIsr(bytes);

  it("结构：标题/速度/四四拍/单音轨/保序调弦", () => {
    expect(isr.title).toBe("GP5 Fixture");
    expect(isr.tempo).toBe(120);
    expect(isr.masterBars[0].timeSignatureNumerator).toBe(4);
    expect(isr.masterBars[0].timeSignatureDenominator).toBe(4);
    expect(isr.tracks).toHaveLength(1);
    expect(isr.tracks[0].name).toBe("Guitar");
    expect(isr.tracks[0].stringCount).toBe(6);
    expect(isr.tracks[0].tuning).toEqual([64, 59, 55, 50, 45, 40]); // 保序，不按音高排序
    expect(isr.tracks[0].capo).toBe(2); // track.offset=2 → capo2 (αTab 实测)
  });

  it("独立音乐值：高弦(ISR1) fret0=66；低弦(ISR6) fret0=42；duration 数值", () => {
    const notes = isr.tracks[0].measures[0].voices.flatMap((voice) => voice.flatMap((b) => b.notes));
    expect(notes).toHaveLength(2);
    const high = notes.find((n) => n.stringNumber === 1);
    const low = notes.find((n) => n.stringNumber === 6);
    expect(high).toBeDefined();
    expect(low).toBeDefined();
    expect(high!.fret).toBe(0);
    expect(high!.midi).toBe(66); // 64 + capo2
    expect(low!.fret).toBe(0);
    expect(low!.midi).toBe(42); // 40 + capo2
    const beat = isr.tracks[0].measures[0].voices[0][0];
    expect(beat.duration).toBe(4);
  });
});
