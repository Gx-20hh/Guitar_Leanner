# tests/score-fixtures — GP 谱例与生成器（T11）

## 谱例来源与许可（均为自产、内容已知；无第三方许可负担）
- `out.gp5`：PyGuitarPro 生成（`import guitarpro`），`gen_fixtures.py` 可复现。**约定标准调弦**
  `string1=64(高 e)…string6=40(低 E)`=`[64,59,55,50,45,40]`（保物理弦序，不按音高排序）。
  标题 "GP5 Fixture"、tempo 120、单音轨 "Guitar" 四四拍；两拍皆 fret0（高弦→64，低弦→40）。
- `out.gp`：alphaTab 1.8.4 `Gp7Exporter.export()` 生成并持久化（2570B），内容同约定调弦；
  生成方式见 `frontend/src/parser/gp-export.test.ts`（buildGp）。
- 记录（对齐框架 §6.1）：解析器 `@coderline/alphatab@1.8.4`；生成器脚本可复现；无第三方样本，
  故无第三方授权/哈希负担（若将来引入第三方样本须记录来源/授权/哈希）。

## 生成器
- `python gen_fixtures.py` 重新生成 `out.gp5`。注意 PyGuitarPro 构造预置默认轨/弦/拍号(Duration 对象)，
  脚本复用默认对象并改写；`Note` 须显式 `b.notes.append(n)`，否则音符不落。
- PyGuitarPro 模型**无 capo 字段**，GP5 无法写入 capo（capo 经 GP 导出回导覆盖，见验证文档）。

## 说明
根 `.gitignore` 忽略 `*.gp*`，但对 `tests/score-fixtures/*.gp5` 及 `*.gp` 授权测试目录放行，与用户曲库隔离。
