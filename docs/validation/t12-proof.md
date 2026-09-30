# T12 证明 spike 记录（测试专用，非成品适配器）——**三项独立期望全部通过**

作者：Pi。状态：**已执行并全部通过**；T12 未实现。允许写入：`frontend/src/parser/playback-proof.test.ts`、本文档、备份。\n`contracts/score-format.md` 只读；无应用实现、无 mock 证明、不 commit/push。\n\n## 1. 证据分层\n- **已执行(C)**：`MidiFileGenerator` + 自定义 `IMidiFileHandler`（recorder）真实运行并断言。\n- **源码检查(B)**：`alphaTab.core.mjs` 定位实现（引用行号）。\n- **静态(A)**：`alphaTab.d.ts` 看签名。\n\n## 2. 本次采用的关键核验（Lead 探针 + core.mjs）\n- **反复构造（Lead 探针 docs/validation/t12-lead-repeat-probe.md）**：\n  `mb0.isRepeatStart=true`（opening）、`mb1.repeatCount=2`（**第二 bar**）；两标志在 `score.addMasterBar` **之前**。\n  `Score.addMasterBar` 建反复组；`Score.rebuildRepeatGroups` 可在编辑后重建。\n  （先前把 `repeatCount` 放 opening 是错误；tempo 自动化 reference NaN 源于把 MasterBar 传 reference。）\n- **tempo automation reference（core.mjs 506–521）**：\n  `buildTempoAutomation(isLinear, ratioPosition, value, reference, isVisible)`；\n  `reference` 为 0..5 索引、`references=Float32Array([1,.5,1,1.5,2,3])`、`value = value*references[reference]`；\n  越界强制 2。用 `reference=2`（乘子 1）得原值 60。\n- **小节内 tempo**：`ratioPosition * duration`（core.mjs `_processBarTime`）→ tick960 = 0.25×3840。\n- **`score.finish(new Settings())`** 为生成前置（否则拍无 absoluteStart）；`MidiFileGenerator` 传 `new Settings()`（非 null）。\n\n## 2b. Stage2 新增通过项（已执行，无 skip）

| 场景 | 独立期望（PPQ960） | 实测 | 结果 |
|---|---|---|---|
| 两个延音连四分 | 单起音、持续 1920（960+960） | start0 单 addNote，length 1920；start960 无新起音 | ✅ |
| 三连音八分 | 起音 tick 0/320/640 | 0/320/640（每拍 Eighth+tuplet 3/2 → 一拍 320） | ✅ |
| 附点四分 | 持续 1440（960+480） | start0 length 1440 | ✅ |
| 第一/第二结尾 | 源小节序 0/1/0/2（独立书写在生成前） | tickLookup.masterBars 源序 [0,1,0,2] | ✅ |

三连音构造要点：须 **`tupletNumerator=3` + `tupletDenominator=2`**（Eighth×(2/3)=320）；三者共享非单拍 3-note（单拍会 [0,0,0]），各自成拍。
一二结尾要点：`mb0.isRepeatStart=true`，结尾组 mb1(mask1)/mb2(mask2)，`mb2.repeatCount=2`（非 opening）。

## 3. 已执行证明（通过，无 skip）\n`frontend/src/parser/playback-proof.test.ts`，PPQ=960。\n\n| 场景 | 独立期望 | 实测 | 结果 |\n|---|---|---|---|\n| 直四分两拍 | note start tick 0/960 | [0,960] | ✅ |\n| 两小节 4/4 反复两次 | bar start 0/3840/7680/11520；源序列 0/1/0/1；独立 occurrence | bar start 同；**16 音符**；源序列 0/1/0/1；occurrence id 独立(4 项) | ✅ |\n| tempo 120→60 @ tick960 | 时刻 0/500/1500ms @ ticks 0/960/1920 | 同（recorder 在 tick960 收到 tempo 60） | ✅ |\n| timeAt 截断回归 | 查询点早于首个变化时不用晚点变化 | 首变化@960：查询 480→250ms、0→0ms | ✅ |\n\n## 4. 断言细节\n- **反复**：`tickLookup.masterBars[].start=[0,3840,7680,11520]`；`masterBar.index` 序列 `[0,1,0,1]`；\n  start 去重后 4 个唯一值（每次播放独立 occurrence）。\n- **tempo**：recorder `addTempo` 在 tick960 收到 60；`timeAt`：0→0、960→500、1920→1500ms。\n- **timeAt truncation**：`for(change of sorted){ if(change.tick>tick) break; … }` 后再对剩余 span 积分。\n  `lateOnly=[{tick:960,tempo:60}]` 查询 480→250ms（仅 0..480@120）。\n\n## 4b. unification 歧义（已执行演示，非成功身份）
`scoreUnison()`：一拍内两音符同 key 64、不同 string（e4 fret0 与 B3 fret5）。
实测 recorder 在 tick0 收 **2 条 addNote、key 均 64、同 tick** —— 仅凭 `key` 无法区分两弦。
结论：此类必须在适配器标 `identityUnresolved`（fail-closed），**不得标成功身份**；
确认了提案 §2.3 的"显式拒绝"路径的可执行依据。

## 5. 边界与未实现\n- 未证明：完整源音符身份（unison/多声部/装饰）、alternate endings、延音、实际发声、原生桥接。\n- 未实现适配器；`playback-proof.test.ts` 为测试专用；不改应用/契约；不 commit/push。\n- 身份歧义仍在 t12-adapter-proposal.md 以"精确映射或显式拒绝"处理，不静默错位。\n