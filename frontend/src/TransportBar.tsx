import { useEffect, useState } from "react";
import { queryTransportPosition, sendPlaybackCommand, type TransportCommand, type TransportNative } from "./bridge/transport";
import { usePracticeStore } from "./store/scoreStore";

export interface TransportBarProps {
  transport?: TransportNative;
}

export const TRANSPORT_POLL_MS = 100; // M0 视觉目标 ≤50ms 的一半分辨率；位置经 store 共享

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function TransportBar({ transport }: TransportBarProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState("0");
  const [seconds, setSeconds] = useState("0.00");
  const [status, setStatus] = useState<string | null>(null);
  const setTransportPosition = usePracticeStore((store) => store.setTransportPosition);

  async function runCommand(command: TransportCommand, nextSpeed?: number) {
    if (command === "play") {
      setPlaying(true); // 乐观播放，使随后的改速能重发
      setTransportPosition(tick, true);
    }
    const reply = await sendPlaybackCommand(command, { transport, speed: nextSpeed ?? speed });
    if (!reply.ok) {
      setStatus(`未连接/失败：${reply.reason}`);
      setPlaying(false);
      setTransportPosition(null, false);
      return;
    }
    setStatus(null);
    if (command === "pause" || command === "stop") {
      setPlaying(false);
      setTransportPosition(command === "stop" ? "0" : tick, false);
      if (command === "stop") {
        setTick("0");
        setSeconds("0.00");
      }
    }
  }

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      void queryTransportPosition({ transport }).then((q) => {
        if (!q.ok) {
          setPlaying(false);
          setStatus(`未连接/失败：${q.reason}`);
          setTransportPosition(null, false);
          return;
        }
        setTick(q.positionTick);
        setSeconds(q.positionSeconds.toFixed(2));
        setTransportPosition(q.positionTick, q.playing);
      });
    }, TRANSPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [playing, transport]);

  return (
    <section className="transport" data-testid="transportBar">
      <div className="transportButtons">
        <button type="button" onClick={() => void runCommand("play")}>播放</button>
        <button type="button" onClick={() => void runCommand("pause")}>暂停</button>
        <button type="button" onClick={() => void runCommand("stop")}>停止</button>
      </div>
      <label className="speedRow">
        速度
        <select
          aria-label="速度"
          value={speed}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            setSpeed(next);
            if (playing) void runCommand("play", next);
          }}
        >
          {SPEEDS.map((option) => <option key={option} value={option}>{option.toFixed(2)}</option>)}
        </select>
      </label>
      <div className="transportPosition" data-testid="transportPosition">
        tick {tick} · {seconds}s
      </div>
      {status ? <div className="err" data-testid="transportStatus">{status}</div> : null}
    </section>
  );
}
