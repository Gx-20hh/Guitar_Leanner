import { render, screen } from "../test-utils";
import { describe, expect, it } from "vitest";
import { buildGrid, ScoreBoard } from "./ScoreBoard";
import type { InternalScore } from "../parser/isr";

/** 单轨示例谱：两拍（高弦空弦、低弦空弦）。 */
function twoNoteScore(): InternalScore {
  return {
    title: "T",
    subTitle: "",
    artist: "",
    tempo: 120,
    tracks: [
      {
        index: 0,
        name: "Guitar",
        stringCount: 6,
        tuning: [64, 59, 55, 50, 45, 40],
        capo: 0,
        measures: [
          {
            trackIndex: 0,
            index: 0,
            voices: [
              [
                { index: 0, duration: 4, notes: [{ stringNumber: 1, fret: 0, midi: 64, dynamics: 6, techniques: [], isTieDestination: false }] },
                { index: 1, duration: 4, notes: [{ stringNumber: 6, fret: 0, midi: 40, dynamics: 5, techniques: [], isTieDestination: false }] },
              ],
            ],
          },
        ],
      },
    ],
    masterBars: [],
  };
}

function oneVoiceBeat(notes: { stringNumber: number; fret: number }[], duration = 4) {
  return {
    index: 0,
    duration,
    notes: notes.map((n) => ({ midi: 0, dynamics: 5, techniques: [], isTieDestination: false, ...n })),
  };
}

describe("buildGrid — 声部分块与列语义", () => {
  it("高弦空弦后接低弦空弦为独立列（同一声部）", () => {
    const track = {
      index: 0,
      name: "G",
      stringCount: 6,
      tuning: [64, 59, 55, 50, 45, 40],
      capo: 0,
      measures: [{ trackIndex: 0, index: 0, voices: [[oneVoiceBeat([{ stringNumber: 1, fret: 0 }]), oneVoiceBeat([{ stringNumber: 6, fret: 0 }])]] }],
    };
    const blocks = buildGrid(track as InternalScore["tracks"][number])!;
    expect(blocks).toHaveLength(1);
    const rows = blocks[0].rows;
    expect(rows[0][0]).toBe("0");
    expect(rows[0][1]).toBe("·");
    expect(rows[5][0]).toBe("·");
    expect(rows[5][1]).toBe("0");
  });

  it("和弦共享列（同一拍、不同弦行）", () => {
    const beatNotes = [
      { stringNumber: 1, fret: 2 },
      { stringNumber: 3, fret: 5 },
    ];
    const track = {
      index: 0,
      name: "G",
      stringCount: 6,
      tuning: [64, 59, 55, 50, 45, 40],
      capo: 0,
      measures: [{ trackIndex: 0, index: 0, voices: [[oneVoiceBeat(beatNotes)]] }],
    };
    const rows = buildGrid(track as InternalScore["tracks"][number])![0].rows;
    expect(rows[0][0]).toBe("2");
    expect(rows[2][0]).toBe("5");
  });

  it("休止拍保留整列（·）", () => {
    const track = {
      index: 0,
      name: "G",
      stringCount: 6,
      tuning: [64, 59, 55, 50, 45, 40],
      capo: 0,
      measures: [{ trackIndex: 0, index: 0, voices: [[oneVoiceBeat([{ stringNumber: 1, fret: 0 }]), oneVoiceBeat([]), oneVoiceBeat([{ stringNumber: 6, fret: 0 }])]] }],
    };
    const rows = buildGrid(track as InternalScore["tracks"][number])![0].rows;
    expect(rows[0]).toEqual(["0", "·", "·"]);
    expect(rows[5]).toEqual(["·", "·", "0"]);
  });

  it("小节边界以 | 分隔（同一声部）", () => {
    const track = {
      index: 0,
      name: "G",
      stringCount: 6,
      tuning: [64, 59, 55, 50, 45, 40],
      capo: 0,
      measures: [
        { trackIndex: 0, index: 0, voices: [[oneVoiceBeat([{ stringNumber: 1, fret: 0 }])]] },
        { trackIndex: 0, index: 1, voices: [[oneVoiceBeat([{ stringNumber: 6, fret: 0 }])]] },
      ],
    };
    const rows = buildGrid(track as InternalScore["tracks"][number])![0].rows;
    expect(rows[0][1]).toBe("|");
    expect(rows[5][1]).toBe("|");
  });

  it("零弦/非六线音轨返回 null，不崩溃、不伪造品", () => {
    const base = twoNoteScore().tracks[0];
    expect(buildGrid({ ...base, stringCount: 0 })).toBeNull();
    expect(buildGrid({ ...base, stringCount: -1 })).toBeNull();
  });

  it("不同声部各自成块并带标签：不按数组下标作虚假同时发声", () => {
    const makeBeat = (stringNumber: number, fret: number) =>
      oneVoiceBeat([{ stringNumber, fret }]);
    const track = {
      index: 0,
      name: "G",
      stringCount: 6,
      tuning: [64, 59, 55, 50, 45, 40],
      capo: 0,
      measures: [
        {
          trackIndex: 0,
          index: 0,
          voices: [
            [makeBeat(1, 0), makeBeat(1, 5)], // 声部A：两拍 duration4（四分）
            [
              { ...oneVoiceBeat([{ stringNumber: 6, fret: 0 }]), duration: 8 },
              { ...oneVoiceBeat([{ stringNumber: 6, fret: 3 }]), duration: 8 },
              { ...oneVoiceBeat([{ stringNumber: 6, fret: 5 }]), duration: 8 },
              { ...oneVoiceBeat([{ stringNumber: 6, fret: 7 }]), duration: 8 },
            ], // 声部B：四拍 duration8（八分）
          ],
        },
      ],
    };
    const blocks = buildGrid(track as InternalScore["tracks"][number])!;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].label).toContain("声部 1");
    expect(blocks[1].label).toContain("声部 2");
    // 两列(声部A)与四列(声部B)：不把下标当时间对齐，列数各自独立
    expect(blocks[0].rows[0]).toHaveLength(2);
    expect(blocks[1].rows[5]).toHaveLength(4);
    // 时长区分：声部A duration4、声部B duration8
    const measures = (track as InternalScore["tracks"][number]).measures;
    expect(measures[0].voices[0][0].duration).toBe(4);
    expect(measures[0].voices[1][0].duration).toBe(8);
  });
});

describe("ScoreBoard — 导入控件保留", () => {
  it("已导入后仍保留文件输入与拖放入口（可替换谱面）", () => {
    render(<ScoreBoard initialScore={twoNoteScore()} />);
    expect(screen.getByLabelText(/选择 GP\/GP5/)).toBeTruthy();
    expect(screen.getByText(/或拖放谱面/)).toBeTruthy();
  });
});
