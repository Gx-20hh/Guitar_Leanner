# T12 提案：ScorePlaybackAdapter 单遍历设计（草案，非公开契约）

作者：Pi。状态：**提案**（Contract 归 contracts/，T12 实现前不冻结）。目的：为原生调度/评分提供
“一次遍历产出 MIDI + 训练目标 + 谱面映射”，source 身份在反复/一二结尾/延音/tempo 自动化
（含小节内）/三连音/附点/未支持技巧下保持稳定。**不实现、不改应用代码；只设计 + 报告 API 实测。**

## 1. alphaTab 1.8.4 API 实测结论（依据已安装包，非假设）

路径：`frontend/node_modules/@coderline/alphatab/dist/alphaTab.d.ts` / `alphaTab.core.mjs`。

- `midi.MidiFileGenerator`：`constructor(score, settings, handler: midi.IMidiFileHandler)`；
  `readonly tickLookup: MidiTickLookup`；`generate()`；`static generateSyncPoints(score, createNew?)`
  —— 文档明示 **“correctly handles repeats”，按绝对 midi tick 放置 sync point**。单次 `generate()` 遍历
  全曲（含反复/一二结尾/D.C./segno）驱动 handler 产出 MIDI 事件。
- `midi.IMidiFileHandler`：`addNote(track, start, length, key, velocity, channel)` 等 —— **不带 Note 对象**，
  故源身份须由 `tickLookup` 反查，而非 handler 直接获得。
- `midi.MidiTickLookup`：`masterBars: MasterBarTickLookup[]`（**按播放顺序**、反复展开的线性序；
  每次反复=独立条目）；`findBeat(tracks, tick)` → `MidiTickLookupFindBeatResult`；`getMasterBarStart(bar)`
  、`getBeatStart(beat)`。
- `midi.MasterBarTickLookup`：`start`/`end`（绝对 tick）、`tempoChanges: MasterBarTickLookupTempoChange[]`
  （**支持小节内 tempo 自动化**，其 value/ratioPosition）、`masterBar`、`firstBeat/…/lastBeat`（BeatTickLookup 链）、
  `nextMasterBar/previousMasterBar`。
- `midi.BeatTickLookup`：`start`/`end`/`duration`、`highlightBeat(beat, playbackStart)` —— 链接 tick↔源 Beat。
- tempo：`model.Automation.buildTempoAutomation`；`model.MasterBar.tempoAutomations`（节拍内 tempo）。

**源身份结论**：`IMidiFileHandler.addNote` 不携带源对象 → 用 `tickLookup` 反查源 Beat/Note。
`alphaTab` 源 `Note`/`Beat` 是否暴露稳定 `id` **未在本次 d.ts 检索中确认**（不假设）；实现时若可用则用其
`id` 作 `sourceNoteId/sourceBeatId`，否则用源对象引用 + `(barIndex, voiceIndex, beatIndex, noteIndex)` 组合作
稳定源键。occurrence 身份 = 展开后线性序中的唯一序号（masterBars 列表项 + 拍内位置 + 音符位置）。

## 2. 单遍历（Single Traversal）设计

```
输入: alphaTab Score（已导入，未验证格式不进入）
1) 造 recorder: 实现 midi.IMidiFileHandler（只记录：addNote start/length/key/velocity/channel；
   addTimeSignature; tempo 由 tempo change；control/program 视需要）。
2) 跑 new midi.MidiFileGenerator(score, settings, recorder).generate()
   → recorder 得全曲 MIDI 音符事件（含反复展开，tick 为绝对）。
3) occurrence 线性序（同一遍历配套）: 遍历 midi.gen.tickLookup.masterBars（顺序即播放序），
   每项一个 occurrence；其内 BeatTickLookup 链给出每拍的绝对 start/end/duration。
4) 对每条 addNote（start tick）→ tickLookup.findBeat({track}, start) → 源 Beat；
   源 Beat.notes 逐条关联 → sourceBeatId / sourceNoteId；occurrenceId = 本次播放序全局自增。
5) 训练目标 = 源 Beat/Note 的演奏语义（单音可评分 | 排除）；同一源符出现在多次反复 → 各自独立 occurrence。
```

一次遍历同时产出：
- **MIDI 事件**（on/off、tick、channel、key、velocity）→ 原生调度。
- **训练目标**（单音可评分 target；未支持技巧/和弦 → excluded + reason，不计普通分母）。
- **谱面映射**（occurrenceId → sourceBeatId/sourceNoteId → 源谱面位置；native 播放位置 → beat/occurrence，供光标）。

## 3. 源身份稳定性（需覆盖并验收）

| 场景 | 要求 |
|---|---|
| 反复 / 一二结尾(D.C./segno) | 每次实际出现独立 `occurrenceId`；`sourceNoteId/sourceBeatId` 指向同一源，跨反复稳定。 | 
| 延音线 | 合并为一次发声目标；不要求再次起音；`sourceBeatId` 指向起音那拍。 | 
| tempo 自动化（含小节内） | 展开序内每（小节、拍）持有正确 tempo（`MasterBarTickLookupTempoChange`），供原生 tick→秒换算。 | 
| 三连音 / 附点 | 拍/音符 tick 时长正确（`BeatTickLookup.duration`/MidiFileGenerator 生成值）。 | 
| 未支持技巧（推弦/滑音/泛音/击勾/闷音等） | 保留技巧标签；未专项验证 → 目标 `excluded`（不进普通评分分母），不静默错位。 | 
| 复杂跳转无法验证 | 导入报告明确禁用该曲评分/对应范围（§6.3）。 | 

## 4. 确定性 fixtures 与验收（顺序/ticks 逐项比对）

基于 `tests/score-fixtures/out.gp5`、`out.gp` 及新增自产样本（反复/一二结尾/延音/小节内 tempo/三连音/附点/技巧）：
- 对每个样本给出**预期事件序 + tick**（golden）：`(tick, channel, key, velocity, noteOn/Off, occurrenceId, sourceNoteId)`。
- 验收 = 适配器输出与 golden **逐条相等**（顺序 + tick 精确）。
- 独立验证集与调参集分开（§13.1）。样本记录来源/许可证/哈希、解析器版本、适配器版本。

## 5. DTO 草案（仅提案；T12 冻结前不放 contracts/ 公开）

以十进制字符串表达 64 位样本/位置（int64，跨桥安全）；**原生样本时钟为唯一权威**（适配器只出 tick；
tick→样本换算由原生依 tempo map 完成）；**无浏览器音频**（前端不播放、不用浏览器计时决定发声）。

草拟字段（示例，非最终）：
- `PlaybackOccurrence { occurrenceId, sourceMasterBarId, sourceBarIndex, startTick(string), tempoBpm|null }`
- `PlaybackBeat { occurrenceId, sourceBeatId, tick(string), duration(string), notes[], targets[] }`
- `MidiEvent { tick(string), type: 'noteOn'|'noteOff', channel, key, velocity, occurrenceId, sourceNoteId }`
- `TrainingTarget { id, sourceNoteId, sourceBeatId, occurrenceId, trackId, stringNumber, fret,
   soundingMidi, startTick(string), durationTicks(string), techniques[], grading:'singleNote'|'excluded', exclusionReason? }`

身份字段（sourceNoteId/sourceBeatId/sourceMasterBarId）以 §3 方式稳定；未实现字段不在当前 ISR 中声明。

## 6. 边界与风险

- 依赖 `tickLookup.masterBars` 展开语义与 `findBeat` 精确性：M0 先用小样本（含反复）验证其展开符合预期；不假定任何内部 API 稳定（§6.3）。
- 源 `id` 可用性未确认：实现时若 alphaTab 无稳定 `id`，退化为源对象引用 + 结构化键，并记录。
- adapter 测试与适配逻辑由单一实现方维护（安排核查）；原生只消费稳定 DTO。

## 7. 停止边界

本任务仅设计提案与 API 实测报告；**不实现 T12、不改应用代码、不 commit/push、不改任务板**。
允许写入：`contracts/score-format.md`（T11-CLOSE 复核）、本文档、`docs/validation/t11-gp5.md`、`docs/backups`。
