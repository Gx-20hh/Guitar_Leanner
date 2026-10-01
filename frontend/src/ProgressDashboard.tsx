/**
 * 进度看板：近 7 日每日练习时长（柱状图）+ 连续天数（streak）。纯展示、无浏览器音频。
 */
export interface ProgressStats {
  dailyMinutes: number[];
  streak: number;
}

export const PROGRESS_DAYS = 7;

/** 柱高百分比（基于最大值；全 0 时 0%）。 */
export function barPercent(minutes: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((Math.max(0, minutes) / max) * 100);
}

/** 进度看板。 */
export function ProgressDashboard({ stats }: { stats: ProgressStats }) {
  const days = (stats.dailyMinutes ?? []).slice(0, PROGRESS_DAYS);
  const max = Math.max(...days, 0);

  return (
    <section className="progress" data-testid="progressDashboard">
      <div className="progressStreak" data-testid="streak">
        连续练习 {stats.streak} 天
      </div>
      <div className="progressChart" data-testid="progressChart">
        {Array.from({ length: PROGRESS_DAYS }, (_, i) => {
          const minutes = days[i] ?? 0;
          const percent = barPercent(minutes, max);
          return (
            <div className="progressBar" data-testid={`day-${i + 1}`} data-minutes={minutes} key={i}>
              <div
                className="progressFill"
                style={{ height: `${percent}%` }}
                data-testid={`fill-${i + 1}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
