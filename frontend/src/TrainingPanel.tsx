/**
 * 训练反馈面板：展示一次练习的当前成绩（命中 / 漏音 / 多余 / 提前 / 滞后 / 总目标）。
 * 数据来自外部 `stats` 对象（本阶段为 mock；原生评分接入后替换）。无浏览器音频。
 */

export interface TrainingStats {
  hits: number;
  misses: number;
  extras: number;
  early: number;
  late: number;
  total: number;
}

export interface TrainingPanelProps {
  stats: TrainingStats;
}

/** 已判定目标命中率（hits / (hits+misses)）；无已判定则显示占位。 */
export function hitRateOf(stats: TrainingStats): string {
  const graded = stats.hits + stats.misses;
  if (graded <= 0) return "—";
  return `${Math.round((stats.hits / graded) * 100)}%`;
}

/** 按时命中 = hits − early − late（下限 0）。 */
export function onTimeOf(stats: TrainingStats): number {
  return Math.max(0, stats.hits - stats.early - stats.late);
}

/** 训练反馈面板。 */
export function TrainingPanel({ stats }: TrainingPanelProps) {
  const rows = [
    { label: "命中", value: String(stats.hits), key: "hits" },
    { label: "漏音", value: String(stats.misses), key: "misses" },
    { label: "多余", value: String(stats.extras), key: "extras" },
    { label: "提前", value: String(stats.early), key: "early" },
    { label: "滞后", value: String(stats.late), key: "late" },
    { label: "目标总数", value: String(stats.total), key: "total" },
    { label: "命中率", value: hitRateOf(stats), key: "hitRate" },
    { label: "按时命中", value: String(onTimeOf(stats)), key: "onTime" },
  ];

  return (
    <section className="training" data-testid="trainingPanel">
      <h2>训练反馈</h2>
      <dl className="trainingReadout">
        {rows.map((row) => (
          <div className="readout" key={row.key}>
            <dt>{row.label}</dt>
            <dd data-testid={`metric-${row.key}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
