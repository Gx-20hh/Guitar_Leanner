/**
 * ScaleDrill：为音阶（major/minor/pentatonic）跨 6 弦生成品格位置。
 * 返回 {string(1=最高音弦), fret, note(midi)} 数组，按 fret 升序、string 升序排序。
 * 纯函数、无组件/无浏览器音频。
 */

export interface ScalePosition {
  string: number;
  fret: number;
  note: number;
}

export const SCALE_DRILL_MAX_FRET = 15;
export const SCALE_TYPES = ["major", "minor", "pentatonic"] as const;

/** 音阶音程（半音，从根音起）。 */
export const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
};

/** 音名 → 音级（C=0 … B=11；支持升/降记法）。未知返回 null。 */
export function noteToPitchClass(root: string): number | null {
  const table: Record<string, number> = {
    C: 0, Cb: 11, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6,
    Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, "B#": 0,
  };
  const value = table[root.trim()];
  return typeof value === "number" ? value : null;
}

/**
 * 生成音阶品格位置。
 * @param root 音名（如 "C"、"A"、"G#"）。
 * @param type 音阶类型（major/minor/pentatonic）。
 * @param tuning 六弦空弦 MIDI（数组长度=弦数；index i → 弦 i+1）。
 * @returns 排序后的位置；未知音名/类型返回 []。
 */
export function scaleDrill(root: string, type: string, tuning: number[]): ScalePosition[] {
  const rootClass = noteToPitchClass(root);
  const intervals = SCALE_INTERVALS[type];
  if (rootClass === null || !intervals) return [];

  const classes = new Set(intervals.map((i) => (rootClass + i) % 12));
  const positions: ScalePosition[] = [];

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex += 1) {
    const open = tuning[stringIndex];
    if (!Number.isFinite(open)) continue;
    const stringNumber = stringIndex + 1;
    for (let fret = 0; fret <= SCALE_DRILL_MAX_FRET; fret += 1) {
      const pitchClass = (open + fret) % 12;
      if (classes.has(pitchClass)) {
        positions.push({ string: stringNumber, fret, note: open + fret });
      }
    }
  }

  positions.sort((a, b) => a.fret - b.fret || a.string - b.string);
  return positions;
}
