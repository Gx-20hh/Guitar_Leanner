# T7-A 原生 preflight 核查（简短）

日期：2026-09-30。本文件只记录与 T7-A 契约直接相关的核查事实；工具链安装由项目负责人协调，不在本范围内再查。

## 已核实

- **JUCE 版本锁定**：`9.0.3`（Git tag `9.0.3`，2026-09-28 发布）。经 GitHub API 核对为最新发布。
- **WebBrowserComponent API**：使用 `Options::withNativeIntegrationEnabled` / `withNativeFunction` / `withResourceProvider` / `areOptionsSupported`。
  - 官方头文件来源：`modules/juce_gui_extra/misc/juce_WebBrowserComponent.h`
  - 不存在 `registerWebViewJavaScriptObject`（已由项目负责人独立核验官方头文件，结论写入 `docs/validation/t7-api-review.txt`）。
  - 不使用 hostObjects；不臆造 JUCE API。
- **JS helper**：配套使用 `modules/juce_gui_extra/native/javascript/index.js` 中匹配版本的 `getNativeFunction` 获取 `guitarBridge`。

## WebView2 Runtime（本机）

- 检测到本机 Evergreen WebView2 Runtime：`C:\Program Files (x86)\Microsoft\EdgeWebView\Application\154.0.4258.37`。
- 结论：T7-B 最小桥接验证可在本机直接运行，无需额外安装 WebView2（Evergreen 自更新）。

## 工具链（本项目先前记录）

- 早期 PATH 核查：未找到 `cmake/ninja/cl`（不视为整机绝无编译器）。VS2022 Build Tools C++ workload 正在由项目负责人安装，请勿自行再装。T7-B 构建命令以那之后实际可用的工具为准。

## 未核实 / 注意事项

- 未在本机实际编译或运行任何 C++（本文件只是契约级核对）。
- `withNativeFunction` 的精确签名与 `getNativeFunction` 的调用方式，以 JUCE 9.0.3 官方头文件与 JS helper 为准，T7-B 实现时再读源码核对。
- 页面资源根与加载来源限制按 `contracts/ping-protocol.md §7` 执行；生产版只加载打包本地资源。
