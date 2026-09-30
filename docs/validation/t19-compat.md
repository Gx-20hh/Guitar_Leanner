# T19 多格式兼容（parser 扩展）记录

作者：Pi。允许写入：`frontend/src/parser`、`tests/score-fixtures`、本文档。停止边界：不 commit/push、不改 contracts/CMake/native 等。
T19 gate 依据（未见独立 T19 gate 文档）：开发框架 §6 兼容表 + 安排核查 T19 行（GP3/4/5/GPX/GP 每类样本、GP8 单列、坏文件/限额）。

## 实际命令（物理 cwd D:/临时工作/GU/frontend）
| 命令 | 结果 | 退出码 |
|---|---|---|
| `python tests/score-fixtures/gen 生成 out.gp5/out.gp4/out.gp3`（用 PyGuitarPro 写 GP5/GP4/GP3；GPX (6,0,0) writer 不支持 KeyError） | 生成 3 份 | 0 |
| `npm run typecheck` | 通过 | 0 |
| `npm test`（全量） | **14 suites；78 passed / 0 skipped** | 0 |

## 已纳入并通过
新增 `frontend/src/parser/multi-format.test.ts`：遍历 `out.gp5`、`out.gp4`、`out.gp3`，经 `importGpToIsr` 解析并断言：
- `title="GP5 Fixture"`、`tempo=120`、单轨 `"Guitar"`、`stringCount=6`、`tuning=[64,59,55,50,45,40]`（保源物理序）、`capo=2`（track.offset 等价）、四四拍。
三者 alphaTab 均解析成功（GP4/GP3 实测 OK；GP5 既有）。

## 披露（如实）
- **GPX**：本机无法自产可靠 .gpx。PyGuitarPro 无 GPX writer（`(6,0,0)` 抛 KeyError）；alphaTab GpxImporter 读 zip 内 `score.gpif`，但最小 zip+gpif 构造未被 `ScoreLoader` 识别（抛 "No compatible importer found"，未达 GpxImporter）。故 GPX **未纳入通过**；需一份授权/真实 .gpx 样本后补测（对齐框架 §6 兼容表）。
- **GP8 .gp 单列**：不凭扩展名承诺；本任务未验证（仅保留声明测试，不 mock、不纳入通过）。
- **每类 ≥3 样本**：本任务每格式仅 1 份自产样本；≥3 样本/变体属 M2 兼容表后续完成；坏文件/解压体积限额测试亦为后续（既有 `importer.error.test.ts` 已覆盖非 GP 拒绝）。
- 未做 `npm run build`（任务未要求）；未改 contracts/。

## 停止
交付后停止，不 commit/push、不改任务板。
