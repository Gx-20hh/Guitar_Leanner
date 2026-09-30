import { render, screen } from "../test-utils";
import { describe, expect, it } from "vitest";
import { ScoreBoard, buildGrid } from "./ScoreBoard";
import type { InternalScore, IsrTrack } from "../parser/isr";

/** 造一个单轨 InternalScore；measures 参数直接给出该轨的小节。 */
function makeScore(measures: IsrTrack["measures"]): InternalScore {
  return {
    title: "T",
    subTitle: "",
    artist: "",
    tempo: 120,
    tracks: [{ index: 0, name: "Guitar", stringCount: 6, tuning: [64, 59, 55, 50, 45, 40], capo: 0, measures }],
    masterBars: [],
  };
}
function measure(voices: InternalScore["tracks"][number]["measures"][number]["voices"]): IsrTrack["measures"] {
  return [{ trackIndex: 0, index: 0, voices }];
}
function beat(
  notes: { stringNumber: number; fret: number }[],
): InternalScore["tracks"][number]["measures"][number]["voices"][number][number] {
  return {
    index: 0,
    duration: 4,
    notes: notes.map((n) => ({ midi: 0, dynamics: 5, techniques: [], isTieDestination: false, ...n })),
  };
}

describe("buildGrid — 拍列 / 休止 / 和弦 / 小节边界", () => {
  it("高弦空弦后接低弦空弦：不同列（独立列）", () => {
    const m = measure([
      [
        beat([{ stringNumber: 1, fret: 0 }]), // 高弦 open
        beat([{ stringNumber: 6, fret: 0 }]), // 低弦 open
      ],
    ]);
    const grid = buildGrid(makeScore(m).tracks[0])!;
    // 顶行 = 高弦(1)：col0=0, col1=·；低弦(6)行：col0=·, col1=0
    expect(grid[0][0]).toBe("0");
    expect(grid[0][1]).toBe("·");
    expect(grid[5][0]).toBe("·");
    expect(grid[5][1]).toBe("0");
    expect(grid).toHaveLength(6);
  });

  it("和弦：同一拍两条音符共享同一列（不同弦行）", () => {
    const m = measure([
      [
        beat([
          { stringNumber: 1, fret: 2 },
          { stringNumber: 3, fret: 5 },
        ]),
      ],
    ]);
    const grid = buildGrid(makeScore(m).tracks[0])!;
    expect(grid[0][0]).toBe("2");
    expect(grid[2][0]).toBe("5"); // 同列，弦行不同
  });

  it("休止拍保留整列（全 ·）", () => {
    const m = measure([
      [
        beat([{ stringNumber: 1, fret: 0 }]),
        beat([]), // 休止
        beat([{ stringNumber: 6, fret: 0 }]),
      ],
    ]);
    const grid = buildGrid(makeScore(m).tracks[0])!;
    expect(grid[0]).toEqual(["0", "·", "·"]);
    expect(grid[5]).toEqual(["·", "·", "0"]); // 列数保留
  });

  it("小节边界以 | 分隔", () => {
    const m = [
      { trackIndex: 0, index: 0, voices: [[beat([{ stringNumber: 1, fret: 0 }])]] },
      { trackIndex: 0, index: 1, voices: [[beat([{ stringNumber: 6, fret: 0 }])]] },
    ];
    const grid = buildGrid(makeScore(m).tracks[0])!;
    expect(grid[0][1]).toBe("|");
    expect(grid[5][1]).toBe("|");
  });

  it("零弦 / 非六线音轨：返回 null，不崩 rows[0]、不伪造品", () => {
    const t = makeScore([]).tracks[0];
    expect(buildGrid({ ...t, stringCount: 0 })).toBeNull();
    expect(buildGrid({ ...t, stringCount: -1 })).toBeNull();
    expect(buildGrid({ ...t, stringCount: 0 })).toBeNull();
  });
});

describe("ScoreBoard — DOM 回归（列保留、无音频）", () => {
  it("高→低空弦为独立列；预渲染 <pre> 与音轨下拉存在", () => {
    const m = measure([
      [
        beat([{ stringNumber: 1, fret: 0 }]),
        beat([{ stringNumber: 6, fret: 0 }]),
      ],
    ]);
    render(<ScoreBoard initialScore={makeScore(m)} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].textContent).toBe("Guitar");
    const pre = screen.queryByTestId("tab");
    expect(pre).not.toBeNull();
    const text = pre!.textContent ?? "";
    // 顶行(高弦1)含 "0 ·"，低弦行含 "· 0" → 两个空弦在不同列
    expect(text).toContain("0 ·");
    expect(text).toContain("· 0");
  });

  it("零弦音轨渲染占位而不崩、不造假", () => {
    render(<ScoreBoard initialScore={{ ...makeScore([]), tracks: [{ index: 0, name: "Drums", stringCount: 0, tuning: [], capo: 0, measures: [] }] }} />);
    const tab = screen.queryByTestId("tab");
    expect(tab).toBeNull();
    expect(screen.getByText(/非六线/)).toBeTruthy();
  });
});
