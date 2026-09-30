# Ping 桥接协议契约（T7-A）

版本锁定：

- **JUCE：9.0.3**（Git tag `9.0.3`，发布于 2026-09-28，官方头文件已由项目负责人独立核验）
- **桥接机制**：`juce_gui_extra/misc/juce_WebBrowserComponent.h`
  - `Options::withNativeIntegrationEnabled`
  - `Options::withNativeFunction`（原生函数）
  - `Options::withResourceProvider`（前端只能从可信资源根加载）
  - `Options::areOptionsSupported`
  - JS 侧配套 helper：`modules/juce_gui_extra/native/javascript/index.js` 中的 `getNativeFunction`
- 不使用 hostObjects，不臆造 JUCE 未提供的 API。只注册一个原生函数 `guitarBridge(request)`，`Promise` 返回 reply（成功/失败互斥）。

## 1. 消息类型

全部消息是单个 JSON 对象，UTF-8。

### 1.1 原生调用（前端 → 原生）：Request

```json
{
  "protocolVersion": 1,
  "requestId": "req_0192fc3a-uuid-string",
  "type": "ping",
  "payload": { "message": "hello from ui" }
}
```

字段约束：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `protocolVersion` | integer | 是 | 当前固定为 `1`；未来向后兼容在此版本内演进 |
| `requestId` | string | 是 | 非空，长度 1–64；调用方按 RFC 4122 生成（UUID 或自生成唯一串均可） |
| `type` | string | 是 | 仅允许白名单命令（当前：`ping`） |
| `payload` | object | 是 | 随 `type` 变化；`ping.payload.message` 非空，长度 1–256 |

### 1.2 成功回复（原生 → 前端）：Reply.ok

```json
{
  "protocolVersion": 1,
  "requestId": "req_0192fc3a-uuid-string",
  "ok": true,
  "payload": { "message": "pong from native" }
}
```

### 1.3 失败回复（原生 → 前端）：Reply.error

```json
{
  "protocolVersion": 1,
  "requestId": "req_0192fc3a-uuid-string",
  "ok": false,
  "error": { "code": "E_UNKNOWN_COMMAND", "message": "command not allowed: frobnicate" }
}
```

## 2. 成功 / 失败互斥

- `ok` 为布尔。
- `ok: true` 时 **不得** 出现 `error` 字段；`ok: false` 时 **不得** 出现 `payload` 字段。
- 一条回复只能有一种状态；这是契约层强约束（见 §4 错误码）。

## 3. 错误可关联性

- `requestId` 必须尽量回填：能安全提取到 ID 时，回复必回填；无法安全提取（如 JSON 解析失败、ID 字段本身损坏）时回填 `null`。
- `null` requestId 表示「无法关联到正常请求」，前端不得把 `null` 回复当作任何正常请求的应答，只能作为不可调用的诊断信息记录。

## 4. 错误码清单

| 码 | 触发条件 | 建议 HTTP 类比 |
|---|---|---|
| `E_VERSION_UNSUPPORTED` | `protocolVersion` 不是 `1`（缺失、非法、大于 1） | 505 |
| `E_UNKNOWN_COMMAND` | `type` 不在白名单 | 400 |
| `E_MALFORMED_REQUEST` | JSON 无法解析，或顶层字段/类型损坏 | 400 |
| `E_BAD_PAYLOAD` | `type` 合法但 `payload` 缺失、类型错、字段非法、长度越界 | 422 |

处理顺序（原型约定）：

1. JSON 解析失败 → `E_MALFORMED_REQUEST`，`requestId: null`，`message` 不泄漏原始文本细节
2. `protocolVersion` 非法/不支持 → `E_VERSION_UNSUPPORTED`（若能取到 ID 则回填）
3. `type` 不在白名单 → `E_UNKNOWN_COMMAND`
4. `payload` 校验失败 → `E_BAD_PAYLOAD`

## 5. 错误消息可读性

`error.message` 为可读 ASCII 文本，仅限诊断用途；错误对象必须含 `code`。

## 6. message 与 requestId 长度限制

- `requestId`：长度 1–64 字符（非空）；过长视为非法，无法关联时 `null`。
- `ping.payload.message`：长度 1–256 字符（非空）。
- 超出上限 → `E_BAD_PAYLOAD`（message）或按 §3 处理（requestId）。

## 7. 原生对页面加载来源的限制

- 仅从可信资源根加载前端（打包本地页面，通过 `withResourceProvider` 提供）。
- 禁止外部导航：生产构建不跳转任意 URL 页面，不使用默认浏览器访问外部链接（外部链接交系统浏览器）。
- 不在页面开放 shell 执行、任意文件读取或原生对象直达。

## 8. 版本演进

`protocolVersion` 固定为 `1`；新命令先在此文档登记白名单；破坏性变更前升到下一个版本并同时更新本契约与原生实现。
