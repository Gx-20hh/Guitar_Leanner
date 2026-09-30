/**
 * GP5/GP 导入 → Internal Score Representation (ISR)。
 *
 * 解析引擎：alphaTab（锁定 1.8.4，框架 §4.1 选用）。本模块负责：
 * 1. 用 alphaTab 解析 GP5/GP 字节，得到 alphaTab Score 模型。
 * 2. 把 Score 映射为桥接安全、不暴露 alphaTab 可变对象的 ISR（toIsr）。
 *
 * 只导入 alphaTab 可观测只读模型并产出稳定 DTO；不把 alphaTab 类结构作为跨层公共协议（框架 §11）。
 */
import { importer, model } from "@coderline/alphatab";
import type {
  InternalScore,
  IsrBeat,
  IsrMasterBar,
  IsrMeasure,
  IsrNote,
  IsrTrack,
} from "./isr";

/** 解析失败（格式不支持或数据损坏、超限）。 */
export class ScoreImportError extends Error {
  constructor(
    message: string,
    readonly kind: "unsupported" | "parse" = "parse",
  ) {
    super(message);
    this.name = "ScoreImportError";
  }
}

/** 识别 GP 版本字符串，用于 pre-check 与错误信息（非权威，以 alphaTab 解析为准）。 */
export function detectGpVersion(bytes: Uint8Array): { gp: "gp5" | "other" | "unknown"; detected: boolean } {
  const head = new TextDecoder().decode(bytes.subarray(0, 64));
  if (head.includes("FICHIER GUITAR PRO v5")) {
    return { gp: "gp5", detected: true };
  }
  if (head.startsWith("FICHIER GUITAR PRO") || head.includes("Guitar Pro")) {
    return { gp: "other", detected: true };
  }
  return { gp: "unknown", detected: false };
}

/**
 * 用 alphaTab 解析 GP5/GP 字节并得到 alphaTab Score。
 * 非 GP 输入（如乱数据）会解析失败 → 抛 ScoreImportError；不会伪造 ISR。
 */
export function parseWithAlphaTab(bytes: Uint8Array): model.Score {
  try {
    const score = importer.ScoreLoader.loadScoreFromBytes(bytes);
    if (!score) {
      throw new ScoreImportError("解析为空：无法识别的谱面格式");
    }
    return score;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const kind = /UnsupportedFormat|unsupported/i.test(msg) ? "unsupported" : "parse";
    throw new ScoreImportError(`alphaTab 解析失败：${msg}`, kind);
  }
}

/**
 * 把 alphaTab 动态力度枚举映射为数值档（1=PPP … 8=FFF）。
 * alphaTab DynamicValue 为数值枚举（PPP=0 … FFF=7），故 数值+1 即力度档；
 * 非有限数字未知值默认 5(MF)。
 */
function dynamicValueToNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5;
  return Math.min(8, Math.max(1, Math.round(value) + 1));
}

/**
 * alphaTab Note → IsrNote。
 * 依核验源码：getStringTuning=staff.tuning[staff.tuning.length - noteString]，
 * 故 ISR 弦号 = stringCount - note.string + 1（ISR 1 = 最高弦，对齐框架 §5.3）。
 */
function mapNote(note: unknown, stringCount: number, grace = false): IsrNote {
  const n = note as {
    string?: number;
    fret?: number;
    realValue?: number;
    dynamics?: unknown;
    isHammerPullOrigin?: boolean;
    isLetRing?: boolean;
    isPalmMute?: boolean;
    isDead?: boolean;
    isTieDestination?: boolean;
    slideOutType?: unknown;
  };
  const alphaStr = typeof n.string === "number" ? n.string : 0;
  const stringNumber = stringCount - alphaStr + 1;
  const techniques: string[] = [];
  if (n.isHammerPullOrigin) techniques.push("hammer-on");
  if (n.isLetRing) techniques.push("let-ring");
  if (n.isPalmMute) techniques.push("palm-mute");
  if (n.isDead) techniques.push("dead");
  if (n.isTieDestination) techniques.push("tie");
  return {
    stringNumber,
    fret: typeof n.fret === "number" ? n.fret : 0,
    midi: typeof n.realValue === "number" ? n.realValue : 0,
    dynamics: dynamicValueToNumber(n.dynamics),
    techniques,
    isTieDestination: !!n.isTieDestination,
    isGrace: !!grace,
  };
}

/** alphaTab Score → InternalScore。 */
export function toIsr(score: model.Score): InternalScore {
  const tracks: IsrTrack[] = score.tracks.map((track, trackIndex) => {
    const stave = (track as {
      staves?: Array<{ stringTuning?: { tunings?: number[] }; capo?: number; bars?: unknown[] }>;
    })?.staves?.[0];
    const tunings = stave?.stringTuning?.tunings ?? [];
    const stringCount = tunings.length;
    const capo = typeof stave?.capo === "number" ? stave.capo : 0;

    const measures: IsrMeasure[] = (stave?.bars ?? []).map((bar, barIndex) => {
      const voices: IsrBeat[][] = ((bar as { voices?: Array<{ beats?: unknown[] }> })?.voices ?? []).map(
        (voice) =>
          (voice.beats ?? []).map((beat, beatIndex) => {
            const b = beat as {
              duration?: number;
              notes?: unknown[];
              dots?: number;
              tupletNumerator?: number;
              tupletDenominator?: number;
              graceType?: number;
            };
            const isGraceBeat = typeof b.graceType === "number" ? b.graceType !== 0 : false;
            const notes: IsrNote[] = (b.notes ?? []).map((note) =>
              mapNote(note, stringCount, isGraceBeat),
            );
            return {
              index: beatIndex,
              duration: typeof b.duration === "number" ? b.duration : 0,
              dots: b.dots ?? 0,
              tupletNumerator: b.tupletNumerator,
              tupletDenominator: b.tupletDenominator,
              notes,
            } satisfies IsrBeat;
          }),
      );
      return { trackIndex, index: barIndex, voices };
    });

    return {
      index: trackIndex,
      name: track.name ?? "",
      stringCount,
      tuning: [...tunings], // 保序直达（文件弦序，不按音高排序；交替调弦保留物理顺序）
      capo,
      measures,
    } satisfies IsrTrack;
  });

  const masterBars: IsrMasterBar[] = score.masterBars.map((mb, index) => ({
    index,
    timeSignatureNumerator: mb.timeSignatureNumerator ?? 4,
    timeSignatureDenominator: mb.timeSignatureDenominator ?? 4,
    tempoBpm: index === 0 ? (score.tempo ?? null) : null,
    isRepeatStart: mb.isRepeatStart ?? false,
    repeatCount: mb.repeatCount ?? 0,
    alternateEndings: mb.alternateEndings ?? 0,
    tempoAutomations: ((mb.tempoAutomations ?? []) as Array<{ value?: number; ratioPosition?: number }>).map(
      (a) => ({
        tick: Math.round(960 * 4 * (mb.timeSignatureNumerator ?? 4) / (mb.timeSignatureDenominator ?? 4) * (a.ratioPosition ?? 0)),
        bpm: a.value ?? 0,
      }),
    ),
  }));

  return {
    title: score.title ?? "",
    subTitle: score.subTitle ?? "",
    artist: score.artist ?? "",
    tempo: score.tempo ?? 120,
    tracks,
    masterBars,
  };
}

/** 便捷入口：GP 字节 → 完整 ISR。 */
export function importGpToIsr(bytes: Uint8Array): InternalScore {
  const score = parseWithAlphaTab(bytes);
  return toIsr(score);
}

export type { InternalScore };
