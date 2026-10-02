import { fireEvent, render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { TransportBar } from "./TransportBar";
import type { TransportNative } from "./bridge/transport";

function fakeTransport(commands: string[]): TransportNative {
  let tick = 0;
  return {
    isNativeAvailable: () => true,
    invoke: async (request: unknown) => {
      const value = request as { type?: string; payload?: { command?: string; speed?: number } };
      if (value.type === "queryPosition") {
        tick += 1;
        const seconds = tick * 0.25;
        return { ok: true, playing: true, positionTick: String(tick * 960), positionSeconds: seconds };
      }
      if (value.type === "playback") {
        if (value.payload?.command) commands.push(value.payload.command);
        return { ok: true };
      }
      return { ok: false, message: "unknown" };
    },
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("TransportBar", () => {
  it("渲染播放/暂停/停止、速度选择与位置显示", () => {
    render(<TransportBar transport={fakeTransport([])} />);
    expect(screen.getByText("播放")).toBeTruthy();
    expect(screen.getByText("暂停")).toBeTruthy();
    expect(screen.getByText("停止")).toBeTruthy();
    expect(screen.getByLabelText("速度")).toBeTruthy();
    expect(screen.getByTestId("transportPosition")).toBeTruthy();
  });

  it("点播放发送 play 并开启 200ms 轮询（位置推进）；点暂停/停止发送对应命令", async () => {
    const commands: string[] = [];
    const { container } = render(<TransportBar transport={fakeTransport(commands)} />);
    const text = () => (container as HTMLElement).textContent ?? "";

    fireEvent.click(screen.getByText("播放"));
    expect(commands).toContain("play");
    await wait(460); // 至少一次 200ms 轮询
    expect(commands.filter((c) => c === "play").length).toBeGreaterThanOrEqual(1);
    // 位置已推进：显示非零 tick/秒
    expect(text()).toMatch(/tick [1-9][0-9]*/);

    fireEvent.click(screen.getByText("暂停"));
    expect(commands).toContain("pause");

    fireEvent.click(screen.getByText("停止"));
    expect(commands).toContain("stop");
  });

  it("播放中改速以该速度重发 play", async () => {
    const commands: string[] = [];
    render(<TransportBar transport={fakeTransport(commands)} />);
    fireEvent.click(screen.getByText("播放"));
    const speed = screen.getByLabelText("速度") as HTMLSelectElement;
    fireEvent.change(speed, { target: { value: "1.50" } });
    await wait(40);
    expect(commands.filter((c) => c === "play").length).toBeGreaterThanOrEqual(2);
  });

  it("原生不可用时显示未连接状态", async () => {
    const unavailable: TransportNative = {
      isNativeAvailable: () => false,
      invoke: async () => ({ ok: false }),
    };
    render(<TransportBar transport={unavailable} />);
    fireEvent.click(screen.getByText("播放"));
    await wait(40);
    expect(screen.getByText(/未连接/)).toBeTruthy();
  });
});
