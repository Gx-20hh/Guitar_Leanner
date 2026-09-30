# T12 提案(修订版):ScorePlaybackAdapter 单遍历设计(草案,非公开契约)

作者:Pi。状态:**提案**,未批准实现。契约归 contracts/,T12 冻结前不公开。
**本修订**针对复查关键身份缺口:naive `findBeat(track,start)`+`Beat.notes` 无法消歧
"不同弦同音 unison / 多声部 / 装饰(grace/ornament)生成事件";`tickLookup` 为高亮导向、非唯一音符身份证明。
故给出 **精确映射(可证)或显式拒绝(不作静默错位)** 双路径,并附数值 golden 表(标注待执行核验)。

## 0. 证据分层(区分:静态检查 vs 已执行证明)

- (A) **d.ts 静态检查**:只反映公开 API 声明,不证明运行行为。仅用于圈定 API 与方法签名。
- (B) **core.mjs 执行源**(已安装包实际产物):引用行号可佐证实现流程,**但不等同于已运行证明**。
- (C) **执行证明(T12 必做,本提案未完成)**:跑 `MidiFileGenerator.generate()` 并断言输出。
  在 (C) 之前,任何 golden 数值均标注"待核验",不作既成事实。

依据(包内产物,注明层级):
- (B) `alphaTab.core.mjs` L42942 `tickLookup = new MidiTickLookup();`;L43236 `this.tickLookup.addMasterBar(masterBarLookup);`
  —— 源码层说明 `generate()` 填充 `MidiTickLookup.masterBars`(线性、反复展开)。**属(B)非(C)。**
- (A/B) `alphaTab.d.ts` `MasterBarTickLookupTempoChange`:仅 `tick` / `tempo`(构造 `(tick,tempo)`)
  —— 是 **已解析的小节内 tempo**;`value/ratioPosition` 属 `Automation`(源模型),**不是** tempoChanges 字段。
  (修订前提案误将 Automation 字段当 tempoChanges,已纠正。)
- (A/B) `midi.IMidiFileHandler`:`addNote(track,start,length,key,velocity,channel)` —— **不带 Note 对象、不携带弦号**;
  `key` 无法区分"不同弦上的同音"。

## 1. 目标与边界

单遍历(一处跑 `MidiFileGenerator.generate()`)产出:MIDI 事件、训练目标、谱面映射。
**原生样本时钟为唯一权威**;适配器只出 tick;tick→样本换算由原生依 tempo map 完成。
**无浏览器音频**;不做节奏排字渲染(与静态六线谱区分)。

## 2. 精确映射(可证)与显式拒绝(歧义)

### 2.1 结构稳定源键(不依赖运行时对象 id;重导入不安全)
- note 级: `(trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, noteIndex)`
- beat 级: `(trackIndex, staffIndex, barIndex, voiceIndex, beatIndex)`
- masterbar 级: `(barIndex)`
导入时一次固化;跨 reimport 稳定(不依赖对象引用的持久性)。

### 2.2 可证映射(无歧义)
对单拍、单 voice、单音且同拍无同 `key` 碰撞:
1. `tickLookup.findBeat({track}, startTick)` 反向得到拍级(time 范围,由 `BeatTickLookup.start/end`)。
2. 拍内 `addNote.key` 唯一命中源 `Note.key` → (voice, beat, noteIndex) 关联(此刻身份唯一,可证)。
3. tempo: 由该 occurrence 的 `MasterBarTickLookup.start/end` + `tempoChanges[](tick/tempo)` 求拍 tick→时长。
只有 **唯一命中** 才算"已证";否则进入 2.3。

### 2.3 显式拒绝(歧义,不猜,不许静默错位)
- **不同弦同音(unison)**:同拍、同 `key`、不同 string 的多音符 → `key` 无法区分身份;
  未做专项验证则标 `identityUnresolved`,该 occurrence 不参与逐音符评分(或降为拍级目标)。
- **同 tick 跨 voice 同键**:同拍不同 voice 同 `key` → 同上拒绝。
- **装饰音 / grace / 装饰生成事件**:非主线音符事件 → 不映射普通目标;归未验证技巧范围,不进普通分母。
- **复杂跳转无法验证**:导入报告禁用该曲评分/对应范围(框架 §6.3)。

原则:**能精确证明才给唯一身份;否则显式拒绝,绝不静默错位。**

### 2.4 occurrence
- `occurrenceId` = 展开后线性序全局自增(依 `tickLookup.masterBars` 顺序即播放序)。
- 同一源(bar/beat/note)被多次反复播放 → 各自独立 occurrenceId,`sourceKey` 不变。

## 3. tempo 与拍内时值(已核验字段)
- 小节内 tempo:`MasterBarTickLookupTempoChange.tick/tempo`(已解析,含小节内自动化的结果;非 Automation.value/ratioPosition)。
- 拍 tick 范围:`BeatTickLookup.start/end/duration`(三连音/附点由此得 tick 时值)。
- 全曲/常规 tempo:`score.tempo` + 首小节 automation(实测 GP5/GP 回导 BPM120,属已执行样本证据)。

## 4. 数值 golden 表(PPQ=960;**待执行核验(C),非既成事实**)
以 4/4、单音轨、单声部干净拍为基准。

| 序号 | 场景 | 预期(PPQ960;待 T12 实测确认) |
|---|---|---|
| 1 | 直四分两拍 | beat start tick `0 / 960` |
| 2 | 两小节反复(各次 occurrence 起点) | `0 / 3840 / 7680 / 11520`(3840=1 小节 4/4 @PPQ960) |
| 3 | 两个延音连四分 | noteOn tick0,noteOff=**持续 1920**(960+960),单次起音 |
| 4 | 三连音八分 | 起音 tick `0 / 320 / 640` |
| 5 | 附点四分 | noteOn tick0,持续 `1440`(960+480) |
| 6 | tempo 变化 @tick960 | 待核验:ticks `0/960/1920` 对应时刻(0ms、500ms、(依实际 tempo 内插)) |

**核验要求**:以上为建议 golden,须以 T12 对锁定库 `MidiFileGenerator` **实际输出逐条比对**;
若实际输出不同,以执行输出为准并修订(本提案不作已证断言)。

## 5. 草案 DTO(仅提案;冻结前不放 contracts/ 公开)
- `PlaybackOccurrence { occurrenceId, barSourceKey, startTick(string), tempoBpm|null }`
- `PlaybackBeat { occurrenceId, beatSourceKey, tick(string), duration(string) }`
- `MidiEvent { tick(string), type, channel, key, velocity, occurrenceId, beatSourceKey, noteIndex|null }`
- `TrainingTarget { id, beatSourceKey, noteIndex, stringNumber, fret, soundingMidi,
   startTick(string), durationTicks(string), techniques[], grading:'singleNote'|'excluded'|'identityUnresolved',
   exclusionReason? }`
- 样本/位置一律**十进制字符串**(int64);原生样本时钟唯一权威;无浏览器音频。

## 6. 未决/风险
- (C)执行证明未做:§2.2/§4 精确值需 T12 实测后定版;M0 先以含反复小样本验证
  `tickLookup.masterBars` 展开序与 `tempoChanges` 语义。
- 不依赖运行时对象 id 作持久源键;结构键在导入时一次固化(跨 reimport 稳定)。
- 适配逻辑与测试由单一实现方维护;原生只消费稳定 DTO。

## 7. 停止边界
仅**提案/证据/备份**写入:`docs/dispatch/t12-adapter-proposal.md`、`docs/validation/t11-gp5.md`、`docs/backups`。
`contracts/score-format.md` **只读**。不实现 T12、不改应用代码、不 mock 证明、不 commit/push、不改任务板。
