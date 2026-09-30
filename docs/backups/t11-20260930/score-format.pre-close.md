# 谱面格式与 ISR 契约（T11）

状态：T11 起草。负责：Pi（本任务 contracts 写入者）。Claude 复核原生消费，Codex 批准接口变更。
依据：开发框架 v1.0 §4.1 / §5.3 / §6 / §11，安排核查 T11。

## 1. 解析引擎与锁定版本

GP5/GP 解析使用 alphaTab（锁定 `@coderline/alphatab@1.8.4`，MPL-2.0）。本契约不替代 alphaTab 官方格式支持表；
以实际样本测试形成兼容表（框架 §“支持文件格式”不等于完整还原）。

- 首版范围：GP5（`FICHIER GUITAR PRO v5.00`）、GP4/GP3（alphaTab Gp3To5Importer 同管线）。
- **不含**：GPX、GP7/GP8（GpXImporter/Gp7To8Importer 另验）；GP8 的 `.gp` 必须单列验收，不凭扩展名承诺。
- 未经验证的格式/曲目：导入报告明确禁用评分或对应范围，不静默错位（框架 §6.3）。

## 2. 导入→ISR 流程

```
GP 字节 → alphaTab parseWithAlphaTab → alphaTab Score → toIsr → InternalScore(ISR)
```

- 只消费 alphaTab 可观测只读模型并产出稳定 DTO；不把 alphaTab 类结构作为跨层公共协议（框架 §11）。
- 解析失败抛 `ScoreImportError`（kind: `unsupported` | `parse`），绝不伪造 ISR。

## 3. ISR（Internal Score Representation）

前端侧类型见 `frontend/src/parser/isr.ts`（镜像）。稳定 DTO 名称与字段如下；将来如需跨层复用，
以本契约为准，副本归 contracts/。

- `InternalScore`:title, subTitle, artist, tempo, tracks[], masterBars[]
- `IsrTrack`: index, name, stringCount, tuning[], capo, measures[]
- `IsrMasterBar`: index, timeSignatureNumerator, timeSignatureDenominator, tempoBpm
- `IsrMeasure`: trackIndex, index, voices[]（voices[i] 是拍序列）
- `IsrBeat`: index, duration, notes[]
- `IsrNote`: stringNumber, fret, midi, dynamics, techniques[], isTieDestination

### 3.1 弦序（对齐框架 §5.3）

- ISR 的 `stringNumber`：**1 = 最高音弦，N = 最低音弦**（标准六弦即 1=E 高、6=E 低）。
- alphaTab 弦索引以 **0 = 最低音弦**。`toIsr` 翻转：`stringNumber = stringCount - alphaStringIndex`。
- 禁止隐式沿用源库弦序（§5.3）：导入适配器显式转换。
- `tuning[]` 为 ISR 序：从 stringNumber=1（最高）到最低的 MIDI 音高（对 alpha 数组 reverse）。

### 3.2 各字段

| 字段 | 来源 | 说明 |
|---|---|---|
| stringNumber | alpha note.string 翻转 | 1=最高 |
| fret | note.fret | 品位 |
| midi | note.realValue | 实际发声音高（MIDI） |
| dynamics | note.dynamics | alpha 数值枚举(PPP=0…FFF=7)；ISR 档 1…8（值+1） |
| techniques | 技巧开关 | 当前枚举：hammer-on / let-ring / palm-mute / dead / tie |
| isTieDestination | note.isTieDestination | 延音线目标，不要求重新拨弦 |

## 4. 提取责任（T11 范围内）

解析后提取：音轨(tracks)、调弦(tuning)、tempo、小节(masterBars/拍号)、音符(notes)、技巧(techniques)、动态(dynamics)。

**不在 T11**（属 T12/T19，本契约只标注名称，不定义协议）：
- 播放展开、occurrenceId/sourceNoteId/sourceBeatId、tempo map 细分（ScorePlaybackAdapter，T12）。
- 反复/一二结尾/延音/和弦/技巧专项的评分语义（T12）。
- 多格式兼容表与导入安全限额（T19）。

## 5. 安全与降级

- 只解析受授权/自制谱例；导入报告记录文件哈希、解析器版本、适配器版本（框架 §6.1）。
- 复杂跳转若无法验证，导入报告明确禁用该曲评分或对应范围。
- 前端不因解析库细节对外承诺完整还原格式（框架 §“支持文件格式”）。
