# tests/score-fixtures — GP 谱例与生成器（T11）

## 谱例来源与许可
本目录谱例均为**自产、内容已知**（无第三方许可问题）：
- `out.gp5`：PyGuitarPro 生成（`import guitarpro`），内容由 `gen_fixtures.py` 定义
  （标题 "GP5 Fixture"、tempo 120、单音轨 "Guitar" 六弦 40/45/50/55/59/64、四四拍、
  两拍：D3fret0(F)、A2fret3(MP, hammer)）。PyGuitarPro 为 pip 的 `PyGuitarPro` 分发，
  `import guitarpro`（本机已装）。
- GP：alphaTab 1.8.4 `Gp7Exporter.export()` 在测试内生成 `.gp` 字节（不自持文件），见
  `frontend/src/parser/gp-export.test.ts`。

记录（对齐框架 §6.1）：解析器版本 `@coderline/alphatab@1.8.4`；生成器 `gen_fixtures.py`
可复现；无第三方谱例，因此无第三方授权/哈希负担（自行生成则无，但如需第三方样本应记录
来源、授权、哈希）。

## 生成器
- `gen_fixtures.py`：`python gen_fixtures.py` 重新生成 `out.gp5`。
  注意 PyGuitarPro 模型会在构造时预置默认轨/弦/拍号(Duration 对象)，脚本复用默认对象并
  改写（`b.notes.append(n)` 必须显式），避免多余轨/弦、拍号 int 报错。

## 说明
根 `.gitignore` 忽略 `*.gp*`，但对 `tests/score-fixtures/*.gp5` 等授权测试目录放行，
与用户曲库隔离（不回放用户文件）。
