# tests/score-fixtures — GP 谱例与生成器（T11，R2）

## 谱例来源与许可（均为自产、内容已知；无第三方许可负担）
- `out.gp5`：PyGuitarPro 生成（`import guitarpro`），`gen_fixtures.py` 可复现。**约定标准调弦**
  `string1=64(高 e)…string6=40(低 E)`=`[64,59,55,50,45,40]`（保物理弦序，不按音高排序）。
  `track.offset=2`（capo 品位 2；PyGuitarPro 以 track.offset 表示 capo，见 GP5File.writeTrack）。
  四四拍、tempo 120、单音轨 "Guitar"；两拍皆 fret0（高弦→64+capo2=66，低弦→40+capo2=42）。
- `out.gp`：alphaTab 1.8.4 `Gp7Exporter.export()` 生成并持久化（2581B），同约定调弦；含 tempo
  automation（BPM120，`Automation.buildTempoAutomation`）、两拍不同品（低弦 fr2、高弦 fr3）。
  生成方式见 `tests/score-fixtures/gen_gp.mjs`（`node gen_gp.mjs`，需 frontend/ 内已装
  `@coderline/alphatab` 时可在 project 上下文运行，或用 `gp-export.test.ts` 的 buildGp 逻辑）。
- 记录（对齐框架 §6.1）：解析/导出器 `@coderline/alphatab@1.8.4`；生成脚本可复现；无第三方样本。

## 生成器
- `python gen_fixtures.py` 重新生成 `out.gp5`。注意 PyGuitarPro 构造预置默认轨/弦/拍号(Duration 对象)，
  脚本复用默认对象并改写；`Note` 须显式 `b.notes.append(n)`；capo 用 `track.offset`。

## 说明
根 `.gitignore` 忽略 `*.gp*`，但对 `tests/score-fixtures/*.gp5` 及 `*.gp` 授权测试目录放行，与用户曲库隔离。
