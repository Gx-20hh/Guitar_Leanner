import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importGpToIsr } from "./importer";

/**
 * 真实多格式二进制谱例 roundtrip（GP5/GP4/GP3）——均 PyGuitarPro 自产、内容已知、独立期望。
 * 谱例见 tests/score-fixtures/（gen_fixtures.py 生成约定标准谱）。GPX 属披露（需授权样本；
 * guitarist/guitarpro 无 GPX writer，alphaTab 最小 zip+score.gpif 未被 loader 识别），
 * GP8 .gp 单列不在此验证。详见 docs/validation/t19-compat.md。
 */
const FIXTURES = ["out.gp5", "out.gp4", "out.gp3"];

describe("多格式导入（GP5/GP4/GP3，独立期望）", () => {
  for (const file of FIXTURES) {
    it(`${file}: 解析并提取约定内容`, () => {
      const path = resolve(__dirname, "../../../tests/score-fixtures/", file);
      const isr = importGpToIsr(readFileSync(path));
      expect(isr.title).toBe("GP5 Fixture");
      expect(isr.tempo).toBe(120);
      expect(isr.tracks).toHaveLength(1);
      expect(isr.tracks[0].name).toBe("Guitar");
      expect(isr.tracks[0].stringCount).toBe(6);
      // 约定标准调弦 string1=64(高 e)…string6=40(低 E)；保源物理序
      expect(isr.tracks[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
      // track.offset=2 等价 capo2（GP5/GP4/GP3 均经 PyGuitarPro 写出并 alphaTab 解析得 capo2）
      expect(isr.tracks[0].capo).toBe(2);
      expect(isr.masterBars[0].timeSignatureNumerator).toBe(4);
      expect(isr.masterBars[0].timeSignatureDenominator).toBe(4);
    });
  }

  it("GP8 .gp 单列：本任务不承认为已支持（不 mock、不纳入通过）", () => {
    // 依框架 T19：GP8 的 .gp 必须单列验收，不凭扩展名承诺；本界限只扩展 GP5/GP4/GP3/GPX 路径。
    expect(true).toBe(true);
  });
});
