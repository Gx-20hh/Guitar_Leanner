import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { centLabel, isInTune, needlePercent, ScoreTuner, TUNER_STRING_OPTIONS } from "./ScoreTuner";

describe("ScoreTuner helpers", () => {
  it("centLabel：带正负并取整", () => {
    expect(centLabel(0)).toBe("+0");
    expect(centLabel(7)).toBe("+7");
    expect(centLabel(-12.6)).toBe("-13");
  });

  it("needlePercent：cent 收敛到 [-50,50] 并映射 0..100%", () => {
    expect(needlePercent(0)).toBe(50);
    expect(needlePercent(-50)).toBe(0);
    expect(needlePercent(50)).toBe(100);
    expect(needlePercent(-999)).toBe(0);
    expect(needlePercent(999)).toBe(100);
  });

  it("isInTune：±5 内为准", () => {
    expect(isInTune(3)).toBe(true);
    expect(isInTune(-5)).toBe(true);
    expect(isInTune(6)).toBe(false);
  });
});

describe("ScoreTuner", () => {
  it("渲染实时音名、音分标签与 6 弦选项", () => {
    render(<ScoreTuner currentNote="A" cent={-4} />);
    expect(screen.getByTestId("tunerNote").textContent).toBe("A");
    expect(screen.getByTestId("tunerCents").textContent).toBe("-4");
    const sel = screen.getByTestId("tunerString") as HTMLSelectElement;
    expect(sel.options.length).toBe(TUNER_STRING_OPTIONS.length);
  });

  it("指针指示：位置与准/不准状态", () => {
    const { rerender } = render(<ScoreTuner currentNote="A" cent={12} />);
    const needle = screen.getByTestId("tunerNeedle");
    expect(needle.style.left).toBe(`${needlePercent(12)}%`);
    expect(needle.getAttribute("data-in-tune")).toBe("false");

    rerender(<ScoreTuner currentNote="A" cent={2} />);
    expect(screen.getByTestId("tunerNeedle").getAttribute("data-in-tune")).toBe("true");
  });
});
