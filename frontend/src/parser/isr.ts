/**
 * Internal Score Representation (ISR) —— 供桥接传输的谱面 DTO 类型。
 *
 * 边界：这是前端侧的 ISR 类型镜像。权威协议归 contracts/score-format.md；
 * 本文件只定义消费/产出 ISR 的类型，不作为跨层公共 DTO 的唯一权威。
 *
 * 弦序：ISR 弦号 = stringCount - alphaNote.string + 1（依核验的 getStringTuning 公式）。
 * 1 = 最高音弦，N = 最低音弦（对齐框架 §5.3）。tuning 保文件弦序（不按音高排序）。
 */

/** 一次发声/单音的谱面音符（ISR 层级）。 */
export interface IsrNote {
  /** 弦号：1 = 最高音弦（= stringCount - alphaNote.string + 1）。 */
  stringNumber: number;
  /** 品位。 */
  fret: number;
  /** 实际发声音高（MIDI）。 */
  midi: number;
  /** 动态力度（alphaTab DynamicValue 数值；1=PPP … 8=FFF）。 */
  dynamics: number;
  /** 技巧标签（如 hammer-on / let-ring / tie …）。 */
  techniques: string[];
  /** 是否延音线目标（tie destination，不要求重新拨弦）。 */
  isTieDestination: boolean;
}

/** 一拍内音符集合。 */
export interface IsrBeat {
  /** 拍内相对序号。 */
  index: number;
  /** 时值：alphaTab Duration 数值枚举（Whole=1, Half=2, Quarter=4, Eighth=8…）。 */
  duration: number;
  /** 附点数（0-2）。 */
  dots?: number;
  /** 本拍音符。 */
  notes: IsrNote[];
}

/** 一个小节（某音轨的一行）。 */
export interface IsrMeasure {
  /** 音轨索引。 */
  trackIndex: number;
  /** 小节索引（横向）。 */
  index: number;
  /** 声部列表；每个声部是一列拍。 */
  voices: IsrBeat[][];
}

/** 音轨。 */
export interface IsrTrack {
  index: number;
  name: string;
  /** 弦数。 */
  stringCount: number;
  /** 调弦：#stringNumber(1=最高音弦) → MIDI 音高；保文件弦序（不按音高排序）。 */
  tuning: number[];
  /** 变调夹品位。 */
  capo: number;
  measures: IsrMeasure[];
}

/** 主小节（跨轨：拍号等）。 */
export interface IsrMasterBar {
  index: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  /** 若存在 tempo automation，该小节的 BPM。 */
  tempoBpm: number | null;
  /** Tempo automation ticks+BPM within bar. Empty = none. */
  tempoAutomations?: {tick:number;bpm:number}[]; isRepeatStart?: boolean; repeatCount?: number;
}

/** 完整 ISR。 */
export interface InternalScore {
  title: string;
  subTitle: string;
  artist: string;
  tempo: number;
  tracks: IsrTrack[];
  masterBars: IsrMasterBar[];
}
