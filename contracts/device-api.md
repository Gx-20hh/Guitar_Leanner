# Device API 契约（T8 草案）

Owner: Claude（原生）| 状态：草案，待复核冻结。遵循 T7 wire 契约定式（protocolVersion/requestId/type/payload；ok 互斥；错误可关联）。本文是设备层与桥接层之间的契约草案，供冻结后扩展 `guitarBridge` 白名单命令。

## 1. 范围

T8 只覆盖输入设备枚举、选择与 RMS 电平。伴奏、节拍器、录音、评分命令不在本文件（后续任务扩展）。

## 2. 命令（type 白名单新增）

| type | 方向 | payload | 回复 payload |
|---|---|---|---|
| `listDevices` | UI→原生 | `{ inputOnly?: boolean }` | `{ devices: DeviceInfo[] }` |
| `configureAudio` | UI→原生 | `{ deviceId?, sampleRate?, bufferSize?, inputChannelCount? }` | `{ configured: DeviceState }` |

## 3. 事件（原生→UI，经 bridge 事件通道）

| event | payload |
|---|---|
| `deviceState` | `DeviceState` |
| `inputLevel` | `{ rmsLinear, rmsDbfs, peakHold, clipped }`（降采样 30–60Hz）|

## 4. 模型（JSON 字段）

```jsonc
// DeviceInfo
{
  "deviceId": "string",
  "name": "string",
  "type": "asio" | "wasapi",
  "inputChannels": 2,
  "samplerates": [44100, 48000, 96000],
  "bufferSizes": [128, 256, 512]
}

// DeviceState
{
  "activeDeviceId": "string",
  "sampleRate": 48000,
  "bufferSize": 256,
  "inputChannelsOpen": 1,
  "running": true,
  "clockSamples": "12345678"   // 原生样本时钟，JSON 十进制字符串（int64）
}
```

## 5. 错误码（补充 ping-protocol 白名单）

| 码 | 触发 |
|---|---|
| `E_DEVICE_NOT_FOUND` | 设备已断开/选择失效 |
| `E_NO_DEVICE_AVAILABLE` | listDevices 空 / configureAudio 无可用输入 |
| `E_AUDIO_SETUP_FAILED` | 采样率/缓冲/通道协商失败 |
| `E_AUDIO_ALREADY_RUNNING` | configureAudio 时已有活动设备（需先 stop，T8 保持简单：直接拒绝）|

遵循 T7 处理顺序：解析→版本→白名单→payload；错误回填 requestId；无法提取时 null。

## 6. 约束（与框架一致）

- 实时回调不做阻塞锁/IO/JSON/网络/不可控堆分配；RMS 在回调内用预分配缓冲计算。
- 单一原生样本时钟（累计样本数），经 `clockSamples` 暴露；UI 只读不拥有。
- 无设备时输入电平显示"未检测到"，不伪造数据。
- 不静默切换聚合驱动；不强制 48k/128；GE200 实际通道/驱动未实机验收前不承诺。
- `configureAudio` 在 T8 为同步初版；后续 T13 加入 epoch/transport 语义。

## 7. 前端接入（Pi 复核）

前端经 `guitarBridge({type:'listDevices',...})` 拉设备列表；经 `inputLevel` 事件驱动电平表。事件经 JUCE 桥接事件通道（T7 已启用 NativeIntegration；事件名称与 payload 结构以冻结后为准）。
