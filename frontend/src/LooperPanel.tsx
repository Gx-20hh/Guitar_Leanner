import { useState } from "react";

/** 空占位 props（尚未接入原生录音；后续扩展）。 */
export interface LooperPanelProps {}

export const LOOPER_TRACK_COUNT = 4;
export type TrackStatus = "idle" | "recording" | "playing" | "overdub" | "stopped";

export interface LoopTrack {
  status: TrackStatus;
}

/** 4 轨循环录音 UI：每轨 record/play/stop/overdub。无浏览器音频（操控占位，原生接入后替换）。 */
export function LooperPanel(_props: LooperPanelProps) {
  const [tracks, setTracks] = useState<LoopTrack[]>(
    Array.from({ length: LOOPER_TRACK_COUNT }, () => ({ status: "idle" })),
  );

  function setTrack(index: number, status: TrackStatus) {
    setTracks((prev) => prev.map((track, i) => (i === index ? { status } : track)));
  }

  function toggle(index: number, status: TrackStatus) {
    setTracks((prev) =>
      prev.map((track, i) => (i === index ? { status: track.status === status ? "idle" : status } : track)),
    );
  }

  return (
    <section className="looper" data-testid="looperPanel">
      <h2>Loop 录音（4 轨）</h2>
      <div className="looperTracks" data-testid="looperTracks">
        {tracks.map((track, index) => (
          <div className="looperTrack" data-testid={`track-${index}`} data-status={track.status} key={index}>
            <span className="trackLabel">轨 {index + 1}</span>
            <button type="button" onClick={() => toggle(index, "recording")}>录音</button>
            <button type="button" onClick={() => toggle(index, "playing")}>播放</button>
            <button type="button" onClick={() => setTrack(index, "stopped")}>停止</button>
            <button type="button" onClick={() => toggle(index, "overdub")}>过录</button>
            <span className="trackStatus" data-testid={`trackStatus-${index}`}>
              {track.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
