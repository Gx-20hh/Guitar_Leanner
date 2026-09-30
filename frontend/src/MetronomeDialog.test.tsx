import { fireEvent, render, screen } from "./test-utils";
import { describe, expect, it, vi } from "vitest";
import { MetronomeDialog, METRONOME_BEATS, METRONOME_SUBS } from "./MetronomeDialog";

describe("MetronomeDialog", () => {
  it("渲染 BPM、拍号选项与细分选项，并显示初始值", () => {
    render(
      <MetronomeDialog
        initialBpm={120}
        initialBeats="4/4"
        initialSub="1/8"
        onApply={() => undefined}
      />,
    );
    expect((screen.getByLabelText("BPM") as HTMLInputElement).value).toBe("120");
    const beats = screen.getByLabelText("拍号") as HTMLSelectElement;
    expect(beats.value).toBe("4/4");
    for (const option of METRONOME_BEATS) {
      expect(Array.from(beats.options).some((o) => o.value === option)).toBe(true);
    }
    for (const option of METRONOME_SUBS) {
      expect(screen.getByLabelText(option)).toBeTruthy();
    }
    expect(screen.getByLabelText(METRONOME_SUBS[0])).toBeTruthy();
  });

  it("修改 BPM/拍号/细分后点应用，onApply 收到新值", () => {
    const onApply = vi.fn();
    render(
      <MetronomeDialog initialBpm={120} initialBeats="4/4" initialSub="1/4" onApply={onApply} />,
    );
    const bpm = screen.getByLabelText("BPM") as HTMLInputElement;
    fireEvent.change(bpm, { target: { value: "90" } });
    const beats = screen.getByLabelText("拍号") as HTMLSelectElement;
    fireEvent.change(beats, { target: { value: "6/8" } });
    fireEvent.click(screen.getByLabelText("1/16"));

    fireEvent.click(screen.getByText("应用"));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(90, "6/8", "1/16");
  });

  it("非法 BPM 回落到 0（不传 NaN）", () => {
    const onApply = vi.fn();
    render(
      <MetronomeDialog initialBpm={120} initialBeats="4/4" initialSub="1/4" onApply={onApply} />,
    );
    const bpm = screen.getByLabelText("BPM") as HTMLInputElement;
    fireEvent.change(bpm, { target: { value: "abc" } });
    fireEvent.click(screen.getByText("应用"));
    expect(onApply).toHaveBeenCalledWith(0, "4/4", "1/4");
  });
});
