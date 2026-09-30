import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { centsOff, formatCents, TuningPanel } from "./TuningPanel";

describe("TuningPanel helpers", () => {
  it("centsOff：同频 → 0；+5% → ≈+84.6；无效(0) → null", () => {
    expect(centsOff(440, 440)).toBe(0);
    expect(centsOff(462, 440)).toBeCloseTo(84.47, 1);
    expect(centsOff(0, 440)).toBeNull();
    expect(centsOff(440, 0)).toBeNull();
  });

  it("formatCents：有效带正负并取整；无效显示占位", () => {
    expect(formatCents(0)).toBe("+0");
    expect(formatCents(-8.4)).toBe("-8");
    expect(formatCents(84.5)).toBe("+85");
    expect(formatCents(null)).toBe("—");
  });
});

describe("TuningPanel", () => {
  it("显示六弦标签与音分偏差", () => {
    render(
      <TuningPanel
        frequencies={[82.4, 110, 146.8, 196, 246.9, 329.6]}
        targets={[82.41, 110, 146.83, 196, 246.94, 329.63]}
      />,
    );
    for (const s of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByTestId(`tuning-string-${s}`).textContent).toBe(`弦 ${s}`);
    }
    // 弦 1 有微小偏差；弦 2 同频 0
    expect(screen.getByTestId("tuning-cents-1").textContent).toBeTruthy();
    expect(screen.getByTestId("tuning-cents-2").textContent).toBe("+0");
  });

  it("无效数据（0/0）显示占位而非 NaN", () => {
    render(
      <TuningPanel
        frequencies={[0, 0, 0, 0, 0, 0]}
        targets={[82.41, 110, 146.83, 196, 246.94, 329.63]}
      />,
    );
    for (const s of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByTestId(`tuning-cents-${s}`).textContent).toBe("—");
    }
  });
});
