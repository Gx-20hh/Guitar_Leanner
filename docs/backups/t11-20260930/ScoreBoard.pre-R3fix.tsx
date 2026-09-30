import { useState } from "react";
import { importGpToIsr } from "../parser/importer";
import type { InternalScore, IsrBeat, IsrNote } from "../parser/isr";

/** 声部级六线谱块。每个声部独立成块并带标签；不把“数组下标”当作跨声部时间对齐。 */
export interface VoiceTab {
  label: string;
  rows: string[][];
}

type GuitarTrack = InternalScore["tracks"][number];
type GuitarMeasure = GuitarTrack["measures"][number];

/** 把一拍转换为各弦行细胞：和弦（多音）共享同一拍（同列、不同弦行），同弦多音以 / 并列。 */
function cellsForBeat(beat: IsrBeat, stringCount: number): Map<number, string> {
  const cells = new Map<number, string>();
  for (const note of beat.notes as IsrNote[]) {
    const rowIndex = note.stringNumber - 1;
    if (rowIndex >= 0 && rowIndex < stringCount) {
      const previous = cells.get(rowIndex) ?? "";
      cells.set(rowIndex, previous ? `${previous}/${note.fret}` : String(note.fret));
    }
  }
  return cells;
}

/**
 * 由 ISR 音轨生成声部级块网格。
 * 每个声部独立成块：块内列 = 该声部的一拍；同拍和弦共享列（不同弦行）；休止拍整列 "·";
 * 该声部的小节之间以 "|" 分隔。不同声部不按数组下标对齐（不作虚假同时发声）。
 * 行 = 一弦：stringNumber 1 = 最高音弦（顶行）。
 * 零弦 / 非六线音轨（stringCount < 1）返回 null：不渲染、不伪造品、不崩溃。
 */
function readFileContent(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsArrayBuffer(file);
  });
}

export function buildGrid(track: GuitarTrack | null): VoiceTab[] | null {
  if (!track || !Number.isInteger(track.stringCount) || track.stringCount < 1) return null;
  const stringCount = track.stringCount;
  const measures = (track.measures ?? []) as GuitarMeasure[];
  const voiceCount = measures.reduce(
    (maximum, measure) => Math.max(maximum, (measure.voices ?? []).length),
    0,
  );
  const blocks: VoiceTab[] = [];
  for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex += 1) {
    const rows: string[][] = Array.from({ length: stringCount }, () => []);
    let column = 0;
    const measuresWithVoice = measures.filter(
      (measure) => (measure.voices ?? [])[voiceIndex] !== undefined,
    );
    measuresWithVoice.forEach((measure, measureIndex) => {
      if (measureIndex > 0) {
        for (let rowIndex = 0; rowIndex < stringCount; rowIndex += 1) rows[rowIndex][column] = "|";
        column += 1;
      }
      const voice = (measure.voices ?? [])[voiceIndex];
      for (let beatIndex = 0; beatIndex < voice.length; beatIndex += 1) {
        const cells = cellsForBeat(voice[beatIndex], stringCount);
        for (let rowIndex = 0; rowIndex < stringCount; rowIndex += 1) {
          rows[rowIndex][column] = cells.get(rowIndex) ?? "·";
        }
        column += 1;
      }
    });
    for (let rowIndex = 0; rowIndex < stringCount; rowIndex += 1) {
      for (let cellIndex = rows[rowIndex].length; cellIndex < column; cellIndex += 1) {
        rows[rowIndex][cellIndex] = "·";
      }
    }
    blocks.push({ label: `声部 ${voiceIndex + 1}`, rows });
  }
  return blocks;
}

function DefaultImport(content: Uint8Array): Promise<InternalScore> {
  return Promise.resolve(importGpToIsr(content));
}

/** 渲染单个声部块。 */
function VoiceTabBlock({ block }: { block: VoiceTab }) {
  return (
    <pre className="tab" data-testid="tab">
      {block.label}
      {"\n"}
      {block.rows.map((row) => row.join(" ")).join("\n")}
    </pre>
  );
}

/**
 * 最小谱面工作台：文件导入(GP/GP5/GP4/GP3) → ISR → 选音轨 → 声部分块六线谱。
 * 全程无浏览器音频（不创建 AudioContext、不播放）。
 * 导入控件与错误提示在已导入后仍保留：可替换谱面；替换失败时保留先前谱面并显示错误。
 */
export function ScoreBoard({
  initialScore,
  importFn = DefaultImport,
}: {
  initialScore?: InternalScore;
  importFn?: (content: Uint8Array) => Promise<InternalScore>;
}) {
  const [fileState, setFileState] = useState<{ fileName: string; score: InternalScore } | null>(
    initialScore ? { fileName: "(内置示例)", score: initialScore } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [pending, setPending] = useState(false);

  function onFile(file: File) {
    setPending(true);
    setError(null);
    readFileContent(file)
      .then((content) => importFn(content))
      .then((score) => {
        setFileState({ fileName: file.name, score });
        setSelectedTrack(0);
      })
      .catch((caught: Error) => {
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => setPending(false));
  }

  function onDrop(dragged: React.DragEvent) {
    dragged.preventDefault();
    const file = dragged.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }

  const score = fileState ? fileState.score : null;
  const trackIndex =
    score && score.tracks.length > 0 ? Math.min(selectedTrack, score.tracks.length - 1) : 0;
  const track = score ? score.tracks[trackIndex] ?? null : null;
  const blocks = track ? buildGrid(track) : null;

  return (
    <section className="board" data-testid="board">
      <h2>谱面导入与六线谱</h2>
      <div className="drop" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <label htmlFor="gpFile">选择 GP/GP5/GP4/GP3 谱面文件（可替换当前谱面）</label>
        <input
          id="gpFile"
          type="file"
          accept=".gp,.gp5,.gp4,.gp3"
          disabled={pending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onFile(file);
          }}
        />
        {error ? <p className="err">{error}</p> : <p>或拖放谱面。仅读谱与渲染，不播放音频。</p>}
      </div>
      {score ? (
        <div>
          <div className="boardMeta">
            <span>{fileState ? fileState.fileName : ""}</span>
            <label htmlFor="trackSel">音轨</label>
            <select
              id="trackSel"
              value={trackIndex}
              onChange={(event) => setSelectedTrack(Number(event.currentTarget.value))}
            >
              {score.tracks.map((entry, index) => (
                <option key={index} value={index}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <div className="tabWrap">
            {blocks
              ? blocks.map((block) => <VoiceTabBlock key={block.label} block={block} />)
              : (
                <div className="tab" data-testid="tab">
                  （非六线/无弦音轨：不渲染六线谱）
                </div>
              )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
