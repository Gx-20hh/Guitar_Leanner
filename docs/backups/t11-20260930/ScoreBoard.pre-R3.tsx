import { useState } from "react";
import { importGpToIsr } from "../parser/importer";
import type { InternalScore, IsrBeat, IsrMeasure, IsrNote } from "../parser/isr";

/**
 * 由 ISR 音轨生成六线谱网格（纯函数，便于测试）。
 * 语义：
 * - 列 = 一拍。同一拍内音符（和弦）共享同一列（不同弦行各占格）。
 * - 休止拍 = 整列空格 "·"（列保留）。
 * - 小节之间以 "|" 分隔（小节边界保留）。
 * - 行 = 一弦：stringNumber 1 = 最高弦（顶行）。
 * - 非 / 零弦音轨（stringCount<1）返回 null（不渲染、不伪造品、不崩 rows[0]）。
 * @returns string[][]（rows[r][col]）或 null。
 */
export function buildGrid(track: InternalScore["tracks"][number] | null): string[][] | null {
  if (!track || !Number.isInteger(track.stringCount) || track.stringCount < 1) return null;
  const stringCount = track.stringCount;
  const rows: string[][] = Array.from({ length: stringCount }, () => []);
  let col = 0;
  const measures = (track.measures ?? []) as IsrMeasure[];
  measures.forEach((m, mi) => {
    if (mi > 0) {
      for (const r of rows) r[col] = "|"; // 小节边界
      col += 1;
    }
    const voices = (m.voices ?? []) as IsrBeat[][];
    const cols = Math.max(0, ...voices.map((v) => v.length));
    for (let c = 0; c < cols; c += 1) {
      const byString = new Map<number, string>();
      for (const voice of voices) {
        const beat = voice[c];
        if (!beat) continue;
        for (const note of beat.notes as IsrNote[]) {
          const r = note.stringNumber - 1;
          if (r >= 0 && r < stringCount) {
            const cur = byString.get(r) ?? "";
            byString.set(r, cur ? `${cur}/${note.fret}` : String(note.fret));
          }
        }
      }
      for (let r = 0; r < stringCount; r += 1) rows[r][col] = byString.get(r) ?? "·";
      col += 1;
    }
  });
  for (const r of rows) for (let i = r.length; i < col; i += 1) r[i] = "·";
  return rows;
}

function TabRow({ track }: { track: InternalScore["tracks"][number] }) {
  const grid = buildGrid(track);
  if (grid === null) {
    return <pre className="tab">（非六线/无弦音轨：不渲染六线谱）</pre>;
  }
  return (
    <pre className="tab" data-testid="tab">
      {grid.map((r) => r.join(" ")).join("\n")}
    </pre>
  );
}

/**
 * 最小谱面工作台：文件导入(GP/GP5/GP4/GP3) → ISR → 选音轨 → 六线谱渲染。
 * 全程无浏览器音频（不创建 AudioContext、不播放）。
 */
export function ScoreBoard({ initialScore }: { initialScore?: InternalScore }) {
  const [fileState, setFileState] = useState<{
    fileName: string;
    score: InternalScore;
  } | null>(initialScore ? { fileName: "(fixture)", score: initialScore } : null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState(0);

  function onFile(file: File) {
    setError(null);
    file
      .arrayBuffer()
      .then((buf) => importGpToIsr(new Uint8Array(buf)))
      .then((score) => {
        setFileState({ fileName: file.name, score });
        setSelectedTrack(0);
      })
      .catch((e: Error) => setError(e instanceof Error ? e.message : String(e)));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  }

  const score = fileState?.score ?? null;
  const track = score ? score.tracks[selectedTrack] ?? null : null;

  return (
    <section className="board" data-testid="board">
      <h2>谱面导入与六线谱</h2>
      {score ? (
        <>
          <div className="boardMeta">
            <span>{fileState?.fileName}</span>
            <label htmlFor="trackSel">音轨</label>
            <select
              id="trackSel"
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(Number(e.currentTarget.value))}
            >
              {score.tracks.map((t, i) => (
                <option key={i} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {track ? (
            <div className="tabWrap">
              <TabRow track={track} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <label htmlFor="gpFile">选择 GP/GP5/GP4/GP3 谱面文件</label>
          <input
            id="gpFile"
            type="file"
            accept=".gp,.gp5,.gp4,.gp3"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) onFile(f);
            }}
          />
          {error ? <p className="err">{error}</p> : <p>或拖放到此处。仅读谱与渲染，不播放音频。</p>}
        </div>
      )}
    </section>
  );
}
