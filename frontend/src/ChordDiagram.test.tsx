import { render, screen } from "./test-utils";
import { describe, expect, it } from "vitest";
import { ChordDiagram, CHORD_FRETS, CHORD_STRINGS } from "./ChordDiagram";

describe("ChordDiagram", () => {
  it("渲染和弦名与 6 弦 5 品格网格", () => {
    render(<ChordDiagram chord={{ name: "Am", marks: [] }} />);
    expect(screen.getByText("Am")).toBeTruthy();
    for (let s = 1; s <= CHORD_STRINGS; s++) {
      expect(screen.getByTestId(`string-${s}`)).toBeTruthy();
    }
    for (let f = 1; f <= CHORD_FRETS; f++) {
      expect(screen.getByTestId(`chordRow-${f}`)).toBeTruthy();
    }
  });

  it("网格内标记品格显示 marker、未标记显示 cell", () => {
    render(<ChordDiagram chord={{ name: "Em", marks: [{ string: 6, fret: 2 }, { string: 5, fret: 2 }] }} />);
    expect(screen.getByTestId("marker-6-2")).toBeTruthy();
    expect(screen.getByTestId("marker-5-2")).toBeTruthy();
    expect(screen.getByTestId("cell-1-1")).toBeTruthy(); // 未标记
    expect(screen.queryByTestId("marker-1-1")).toBeNull();
  });
});
