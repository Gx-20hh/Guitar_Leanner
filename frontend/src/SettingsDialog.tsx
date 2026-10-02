import { useState } from "react";

/** 可配置采样/频率设置。 */
export interface AudioSettings {
  a4: number;
  bufferSize: number;
  sampleRate: number;
}

export interface SettingsDialogProps {
  initial: AudioSettings;
  onApply: (settings: AudioSettings) => void;
}

export const BUFFER_OPTIONS = [128, 256, 512];
export const SAMPLE_RATE_OPTIONS = [44100, 48000];

/** 设置对话框：A4 参考频率、缓冲尺寸、采样率。 */
export function SettingsDialog({ initial, onApply }: SettingsDialogProps) {
  const [a4, setA4] = useState(String(initial.a4 ?? 440));
  const [bufferSize, setBufferSize] = useState(initial.bufferSize ?? 128);
  const [sampleRate, setSampleRate] = useState(initial.sampleRate ?? 48000);

  return (
    <div className="dialog" data-testid="settingsDialog" role="dialog" aria-label="设置">
      <h2>设置</h2>
      <label htmlFor="a4Input">A4 参考频率 (Hz)</label>
      <input
        id="a4Input"
        type="number"
        min={400}
        max={480}
        step={1}
        value={a4}
        onChange={(event) => setA4(event.currentTarget.value)}
      />
      <label htmlFor="bufferSelect">缓冲尺寸</label>
      <select
        id="bufferSelect"
        value={bufferSize}
        onChange={(event) => setBufferSize(Number(event.currentTarget.value))}
      >
        {BUFFER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label htmlFor="sampleRateSelect">采样率</label>
      <select
        id="sampleRateSelect"
        value={sampleRate}
        onChange={(event) => setSampleRate(Number(event.currentTarget.value))}
      >
        {SAMPLE_RATE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onApply({ a4: Number(a4) || 440, bufferSize, sampleRate })}>
        应用
      </button>
    </div>
  );
}
