import { fireEvent, render, screen } from "./test-utils";
import { describe, expect, it, vi } from "vitest";
import { BUFFER_OPTIONS, SAMPLE_RATE_OPTIONS, SettingsDialog } from "./SettingsDialog";

describe("SettingsDialog", () => {
  it("渲染 A4 默认 440、缓冲与采样率选项、初始值", () => {
    render(
      <SettingsDialog initial={{ a4: 440, bufferSize: 128, sampleRate: 48000 }} onApply={() => undefined} />,
    );
    expect((screen.getByLabelText("A4 参考频率 (Hz)") as HTMLInputElement).value).toBe("440");
    const buffer = screen.getByLabelText("缓冲尺寸") as HTMLSelectElement;
    expect(buffer.value).toBe("128");
    for (const option of BUFFER_OPTIONS) {
      expect(Array.from(buffer.options).some((o) => o.value === String(option))).toBe(true);
    }
    const rate = screen.getByLabelText("采样率") as HTMLSelectElement;
    expect(rate.value).toBe("48000");
    for (const option of SAMPLE_RATE_OPTIONS) {
      expect(Array.from(rate.options).some((o) => o.value === String(option))).toBe(true);
    }
  });

  it("修改并点应用，onApply 收到新设置", () => {
    const onApply = vi.fn();
    render(<SettingsDialog initial={{ a4: 440, bufferSize: 128, sampleRate: 48000 }} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("A4 参考频率 (Hz)") as HTMLInputElement, { target: { value: "442" } });
    fireEvent.change(screen.getByLabelText("缓冲尺寸") as HTMLSelectElement, { target: { value: "256" } });
    fireEvent.change(screen.getByLabelText("采样率") as HTMLSelectElement, { target: { value: "44100" } });
    fireEvent.click(screen.getByText("应用"));
    expect(onApply).toHaveBeenCalledWith({ a4: 442, bufferSize: 256, sampleRate: 44100 });
  });

  it("非法 A4 回落 440", () => {
    const onApply = vi.fn();
    render(<SettingsDialog initial={{ a4: 440, bufferSize: 128, sampleRate: 48000 }} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("A4 参考频率 (Hz)") as HTMLInputElement, { target: { value: "abc" } });
    fireEvent.click(screen.getByText("应用"));
    expect(onApply).toHaveBeenCalledWith({ a4: 440, bufferSize: 128, sampleRate: 48000 });
  });
});
