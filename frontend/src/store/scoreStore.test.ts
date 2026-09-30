import { describe, expect, it } from "vitest";
import { model } from "@coderline/alphatab";
import { toIsr } from "../parser/importer";
import type { ImportStatus } from "./scoreStore";
import {
  getImportStatus,
  resetImport,
  setDone,
  setImportError,
  setLoading,
} from "./scoreStore";

function statusOf(): ImportStatus {
  return getImportStatus();
}

describe("scoreStore", () => {
  it("初始 idle，loading/done/error 状态流转正确", () => {
    resetImport();
    expect(statusOf().kind).toBe("idle");

    setLoading("x.gp5");
    expect(statusOf().kind).toBe("loading");
    let s = statusOf();
    expect(s.kind === "loading" && s.fileName).toBe("x.gp5");

    const score = new model.Score();
    score.title = "T";
    setDone("x.gp5", toIsr(score));
    s = statusOf();
    expect(s.kind === "done" && s.score.title).toBe("T");

    setImportError("x.gp5", new Error("boom"));
    s = statusOf();
    expect(s.kind === "error" && s.error.message).toBe("boom");

    resetImport();
    expect(statusOf().kind).toBe("idle");
  });

  it("仅保存稳定 ISR DTO，不保存 alphaTab 对象", () => {
    setDone("f", toIsr(new model.Score()));
    const st = statusOf();
    expect(st.kind === "done" && st.score.tracks).toEqual([]);
    expect(st.kind === "done" && st.score.title).toBeTypeOf("string");
  });
});
