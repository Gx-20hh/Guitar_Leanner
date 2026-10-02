import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { PracticeBoard, targetAtTick } from "./PracticeBoard";
import type { InternalScore } from "./parser/isr";
import type { PlaybackExpansion } from "./score/playbackTypes";

function isr(): InternalScore {
  return {
    title: "T",
    subTitle: "",
    artist: "",
    tempo: 120,
    tracks: [
      { index: 0, name: "Guitar", stringCount: 6, tuning: [64, 59, 55, 50, 45, 40], capo: 0, measures: [] },
    ],
    masterBars: [{ index: 0, timeSignatureNumerator: 4, timeSignatureDenominator: 4, tempoBpm: 120 }],
  };
}

function target(stringNumber: number, fret: number): PlaybackExpansion["targets"][number] {
  return {
    id: "t0",
    occurrenceId: 0,
    beatSourceKey: [0, 0, 0, 0, 0],
    noteSourceKey: [0, 0, 0, 0, 0, 0],
    stringNumber,
    fret,
    soundingMidi: 64,
    startTick: "0",
    durationTicks: "960",
    techniques: [],
    grading: "singleNote",
  };
}

function expansion(tags: PlaybackExpansion["targets"]): PlaybackExpansion {
  return { midiEvents: [], occurrences: [], targets: tags, unresolvedCount: 0 };
}

describe("PracticeBoard", () => {
  it("渲染弦标签 1..6 与品格标签 0..N，无音频", () => {
    render(<PracticeBoard isr={isr()} expansion={expansion([target(6, 0), target(1, 3)])} />);
    for (const s of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByTestId(`string-${s}`)).toBeTruthy();
    }
    // 品格上限默认 15 → 标签 0..15（此处最多 3；maxFret 取目标最大 3，因此 0..3）
    for (const f of [0, 1, 2, 3]) {
      expect(screen.getByTestId("practice").querySelector(`[data-fret="${f}"].fretLabel`)).toBeTruthy();
    }
  });

  it("目标音符所在格被高亮（data-target=true 且 class 含 target）", () => {
    render(<PracticeBoard isr={isr()} expansion={expansion([target(6, 0)])} />);
    const cell = screen
      .getByTestId("practice")
      .querySelector(`[data-string="6"][data-fret="0"].fretCell`);
    expect(cell).toBeTruthy();
    expect(cell?.getAttribute("data-target")).toBe("true");
    expect((cell as HTMLElement).className).toContain("target");
  });

  it("非目标格不高亮", () => {
    render(<PracticeBoard isr={isr()} expansion={expansion([target(6, 0)])} />);
    const plain = screen
      .getByTestId("practice")
      .querySelector(`[data-string="1"][data-fret="2"].fretCell`);
    expect(plain?.getAttribute("data-target")).toBe("false");
    expect((plain as HTMLElement).className).not.toContain("target");
  });

  it("节拍脉冲指示：pulse=true 点亮、false 熄灭（仅视觉）", () => {
    const { rerender } = render(<PracticeBoard isr={isr()} expansion={expansion([])} pulse={true} />);
    expect(screen.getByTestId("pulse").getAttribute("data-lit")).toBe("true");
    rerender(<PracticeBoard isr={isr()} expansion={expansion([])} pulse={false} />);
    expect(screen.getByTestId("pulse").getAttribute("data-lit")).toBe("false");
  });

  it("无目标时标签仍在、无高亮格", () => {
    render(<PracticeBoard isr={isr()} expansion={expansion([])} />);
    expect(screen.getByTestId("practice").querySelector(".fretCell.target")).toBeNull();
    expect(screen.getByTestId("string-1")).toBeTruthy();
  });

  it("targetAtTick：当前 tick 落在 [start,duration) 内为当前目标，否则 null", () => {
    const t = target(6, 0); // startTick "0", durationTicks "960"
    const tags = [t];
    expect(targetAtTick(expansion(tags), "0")?.id).toBe(t.id);
    expect(targetAtTick(expansion(tags), "480")?.id).toBe(t.id);
    expect(targetAtTick(expansion(tags), "960")).toBeNull(); // 区间右开
    expect(targetAtTick(expansion(tags), null)).toBeNull();
    expect(targetAtTick(expansion(tags), undefined)).toBeNull();
    expect(targetAtTick(expansion(tags), "abc")).toBeNull();
  });

  it("currentTick 对应的目标格带 data-playing=true（播放中高亮）", () => {
    render(
      <PracticeBoard isr={isr()} expansion={expansion([target(6, 0)])} currentTick="480" />,
    );
    const playing = screen
      .getByTestId("practice")
      .querySelector(`[data-string="6"][data-fret="0"].fretCell`);
    expect(playing?.getAttribute("data-playing")).toBe("true");
    expect((playing as HTMLElement).className).toContain("playing");
  });
});
