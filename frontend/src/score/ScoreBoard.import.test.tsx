import { act, fireEvent, render, screen } from "../test-utils";
import { describe, expect, it } from "vitest";
import { ScoreBoard } from "./ScoreBoard";
import type { InternalScore } from "../parser/isr";

function makeScore(): InternalScore {
  return {
    title: "T",
    subTitle: "",
    artist: "",
    tempo: 120,
    tracks: [
      { index: 0, name: "Guitar", stringCount: 6, tuning: [64, 59, 55, 50, 45, 40], capo: 0, measures: [] },
    ],
    masterBars: [],
  };
}

function fileNamed(fileName: string): File {
  return {
    name: fileName,
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  } as File;
}

function pickInput(): HTMLInputElement {
  return screen.getByLabelText(/选择 GP\/GP5/) as HTMLInputElement;
}

async function releaseTicks(rounds = 6) {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe("ScoreBoard — 导入控件保留与替换语义", () => {
  it("已导入后仍保留文件输入与拖放入口", () => {
    render(<ScoreBoard initialScore={makeScore()} />);
    expect(pickInput()).toBeTruthy();
    expect(screen.getByText(/或拖放谱面/)).toBeTruthy();
  });

  it("替换成功：新文件名生效、先前谱面被替换、导入控件保留", async () => {
    const fakeImport = () => Promise.resolve(makeScore());
    const { container } = render(<ScoreBoard initialScore={makeScore()} importFn={fakeImport} />);
    await act(async () => {
      fireEvent.change(pickInput(), { target: { files: [fileNamed("second.gp")] } });
      await releaseTicks();
    });
    const text = (container as HTMLElement).textContent;
    expect(text).toContain("second.gp");
    expect(text).toContain("或拖放谱面");
  });

  it("替换失败：显示错误、保留先前谱面与导入控件", async () => {
    const fakeImport = () => Promise.reject(new Error("import failed"));
    const { container } = render(<ScoreBoard initialScore={makeScore()} importFn={fakeImport} />);
    await act(async () => {
      fireEvent.change(pickInput(), { target: { files: [fileNamed("broken.gp")] } });
      await releaseTicks();
    });
    const text = (container as HTMLElement).textContent;
    expect(text).toContain("import failed");
    expect(text).toContain("(内置示例)"); // fileName 仍是初始谱面（未被替换）
    expect(pickInput()).toBeTruthy(); // 导入控件保留（错误已替代提示文本）
  });

  it("pending 态：导入期间输入禁用，完成后恢复并替换", async () => {
    let settleImport: ((value: InternalScore) => void) | undefined;
    const gate = new Promise<InternalScore>((resolve) => {
      settleImport = resolve;
    });
    const fakeImport = () => gate;
    const { container } = render(<ScoreBoard initialScore={makeScore()} importFn={fakeImport} />);
    const input = pickInput();
    let fired = false;
    await act(async () => {
      fireEvent.change(input, { target: { files: [fileNamed("slow.gp")] } });
      fired = true;
    });
    expect(fired).toBe(true);
    expect(input.disabled).toBe(true); // pending 期间禁用
    await act(async () => {
      settleImport?.(makeScore());
      await releaseTicks();
    });
    expect((container as HTMLElement).textContent).toContain("slow.gp");
  });
});
