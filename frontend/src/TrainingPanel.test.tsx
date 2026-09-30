import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { hitRateOf, onTimeOf, TrainingPanel, type TrainingStats } from "./TrainingPanel";

function stats(overrides: Partial<TrainingStats> = {}): TrainingStats {
  return { hits: 0, misses: 0, extras: 0, early: 0, late: 0, total: 0, ...overrides };
}

describe("TrainingPanel helpers", () => {
  const metric = (key: string) => screen.getByTestId(`metric-${key}`).textContent;

  it("命中率 = hits/(hits+misses)；无已判定显示占位", () => {
    expect(hitRateOf(stats({ hits: 8, misses: 2 }))).toBe("80%");
    expect(hitRateOf(stats())).toBe("—"); // graded 0
    expect(hitRateOf(stats({ hits: 0, misses: 0 }))).toBe("—");
  });

  it("按时命中 = hits − early − late（下限 0）", () => {
    expect(onTimeOf(stats({ hits: 10, early: 2, late: 3 }))).toBe(5);
    expect(onTimeOf(stats({ hits: 2, early: 3 }))).toBe(0);
  });

  it("面板展示各项成绩与目标总数", () => {
    render(
      <TrainingPanel
        stats={stats({ hits: 8, misses: 2, extras: 1, early: 2, late: 1, total: 10 })}
      />,
    );
    expect(metric("hits")).toBe("8");
    expect(metric("misses")).toBe("2");
    expect(metric("extras")).toBe("1");
    expect(metric("early")).toBe("2");
    expect(metric("late")).toBe("1");
    expect(metric("total")).toBe("10");
    expect(metric("hitRate")).toBe("80%");
    expect(metric("onTime")).toBe("5");
  });

  it("无成绩（全部 0）时命中率占位、按时为 0，无 NaN", () => {
    render(<TrainingPanel stats={stats()} />);
    expect(metric("hitRate")).toBe("—");
    expect(metric("onTime")).toBe("0");
  });
});
