import { fireEvent, render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { LOOPER_TRACK_COUNT, LooperPanel } from "./LooperPanel";

describe("LooperPanel", () => {
  it("渲染 4 轨，每轨含四个按钮（每字 4 个）", () => {
    render(<LooperPanel />);
    expect(screen.getByTestId("looperTracks").children.length).toBe(LOOPER_TRACK_COUNT);
    for (let i = 0; i < LOOPER_TRACK_COUNT; i++) {
      expect(screen.getByTestId(`track-${i}`)).toBeTruthy();
      expect(screen.getByTestId(`trackStatus-${i}`)).toBeTruthy();
    }
    for (const label of ["录音", "播放", "停止", "过录"]) {
      expect(screen.getAllByText(label)).toHaveLength(LOOPER_TRACK_COUNT);
    }
  });

  it("录音/播放/过录为切换，停止置为 stopped，各轨独立", () => {
    render(<LooperPanel />);
    const track0 = screen.getByTestId("track-0");
    const track1 = screen.getByTestId("track-1");

    // 轨 0 录音切换
    const recordButtons0 = screen.getAllByText("录音");
    fireEvent.click(recordButtons0[0]);
    expect(track0.getAttribute("data-status")).toBe("recording");
    fireEvent.click(recordButtons0[0]);
    expect(track0.getAttribute("data-status")).toBe("idle");

    // 轨 1 播放
    const playButtons1 = screen.getAllByText("播放");
    fireEvent.click(playButtons1[1]);
    expect(track1.getAttribute("data-status")).toBe("playing");

    // 轨 0 过录
    const overdub0 = screen.getAllByText("过录")[0];
    fireEvent.click(overdub0);
    expect(track0.getAttribute("data-status")).toBe("overdub");

    // 轨 1 停止
    const stop1 = screen.getAllByText("停止")[1];
    fireEvent.click(stop1);
    expect(track1.getAttribute("data-status")).toBe("stopped");

    // 独立：轨 0 仍 overdub
    expect(track0.getAttribute("data-status")).toBe("overdub");
  });
});
