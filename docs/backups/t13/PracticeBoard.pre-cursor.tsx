import type { InternalScore } from "./parser/isr";
import type { PlaybackExpansion } from "./score/playbackTypes";

/**
 * 基础练习 UI：滚动指板显示 + 目标音符高亮 + 弦/品格标签 + 节拍脉冲指示。
 * 数据来自 ISR（调弦/弦数）与 ScorePlaybackAdapter 的 TrainingTarget（高亮目标）。
 * 无浏览器音频：脉冲指示仅视觉（pulse prop 由外部驱动，原生样本时钟为唯一时间权威）。
 */
export interface PracticeBoardProps {
  isr: InternalScore;
  expansion: PlaybackExpansion;
  /** 节拍脉冲（视觉指示；不产生发声）。 */
  pulse?: boolean;
  /** 显示的品格数上限（默认 15；超出目标品格时按目标扩展）。 */
  fretCount?: number;
}

function buildTargetMap(expansion: PlaybackExpansion, stringCount: number): Set<string> {
  const map = new Set<string>();
  for (const target of expansion.targets) {
    if (target.grading !== "singleNote") continue;
    if (target.stringNumber < 1 || target.stringNumber > stringCount) continue;
    map.add(`${target.stringNumber}-${target.fret}`);
  }
  return map;
}

function maxFretOf(targets: PlaybackExpansion["targets"], fallback: number): number {
  let maximum = fallback;
  for (const t of targets) if (t.fret > maximum) maximum = t.fret;
  return maximum;
}

/** 滚动指板：左侧弦号标签，顶部品格标签，网格单元格；目标格高亮；下方节拍脉冲指示。 */
export function PracticeBoard({
  isr,
  expansion,
  pulse = false,
  fretCount = 15,
}: PracticeBoardProps) {
  const track = isr.tracks[0] ?? null;
  const stringCount = track ? track.stringCount : 6;
  const targetMap = buildTargetMap(expansion, stringCount);
  const maxFret = maxFretOf(expansion.targets, Math.max(0, fretCount - 1));
  const frets = Array.from({ length: maxFret + 1 }, (_, i) => i);
  const stringNumbers = Array.from({ length: stringCount }, (_, i) => i + 1);

  return (
    <div className="practice" data-testid="practice">
      <div className="pulseBar">
        <span
          className={pulse ? "pulseDot lit" : "pulseDot"}
          data-testid="pulse"
          data-lit={pulse ? "true" : "false"}
        />
        <span>节拍</span>
      </div>
      <div className="boardScroll" data-testid="boardScroll">
        <div className="stringLabels">
          {stringNumbers.map((n) => (
            <div className="stringLabel" data-testid={`string-${n}`} data-string={n} key={n}>
              {n}
            </div>
          ))}
        </div>
        <div className="frets">
          <div className="fretLabels">
            {frets.map((f) => (
              <div className="fretLabel" data-fret={f} key={f}>
                {f}
              </div>
            ))}
          </div>
          {frets.map((f) => (
            <div className="fretCol" data-fret={f} key={f}>
              {stringNumbers.map((n) => {
                const hit = targetMap.has(`${n}-${f}`);
                return (
                  <div
                    className={hit ? "fretCell target" : "fretCell"}
                    data-string={n}
                    data-fret={f}
                    data-target={hit ? "true" : "false"}
                    key={n}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
