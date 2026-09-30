import { describe, expect, it } from "vitest";
import { detectGpVersion, importGpToIsr, parseWithAlphaTab, ScoreImportError } from "./importer";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("detectGpVersion", () => {
  it("识别 GP5 版本头", () => {
    const bytes = utf8("FICHIER GUITAR PRO v5.00xxxx");
    const r = detectGpVersion(bytes);
    expect(r.detected).toBe(true);
    expect(r.gp).toBe("gp5");
  });
  it("非 GP 输入判为 unknown", () => {
    const r = detectGpVersion(utf8("garbage not guitar pro"));
    expect(r.detected).toBe(false);
    expect(r.gp).toBe("unknown");
  });
});

describe("ScoreImportError / parseWithAlphaTab 错误", () => {
  it("对非 GP 输入抛 ScoreImportError 而非返回空", () => {
    // 任意非 GP 字节：alphaTab 无法识别 → 应抛 ScoreImportError
    expect(() => parseWithAlphaTab(utf8("not a guitar pro binary format payload"))).toThrow(ScoreImportError);
  });
  it("parse 失败归类为 parse/unsupported，且带可读信息", () => {
    try {
      parseWithAlphaTab(utf8("garbage"));
      throw new Error("应当抛出");
    } catch (e) {
      expect(e).toBeInstanceOf(ScoreImportError);
      expect((e as ScoreImportError).kind).toMatch(/parse|unsupported/);
      expect((e as ScoreImportError).message).toContain("alphaTab 解析失败");
    }
  });
});

describe("importGpToIsr — 便捷入口错误传递", () => {
  it("非 GP 输入会抛错，不会伪造 ISR", () => {
    expect(() => importGpToIsr(utf8("garbage"))).toThrow(ScoreImportError);
  });
});
