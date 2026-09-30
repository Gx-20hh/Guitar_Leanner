# Ping 桥接协议契约（T7-A，审查修正版）

状态：契约已由项目负责人最终裁定（wire contract）。版本锁定：

- **JUCE：9.0.3**（Git tag `9.0.3`，2026-09-28，官方头文件已核验）
- **桥接机制**：`juce_gui_extra/misc/juce_WebBrowserComponent.h`
  - `Options::withBackend(Options::Backend::webview2)`
  - `Options::withNativeIntegrationEnabled`
  - `Options::withNativeFunction("guitarBridge", callback)`
  - `Options::withResourceProvider`
  - `WebBrowserComponent::areOptionsSupported(const Options&)`（静态方法）
- **JS helper**：`modules/juce_gui_extra/native/javascript/index.js` 中匹配版本的 `getNativeFunction`。
- 不使用 hostObjects，不臆造 JUCE API；删除 `withFrontendWindowing` / `WindowCreationType::Puppeteer` 等未核实符号。
- 原生函数接收一个 **JS 对象**（Request），不是 JSON 字符串；原生收到 `Array<var>`，取首元素校验，不额外 JSON 字符串化再解析。

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
| `requestId` | string | 是 | 非空，**ASCII 1–64 字符**；调用方生成唯一串（UUID 或自生成） |
| `type` | string | 是 | 仅允许白名单命令（当前：`ping`） |
| `payload` | object | 是 | 随 `type` 变化；`ping.payload.message` 非空，**按 Unicode 码点 1–256** |

### 1.2 成功回复（原生 → 前端）：Reply.ok

```json
{
  "protocolVersion": 1,
  "requestId": "req_0192fc3a-uuid-string",
  "ok": true,
  "payload": { "message": "pong from native" }
}
```

- 成功回复的 `payload.message` **固定为 `pong from native`**（两端一致，不随请求内容变化）。

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
- 一条回复只能有一种状态。

## 3. 错误可关联性（审查修正 3）

规则：**能回填 `requestId` 就必须回填**；只有无法安全提取时才回 `null`。

| 情况 | 处理 | requestId |
|---|---|---|
| JSON 无法解析、或 `requestId` 本身非法（缺失/非字符串/超长/非 ASCII/空）→ **统一 `E_MALFORMED_REQUEST`**，`null` | 解析阶段失败 | `null` |
| `requestId` 本身有效，但其余结构（版本/命令/payload）错误 → **回填 requestId** | 版本/白名单/payload 阶段 | 回填 |

- `null` requestId 表示「无法关联到正常请求」；前端不得把 `null` 回复当作任何正常请求的应答，只能作为不可调用诊断记录。
- 错误码与回填规则已在 `error-codes.md` 统一，本文件不再自相矛盾。

## 4. 错误码清单

| 码 | 触发条件 |
|---|---|
| `E_MALFORMED_REQUEST` | JSON 无法解析，或 `requestId` 非法（缺失/非字符串/空/超长/非 ASCII）|
| `E_VERSION_UNSUPPORTED` | `protocolVersion` 缺失或不为 `1` |
| `E_UNKNOWN_COMMAND` | `type` 不在白名单 |
| `E_BAD_PAYLOAD` | `type` 合法但 `payload` 无效（缺失/类型错/字段非法/长度越界）|

处理顺序（统一）：解析 → 版本 → 白名单 → payload。

## 5. 错误消息可读性

`error.message` 为可读 ASCII 文本，仅限诊断；错误对象必含 `code`。`message` 不携带完整原始请求文本。

## 6. 长度限制（审查修正 4，两端一致）

- `requestId`：**ASCII，长度 1–64 字符**；非 ASCII / 空 / 超长 → 非法 → `E_MALFORMED_REQUEST` + `null`。
- `ping.payload.message`：**按 Unicode 码点，长度 1–256**（可含中文等非 ASCII）。
- 超出上限 → `E_BAD_PAYLOAD`（payload 阶段，回填 requestId 若可用）。
- **两端（原生校验与前端生成）必须采用同一码点/ASCII 口径**，见 `error-codes.md`。

## 7. 原生对页面加载来源的限制

- 仅从可信资源根加载前端（打包本地页面，`withResourceProvider` 提供）。
- 可构建后复制前端打包产物到 exe 旁的 `ui/`；路径严格限制在资源根内。
- 不启用开发服务器 / 不强开外部 URL / 不使用 IE 回退。
- WebView2 Runtime 缺失时明确失败（不静默降级）。
- 不在页面开放 shell 执行、任意文件读取或原生对象直达。

## 8. 版本演进

`protocolVersion` 固定为 `1`；新命令先登记白名单；破坏性变更前升版本并同时更新契约与原生实现。
