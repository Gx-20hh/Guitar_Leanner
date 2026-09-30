
/**
 * ScoreTuner：实时音名显示 + 最大字号音分标签 + 指针指示 + 弦选择。
 * 无浏览器音频（输入来自外部/原生评分）。
 */
export interface ScoreTunerProps {
  currentNote: string;
  cent: number;
}

export const TUNER_STRING_OPTIONS = [1, 2, 3, 4, 5, 6];

/** 音分标签（带符号、最大字号展示）。 */
export function centLabel(cent: number): string {
  const rounded = Math.round(cent);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

/** 指针位置百分比（cent 收敛到 [-50,50]）。 */
export function needlePercent(cent: number): number {
  const clamped = Math.max(-50, Math.min(50, cent));
  return (clamped + 50) * 100 / 100;
}

/** 是否在准（±5 音分内）。 */
export function isInTune(cent: number): boolean {
  return Math.abs(cent) <= 5;
}

export function ScoreTuner({ currentNote, cent }: ScoreTunerProps): JSX.Element {
  const position = needlePercent(cent);
  const inTune = isInTune(cent);

  return (
    <section className="tuner" data-testid="scoreTuner">
      <div className="tunerNote" data-testid="tunerNote">
        {currentNote || "—"}
      </div>
      <div className="tunerCents" data-testid="tunerCents">
        {centLabel(cent)}
      </div>
      <div className="tunerGauge" data-testid="tunerGauge">
        <div
          className={inTune ? "tunerNeedle" : "tunerNeedle"}
          style={{ left: `${position}%` }}
          data-testid="tunerNeedle"
          data-cent={Math.round(cent)}
          data-in-tune={inTune ? "true" : "false"}
        />
      </div>
      <label htmlFor="tunerString">弦</label>
      <select id="tunerString" data-testid="tunerString">
        {TUNER_STRING_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </section>
  );
}
