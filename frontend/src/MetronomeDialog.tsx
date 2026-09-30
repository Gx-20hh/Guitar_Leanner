import { useState } from "react";

/** 节拍器预设拍号。 */
export const METRONOME_BEATS = ["4/4", "3/4", "6/8"] as const;
/** 节拍器预设细分。 */
export const METRONOME_SUBS = ["1/4", "1/8", "1/16"] as const;

export interface MetronomeDialogProps {
  initialBpm: number;
  initialBeats: string;
  initialSub: string;
  onApply: (bpm: number, beats: string, sub: string) => void;
  onClose?: () => void;
}

/** 节拍器设置对话框：BPM、拍号、细分；Apply 回调回传配置。 */
export function MetronomeDialog({ initialBpm, initialBeats, initialSub, onApply, onClose }: MetronomeDialogProps) {
  const [bpm, setBpm] = useState(String(initialBpm));
  const [beats, setBeats] = useState(initialBeats);
  const [sub, setSub] = useState(initialSub);

  const bpmNumber = Number(bpm);

  function submit() {
    const nextBpm = Number.isFinite(bpmNumber) && bpmNumber > 0 ? Math.round(bpmNumber) : 0;
    onApply(nextBpm, beats, sub);
  }

  return (
    <div className="dialog" data-testid="metronomeDialog" role="dialog" aria-label="节拍器设置">
      <div className="dialogBody">
        <h2>节拍器</h2>
        <label htmlFor="bpmInput">BPM</label>
        <input
          id="bpmInput"
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={(event) => setBpm(event.currentTarget.value)}
        />
        <label htmlFor="beatsSelect">拍号</label>
        <select
          id="beatsSelect"
          value={beats}
          onChange={(event) => setBeats(event.currentTarget.value)}
        >
          {METRONOME_BEATS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label>细分</label>
        <div className="subRow">
          {METRONOME_SUBS.map((option) => (
            <label key={option} className="subOption">
              <input
                type="radio"
                name="subdivision"
                value={option}
                checked={sub === option}
                onChange={() => setSub(option)}
              />
              {option}
            </label>
          ))}
        </div>
        <div className="dialogActions">
          {onClose ? (
            <button type="button" onClick={onClose}>
              取消
            </button>
          ) : null}
          <button type="button" onClick={submit}>
            应用
          </button>
        </div>
      </div>
    </div>
  );
}
