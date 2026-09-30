# 谱面格式与 ISR 契约（T11-CLOSE 复核版）

状态：T11-CLOSE 复核。写入者：Pi（本任务 contracts/score-format.md 唯一写入者）；Claude 当前 T7-HOST 无 contracts 写入。复核人：Codex。
依据：开发框架 v1.0 §5.3 / §6 / §11，安排核查，T11-R2/R3 实测。

## 1. 解析引擎与支持状态（支持 vs 未验证，精确区分）

解析引擎：alphaTab `@coderline/alphatab@1.8.4`（MPL-2.0）。

| 范围 | 状态 | 证据/说明 |
|---|---|---|
| GP5（`FICHIER GUITAR PRO v5.00`） | **已实现 + 真实谱例验证** | PyGuitarPro 生成 out.gp5，alphaTab 解析成功；Tests`import-from-file.test.ts` |
| GP（alphaTab Gp7Exporter 生成的 .gp） | **已实现 + 真实谱例验证（同库导出回导）** | out.gp 由 Gp7Exporter.export 生成并回导入；`gp-export.test.ts` |
| GP4 / GP3 | **未验证**（仅因 alphaTab 解析器具备该能力，未以真实样本/测试确认） | 不凭解析器能力或扩展名承诺；引入真实样本后再在 §“兼容表”记录 |
| GPX / GP8 `.gp` | **未实现** | 单列验收；不凭扩展名承诺 |

未经验证的格式/曲目：导入报告明确禁用评分或对应范围，不静默错位（§6.3）。

## 2. 导入→ISR 流程

```
GP 字节 → parseWithAlphaTab → alphaTab Score → toIsr → InternalScore(ISR)
```

- 只消费 alphaTab 可观测只读模型并产出稳定 DTO；不把 alphaTab 类结构作为跨层公共协议（§11）。
- 失败抛 `ScoreImportError`（unsupported|parse），不伪造 ISR。

## 3. ISR（Internal Score Representation）与弦序（已核验）

前端类型镜像：`frontend/src/parser/isr.ts`。

- `InternalScore`: title, subTitle, artist, tempo, tracks[], masterBars[]
- `IsrTrack`: index, name, stringCount, tuning[], capo, measures[]
- `IsrMasterBar`: index, numerator, denominator, tempoBpm
- `IsrMeasure`: trackIndex, index, voices[]（voices[i] = 拍序列）
- `IsrBeat`: index, duration(数值), notes[]
- `IsrNote`: stringNumber, fret, midi, dynamics, techniques[], isTieDestination

### 3.1 弦序与调弦（实测，非猜测）

- alphaTab `Note.string` **1 基、低→高**：`String=1` 为最低弦，`String=6` 为最高弦
  （核验：`getStringTuning(staff, noteString)=staff.tuning[staff.tuning.length - noteString]`）。
- **ISR stringNumber = stringCount − note.string + 1**（ISR 1 = 最高音弦，对齐 §5.3）。
  - 实测：最高弦 alpha=6 → ISR `6-6+1=1`；最低弦 alpha=1 → ISR `6-1+1=6`。
- **tuning 保源物理序**（= 文件弦序），**不 reverse、不按音高排序**；交替调弦保物理顺序。
  - 常规样本 `[64,59,55,50,45,40]`（string1=高 e…string6=低 E），实测 alphaTab ISR 保序返回。
- 导入适配器**显式**转换源库弦序，禁止隐式沿用（§5.3）。

### 3.2 字段（已核验）

| 字段 | 来源 | 说明 |
|---|---|---|
| stringNumber | `stringCount − note.string + 1` | 1=最高（实测） |
| fret | note.fret | 品位 |
| midi | note.realValue | **含 capo**（capo2 → 高 e fret0=66、低 E fret0=42，实测） |
| dynamics | note.dynamics 数值枚举 | alpha(PPP=0…FFF=7) → ISR 档 = value+1（实测 F→6、MP→4） |
| duration | note/beat.duration 数值枚举 | **数值**：Whole=1, Half=2, Quarter=4, Eighth=8…（ISR duration 存数值，非枚举名） |
| techniques | 技巧开关 | 当前枚举：hammer-on / let-ring / palm-mute / dead / tie |
| isTieDestination | note.isTieDestination | 延音线目标，不要求重新拨弦 |

### 3.3 capo

- 写入端语义：GP5 以 `track.offset` 表示 capo（PyGuitarPro `GP5File.writeTrack` 实测）。
- 读取：alphaTab 导入 `staff.capo`；ISR `track.capo`、`midi` 均含 capo。

## 4. 能力边界（不做超越实现的声明）

- **静态六线谱 ≠ 节奏排字（rhythm engraving）**：当前 `ScoreBoard` 只做最小静态声部分块六线谱
  （列=拍、和弦共享列、休止留列、小节边界、每声部独立成块），不渲染节奏符档/节拍线。
- **ISR 目前不足以承担播放时序/repeats**：ISR 是静态谱面 DTO；播放展开、occurrenceId、sourceNoteId/sourceBeatId、
  tempo map 细分（含小节内 tempo 自动化）、反复/一二结尾/延音语义属 **T12（ScorePlaybackAdapter）**，尚未实现。
- 本契约**不声明**已实现或已验证：播放时序、occurrence 身份、tempo map、多格式兼容表、GP4/GP3 真实样本。
- 元数据（title/subTitle/artist/tempo）与音符字段为实际解析所得；未实现的身份字段不列入当前 ISR。

## 5. 安全与降级

- 只解析受授权/自制谱例；导入报告记录文件哈希、解析器版本、适配器版本（§6.1）。
- 复杂跳转若无法验证，导入报告明确禁用该曲评分或对应范围。
- 前端不因解析库细节对外承诺完整还原格式（框架“支持文件格式”≠完整还原）。
