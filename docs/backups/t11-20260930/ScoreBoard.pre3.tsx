import { useState } from "react";
import { importGpToIsr } from "../parser/importer";
import type { InternalScore, IsrMeasure } from "../parser/isr";

/** 以 ISR 渲染某音轨为一个六线谱行。每列一拍，行=一弦。 */
function TabRow({ track }: { track: InternalScore["tracks"][number] }) {
  const stringCount = track.stringCount;
  const rows: string[][] = Array.from({ length: stringCount }, () => []);
  for (const measure of track.measures as IsrMeasure[]) {
    for (const voice of measure.voices) {
      for (const beat of voice) {
        for (const note of beat.notes) {
          // 顶行 = 最高音弦（stringNumber 方向随格式而定，归一化属后续校准）
          const r = stringCount - note.stringNumber;
          if (r >= 0 && r < rows.length) rows[r].push(String(note.fret));
          else rows[0].push(String(note.fret));
        }
      }
    }
  }
  const max = Math.max(...rows.map((r) => r.length), 1);
  for (const r of rows) while (r.length < max) r.push("-");

  return (
    <pre className="tab">
      {rows
        .map((r) => r.join(" "))
        .join("\n")}
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
