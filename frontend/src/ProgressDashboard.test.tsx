import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { barPercent, ProgressDashboard, PROGRESS_DAYS } from "./ProgressDashboard";

describe("ProgressDashboard helpers", () => {
  it("barPercent：相对最大值；全 0 → 0", () => {
    expect(barPercent(30, 60)).toBe(50);
    expect(barPercent(60, 60)).toBe(100);
    expect(barPercent(0, 60)).toBe(0);
    expect(barPercent(30, 0)).toBe(0);
  });
});

describe("ProgressDashboard", () => {
  it("渲染 7 根柱（近 7 日）与连续天数", () => {
    render(<ProgressDashboard stats={{ dailyMinutes: [10, 20, 0, 40, 60, 5, 15], streak: 5 }} />);
    for (let i = 1; i <= PROGRESS_DAYS; i++) {
      expect(screen.getByTestId(`day-${i}`)).toBeTruthy();
      expect(screen.getByTestId(`fill-${i}`)).toBeTruthy();
    }
    expect(screen.getByTestId("streak").textContent).toContain("5");
  });

  it("柱高按比例：最大为 100%，一半为 50%，零为 0%", () => {
    render(<ProgressDashboard stats={{ dailyMinutes: [0, 30, 60, 60, 0, 10, 20], streak: 0 }} />);
    expect(screen.getByTestId("fill-2").style.height).toBe("50%");
    expect(screen.getByTestId("fill-3").style.height).toBe("100%");
    expect(screen.getByTestId("fill-1").style.height).toBe("0%");
  });

  it("streak 显示连续天数标签", () => {
    render(<ProgressDashboard stats={{ dailyMinutes: [10, 20, 30, 40, 50, 60, 70], streak: 7 }} />);
    expect(screen.getByTestId("streak").textContent).toMatch(/连续练习 7 天/);
  });
});
