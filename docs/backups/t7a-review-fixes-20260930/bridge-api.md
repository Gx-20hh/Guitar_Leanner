# WebView2 / JUCE 桥接 API（T7-A 契约）

锁定版本与机制，不臆造 API：

- **JUCE 9.0.3**（tag，2026-09-28 发布；官方头文件已由项目负责人独立核验）。WebView2 是 JUCE WebBrowserComponent 的装载引擎。
- **头文件**：`modules/juce_gui_extra/misc/juce_WebBrowserComponent.h`（JUCE 9.x）。
- **类**：`juce::WebBrowserComponent::Options`。

## 采用的 Options 配置

| API | 用途 |
|---|---|
| `Options::withNativeIntegrationEnabled` | 启用 前端↔原生 双向桥接集成 |
| `Options::withNativeFunction` | 注册原生函数 `guitarBridge`（Promise 型） |
| `Options::withResourceProvider` | 提供可信本地资源根；页面加载来源限制 |
| `Options::areOptionsSupported` | 运行时探测这些选项在当前 JUCE/WebView2 是否真正可用 |

- **不注册 hostObjects**；不臆造 `registerWebViewJavaScriptObject` 等未提供符号。
- **JS 侧 helper**：`modules/juce_gui_extra/native/javascript/index.js` 中与 JUCE 9.0.3 匹配的 `getNativeFunction`，用于前端拿到 `guitarBridge`。
- 前端通过 `guitarBridge(request)` 调用，`Promise` 返回 reply。

## 前端入口（待 Pi 复核后确定最终调用方式）

```ts
// 概念示例，非最终实现
const reply = await guitarBridge({
  protocolVersion: 1,
  requestId: crypto.randomUUID(),
  type: 'ping',
  payload: { message: 'hello' },
});
// reply: { protocolVersion:1, requestId:..., ok:true, payload:{message:'pong from native'} }
//       或 { protocolVersion:1, requestId:..., ok:false, error:{code:'E_...', message:'...'} }
```

## 原生侧注册（概念示意，T7-B 实现）

```cpp
auto opts = juce::WebBrowserComponent::Options{}
  .withFrontendWindowing(juce::WebBrowserComponent::Options::WindowCreationType::Puppeteer)
  .withNativeIntegrationEnabled()
  .withNativeFunction("guitarBridge", guitarBridgeCallback); // 见 contracts/bridge-naming.md
// 资源根与页面加载来源限制见 ping-protocol.md §7
```

## 页面加载来源限制

- 生产版只加载打包本地资源，经 `withResourceProvider` 提供可信资源根。
- 禁止跳转外部 URL / 随意导航；外部链接交给系统浏览器。
- 不向页面开放任意文件读取、shell 执行、原生对象直达。

（`WindowCreationType::Puppeteer` 为示意，T7-B 以实际构建与 `areOptionsSupported` 探测结果为准。）
