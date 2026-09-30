// 复现 out.gp（alphaTab 1.8.4 Gp7Exporter.export）。
// 运行：node gen_gp.mjs   （需在 frontend/ 下安装 @coderline/alphatab；脚本用项目 node_modules）
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const alphatab = require("@coderline/alphatab");
const { exporter, model } = alphatab;

const OUT = fileURLToPath(new URL("out.gp", import.meta.url));

function buildGp() {
  const g = new model.Score();
  g.title = "GP Fixture";
  const t = new model.Track();
  t.name = "Guitar";
  t.ensureStaveCount(1);
  t.staves[0].stringTuning.tunings = [64, 59, 55, 50, 45, 40]; // 保序
  t.staves[0].capo = 0;
  g.addTrack(t);
  const mb = new model.MasterBar();
  mb.timeSignatureNumerator = 4;
  mb.timeSignatureDenominator = 4;
  mb.tempoAutomations.push(model.Automation.buildTempoAutomation(false, 0, 120, 0, true));
  g.addMasterBar(mb);
  const bar = new model.Bar();
  t.staves[0].addBar(bar);
  const v = new model.Voice();
  bar.addVoice(v);
  const low = new model.Beat();
  const l = new model.Note();
  l.string = 1; // 低弦
  l.fret = 2;
  low.addNote(l);
  v.addBeat(low);
  const high = new model.Beat();
  const h = new model.Note();
  h.string = 6; // 高弦
  h.fret = 3;
  high.addNote(h);
  v.addBeat(high);
  return new exporter.Gp7Exporter().export(g);
}

writeFileSync(OUT, Buffer.from(buildGp()));
console.log("wrote", path.basename(OUT), statSync(OUT).size, "bytes");
