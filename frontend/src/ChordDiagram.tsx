/**
 * 和弦图：6 弦 × 5 品格网格，标记品格以圆圈显示。
 * 弦序 1=最高音弦（网格顶部）；品格行从 1 到 5 向下。无浏览器音频。
 */

export interface ChordMark {
  string: number;
  fret: number;
}

export interface Chord {
  name: string;
  marks: ChordMark[];
}

export const CHORD_STRINGS = 6;
export const CHORD_FRETS = 5;

/** 和弦图面板。 */
export function ChordDiagram({ chord }: { chord: Chord }) {
  const markSet = new Set(chord.marks.map((m) => `${m.string}-${m.fret}`));

  return (
    <section className="chord" data-testid="chordDiagram">
      <h3>{chord.name}</h3>
      <div className="chordGrid" data-testid="chordGrid">
        <div className="chordStrings">
          {Array.from({ length: CHORD_STRINGS }, (_, i) => (
            <span className="chordString" data-testid={`string-${i + 1}`} key={i}>
              {i + 1}
            </span>
          ))}
        </div>
        {Array.from({ length: CHORD_FRETS }, (_, fretIndex) => (
          <div className="chordRow" data-testid={`chordRow-${fretIndex + 1}`} key={fretIndex}>
            <span className="chordFret">{fretIndex + 1}</span>
            {Array.from({ length: CHORD_STRINGS }, (_, stringIndex) => {
              const stringNumber = stringIndex + 1;
              const fretNumber = fretIndex + 1;
              const hit = markSet.has(`${stringNumber}-${fretNumber}`);
              return (
                <span
                  className={hit ? "chordMarker" : "chordCell"}
                  data-testid={hit ? `marker-${stringNumber}-${fretNumber}` : `cell-${stringNumber}-${fretNumber}`}
                  key={stringIndex}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
