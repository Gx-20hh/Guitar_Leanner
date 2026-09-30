/**
 * 调音器面板：显示六弦标签与距目标频率的音分偏差。
 * 音分 = 1200*log2(frequency/target)；频率/目标无效（<=0）显示占位。
 * 无浏览器音频（输入来自外部/原生）。
 */

export interface TuningPanelProps {
  frequencies: number[];
  targets: number[];
}

/** 计算某弦音分偏差；无效返回 null。 */
export function centsOff(frequency: number, target: number): number | null {
  if (!(frequency > 0) || !(target > 0)) return null;
  return 1200 * Math.log2(frequency / target);
}

/** 音分偏差格式化：有效取整并带正负；无效显示占位。 */
export function formatCents(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

/** 调音器面板。默认六弦；传入数组决定行数。 */
export function TuningPanel({ frequencies, targets }: TuningPanelProps) {
  const strings = Math.min(frequencies.length, targets.length);

  return (
    <section className="tuning" data-testid="tuningPanel">
      <h2>调音器</h2>
      <dl className="tuningReadout">
        {Array.from({ length: strings }, (_, i) => {
          const deviation = centsOff(frequencies[i], targets[i]);
          return (
            <div className="readout" key={i}>
              <dt data-testid={`tuning-string-${i + 1}`}>弦 {i + 1}</dt>
              <dd data-testid={`tuning-cents-${i + 1}`}>{formatCents(deviation)}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
