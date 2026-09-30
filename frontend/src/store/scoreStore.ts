/**
 * 曲库 / 导入结果的最小 store。
 *
 * T11 范围：承载一次导入结果的 ISR 与状态。后续 T12/T19 在此扩展曲库索引。
 * 保持桥接导向：store 只保存稳定 ISR DTO，不保存 alphaTab 可变对象。
 */
import type { InternalScore } from "../parser/isr";
import type { ScoreImportError } from "../parser/importer";

export type ImportStatus =
  | { kind: "idle" }
  | { kind: "loading"; fileName: string }
  | { kind: "done"; fileName: string; score: InternalScore }
  | { kind: "error"; fileName: string; error: Error };

/** 进程内单例状态（简单实现；后续可接入持久化曲库）。 */
let current: ImportStatus = { kind: "idle" };

export function getImportStatus(): ImportStatus {
  return current;
}

export function setLoading(fileName: string): void {
  current = { kind: "loading", fileName };
}

export function setDone(fileName: string, score: InternalScore): void {
  current = { kind: "done", fileName, score };
}

export function setImportError(fileName: string, error: Error): void {
  // 归一化错误（ScoreImportError 保留 kind）
  current = { kind: "error", fileName, error };
}

export function markScoreImportError(fileName: string, error: ScoreImportError): void {
  setImportError(fileName, error);
}

export function resetImport(): void {
  current = { kind: "idle" };
}
