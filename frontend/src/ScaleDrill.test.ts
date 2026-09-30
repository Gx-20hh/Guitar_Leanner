import { describe, expect, it } from "vitest";
import { noteToPitchClass, scaleDrill, SCALE_INTERVALS } from "./ScaleDrill";

const STANDARD = [64, 59, 55, 50, 45, 40];

describe("noteToPitchClass", () => {
  it("解析常见音名（含升降）", () => {
    expect(noteToPitchClass("C")).toBe(0);
    expect(noteToPitchClass("A")).toBe(9);
    expect(noteToPitchClass("G#")).toBe(8);
    expect(noteToPitchClass("Bb")).toBe(10);
  });
});

describe("scaleDrill", () => {
  it("未知音名/类型返回空数组", () => {
    expect(scaleDrill("??", "major", STANDARD)).toEqual([]);
    expect(scaleDrill("C", "nope", STANDARD)).toEqual([]);
  });

  it("C major 在标准调弦下产生 6 弦位置且音级在音阶内、排序正确", () => {
    const positions = scaleDrill("C", "major", STANDARD);
    expect(positions.length).toBeGreaterThan(0);
    // 有序：fret 升序，同 fret 时 string 升序
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      expect(curr.fret > prev.fret || (curr.fret === prev.fret && curr.string >= prev.string)).toBe(true);
    }
    const classes = new Set(SCALE_INTERVALS.major);
    for (const p of positions) {
      expect(p.string).toBeGreaterThan(0);
      expect(p.string).toBeLessThanOrEqual(6);
      expect(p.fret).toBeLessThanOrEqual(15);
      expect(classes.has((p.note % 12 + 12) % 12)).toBe(true);
    }
  });

  it("A pentatonic（minor）根音在标准调弦下位置均在音阶音级", () => {
    const positions = scaleDrill("A", "pentatonic", STANDARD);
    expect(positions.length).toBeGreaterThan(0);
    const classes = new Set(SCALE_INTERVALS.pentatonic.map((i) => (9 + i) % 12));
    for (const p of positions) {
      expect(classes.has((p.note % 12 + 12) % 12)).toBe(true);
    }
  });
});
