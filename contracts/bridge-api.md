# WebView2 / JUCE 桥接 API（T7-A 契约，审查修正版）

锁定版本与机制，不臆造 API：

- **JUCE 9.0.3**（Git tag `9.0.3`，2026-09-28 发布；官方头文件已由项目负责人独立核验，本文件也已直接解码官方头文件 `modules/juce_gui_extra/misc/juce_WebBrowserComponent.h` 核对签名）。
- **头文件**：`modules/juce_gui_extra/misc/juce_WebBrowserComponent.h`（JUCE 9.x）。

## 采用的 Options 配置（已核实为 Options 成员方法）

| API | 签名（官方 9.0.3） | 用途 |
|---|---|---|
| `Options::withBackend(Backend)` | `[[nodiscard]] Options withBackend(Backend backend) const` | 强制 Windows 使用 WebView2 后端 `Backend::webview2`；不支持时 JUCE 会静默回退默认后端，需先用 `areOptionsSupported` 探测 |
| `Options::withNativeIntegrationEnabled(bool)` | `[[nodiscard]] Options withNativeIntegrationEnabled(bool enabled = true) const` | 启用 前端↔原生 双向桥接集成 |
| `Options::withNativeFunction(const Identifier&, NativeFunction)` | `[[nodiscard]] Options withNativeFunction(const Identifier& name, NativeFunction callback) const` | 注册原生函数 `guitarBridge`；`NativeFunction = std::function<void(const Array<var>&, NativeFunctionCompletion)>` |
| `Options::withResourceProvider(ResourceProvider, ...)` | `[[nodiscard]] Options withResourceProvider(ResourceProvider provider, ...) const` | 提供可信本地资源根；页面加载来源限制 |

- **`areOptionsSupported` 是 `WebBrowserComponent` 的静态方法**，不是 Options 方法：
  `static bool areOptionsSupported(const Options& options);`（官方 9.0.3，行 514 附近）。
  用于运行时探测：所选后端（webview2）、原生集成与资源提供在当前 JUCE/WebView2 组合下是否真正可用。
- **不使用** `withFrontendWindowing` / `WindowCreationType::Puppeteer` —— 这不是已核实 API，已从契约删除。
- **不注册 hostObjects**；不臆造 `registerWebViewJavaScriptObject` 等未提供符号。

## JS 侧 helper（官方 9.0.3）

JUCE 9.0.3 已将 helper 迁移到 `modules/juce_gui_extra/native/typescript/webview-interop`，打包为 **`@juce-framework/webview` 1.0.0**（官方 `<9.0.3` 的 `native/javascript/index.js` 路径在 9.0.3 已不存在，返回 404，主机不会自动挂载 `./juce`）。

helper 的获取/打包完全由 Pi 在 `frontend/` 负责；原生不实现前端 helper。contracts 只记录接入方式，不承担实现。

```js
// 前端（Pi 打包后）通过该包提供的方式拿到 guitarBridge
const guitarBridge = getNativeFunction("guitarBridge");
```

前端通过 `guitarBridge(request)` 调用，返回 `Promise<Reply>`。

## 原生函数接收一个 JS 对象，不做额外 JSON 字符串解析

- `guitarBridge` 的第一个参数是 **JS 对象**（Request），不是 JSON 字符串。
- 原生侧收到的是 `Array<var>`（参数数组），取首元素 `var`，**直接按对象字段校验**，不把对象再序列化成字符串再手动解析。
- `NativeFunctionCompletion` 可被任何线程调用；T7-B 在 UI/主线程回调内安全地同步返回 reply（先不做异步，保持原型简单）。

## 前端调用概念示例（最终以实现于 T7-B/T7-C 为准）

```ts
const guitarBridge = getNativeFunction("guitarBridge");
const reply = await guitarBridge({
  protocolVersion: 1,
  requestId: "req_xxx", // ASCII 1-64
  type: "ping",
  payload: { message: "hello" },
});
// reply.ok===true  → payload
// reply.ok===false → error.code / error.message
```

## 页面加载来源限制

- 生产版只加载打包本地资源，经 `withResourceProvider` 提供可信资源根。
- 可构建后将打包前端 `frontend/dist` 复制到 exe 旁的 `ui/` 目录；`withResourceProvider` 对其路径严格限制（仅允许该资源根内）。
- 不启用开发服务器，不做 IE 回退。
- WebView2 Runtime 缺失时**明确失败**（不静默降级）。
- 禁止跳转外部 URL / 随意导航；外部链接交给系统浏览器。
- 不向页面开放任意文件读取、shell 执行、原生对象直达。
