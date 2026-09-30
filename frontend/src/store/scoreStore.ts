import { create } from "zustand";
import type { InternalScore } from "../parser/isr";
import type { PlaybackExpansion } from "../score/playbackTypes";

/** 导入器状态。 */
export type ImporterState =
  | { kind: "idle" }
  | { kind: "loading"; fileName: string }
  | { kind: "done"; fileName: string }
  | { kind: "error"; fileName: string; message: string };

export interface PracticeStore {
  /** 当前内部谱面（ISR）。 */
  isr: InternalScore | null;
  /** 当前播放展开（targets/occurrences）。 */
  expansion: PlaybackExpansion | null;
  /** 导入器状态。 */
  importer: ImporterState;

  setImported: (fileName: string, isr: InternalScore, expansion: PlaybackExpansion) => void;
  setLoading: (fileName: string) => void;
  setImportError: (fileName: string, message: string) => void;
  clear: () => void;
}

export const usePracticeStore = create<PracticeStore>((set) => ({
  isr: null,
  expansion: null,
  importer: { kind: "idle" },
  setImported: (fileName, isr, expansion) => set({ isr, expansion, importer: { kind: "done", fileName } }),
  setLoading: (fileName) => set({ importer: { kind: "loading", fileName } }),
  setImportError: (fileName, message) => set({ importer: { kind: "error", fileName, message } }),
  clear: () => set({ isr: null, expansion: null, importer: { kind: "idle" } }),
}));

/** 兼容旧 module-store API（供既有 scoreStore.test.ts；不改其文件）。 */
export type ImportStatus =
  | { kind: "idle" }
  | { kind: "loading"; fileName: string }
  | { kind: "done"; fileName: string; score: InternalScore }
  | { kind: "error"; fileName: string; error: Error };

export function getImportStatus(): ImportStatus {
  const s = usePracticeStore.getState();
  switch (s.importer.kind) {
    case "idle": return { kind: "idle" };
    case "loading": return { kind: "loading", fileName: s.importer.fileName };
    case "done": return { kind: "done", fileName: s.importer.fileName, score: s.isr! };
    case "error": return { kind: "error", fileName: s.importer.fileName, error: new Error(s.importer.message) };
  }
}

export function resetImport(): void {
  usePracticeStore.getState().clear();
}

export function setLoading(fileName: string): void {
  usePracticeStore.getState().setLoading(fileName);
}

export function setDone(fileName: string, score: InternalScore): void {
  usePracticeStore.setState({ isr: score, importer: { kind: "done", fileName } });
}

export function setImportError(fileName: string, error: Error): void {
  usePracticeStore.getState().setImportError(fileName, error instanceof Error ? error.message : String(error));
}
