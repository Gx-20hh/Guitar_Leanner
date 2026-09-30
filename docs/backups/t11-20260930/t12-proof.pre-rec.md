# T12 证明 spike 记录（测试专用，非成品适配器）

作者：Pi。状态：**本 spike 已执行**；T12 未实现。允许写入：`frontend/src/parser/playback-proof.test.ts`、本文档、备份。
`contracts/score-format.md` 只读；无应用实现、无 mock 证明、不 commit/push。

## 1. 证据分层
- **已执行(C)**：`MidiFileGenerator` + 自定义 `IMidiFileHandler`（recorder）在本机真实运行、断言输出。
- **源码检查(B)**：`alphaTab.core.mjs` 定位实现（引用行号）；非运行断言。
- **静态(A)**：`alphaTab.d.ts` 看签名。

## 2. 关键源码/API 结论（B，非既成事实）
- `alphaTab.core.mjs` `_playThroughSong`（~L43072）：`MidiPlaybackController` 驱动，`generateMasterBar(bar, prev, currentTick, currentTempo, occurrence)`——
  repeats/occurrence 由 controller 处理。
- tempo 消费：`_processBarTime` 遍历 `bar.tempoAutomations`，用 `change.ratioPosition * duration` 求绝对 tick、
  `change.value` 设 currentTempo（**小节内 tempo 自动化**路径）。`Automation.value / ratioPosition` 在此为实际读取字段。
- `MasterBarTickLookupTempoChange`（d.ts A）：仅 `tick/tempo`（已解析值），非 source Automation。
- `IMidiFileHandler.addNote(...)`（A）：不带 Note 对象、不携带弦号 → 源身份须经 `tickLookup` 反查（见 t12-adapter-proposal.md 的 2.2/2.3）。

## 3. 已执行证明（通过）
构建：1 音轨、1 小节 4/4、两拍（每拍一四分音符，string6 fret0）；`score.finish(new Settings())` 后 `generate()`。
- **直四分两拍：音符 start tick = [0, 960]**（`recorder.notes[*].start`）——通过。
- 前置步骤依赖：**构建后必须 `score.finish()`**，否则拍无 absoluteStart（两拍都落在 tick0，初测 [0,0]），已修正。

## 4. spikes 发现（已执行但未得净期望；不做假、不改音乐期望值）
两用例现以 `it.skip` 保留（fail-closed：不声称通过），原始执行输出记录如下：

### 4.1 两小节 4/4 反复两次期望 occurrence 起点 0/3840/7680/11520
- 构造：`mb0.isRepeatStart=true; mb0.repeatCount=2`（两小节，finish 后 generate）。
- 实际 `tickLookup.masterBars[].start = [0, 3840]` —— **仅 1 遍，未展开反复**。
- 来源（非音乐值差异）：本 spike 的 model 直构未触发 `MidiPlaybackController` 的反复组识别；
  alphaTab 反复依赖 `MasterBarRepeatGroup`（importer 生成的谱才会建立）。需在 T12 用正确机制
  （或经真实谱例）验证反复展开；不作“两小节=1遍即反反复”结论，不把期望改成 [0,3840]。

### 4.2 小节内 tempo：ratioPosition 自动化在 tick960 变 60
- 构造：`mb.tempoAutomations.push(buildTempoAutomation(false,0,120,0,true))` 与 `(false,0.25,60,0,true)`。
- 实际：recorder 在 tick 960 收到 tempo 事件，但 `tempo` 为 **NaN**（非 60）。
- 来源：buildTempoAutomation 的 `reference` 为 number（编译层已判），ratioPosition 自动化在本直构下
  value 未成干净 60；该 spike 的自动化装配方式有误。T12 需确认该库“小节内 tempo 自动化”的规范装配
  （或改用经导入谱例验证），保持期望 0/500/1500ms @ tick 0/960/1920 不动。

## 5. 结论与边界
- 已执行证明仅一条（直四分 0/960）为“通过”；反复与 tempo 为 **spike 构造性发现（未展开/NaN）**，
  已记录原始输出与来源，未伪造通过。
- 不改音乐期望值；T12 需解决 4.1/4.2 的构造/装配后，将 `.skip` 转回 `it` 并断言。
- 未实现适配器；未改应用/契约；未 commit/push。
