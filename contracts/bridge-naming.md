# 桥接命名契约（T7-A，审查修正版）

**单一原生函数入口**：页面通过 WebView2 原生集成拿到 `guitarBridge`，调用方式是 `guitarBridge(request)`，返回值是 `Promise<Reply>`。

- 不注册多余命名函数；`guitarBridge` 是唯一入口。所有命令、未来设备/评分/存储操作都走同一个 `guitarBridge(request)`，按 `type` 分派到原生实现。
- 不通过 hostObject / 命名资源 / 文件系统对象暴露原生；页面只能调用这个函数。
- JS 侧获取方式：JUCE 9.0.3 配套的 `getNativeFunction`（`modules/juce_gui_extra/native/javascript/index.js`）。
- 原生函数第一个参数是一个 **JS 对象**（Request），不是 JSON 字符串；原生收到 `Array<var>`，取首元素校验，不额外 JSON 字符串化再解析。
- 前端错误处理统一：`reply.ok === true` 处理 payload；`reply.ok === false` 读取 `reply.error.code` + `reply.error.message`。两个分支互斥，绝不同时存在。

命名原因：

- 保持契约与实现一一对应：前端只依赖一个函数名，原生只负责一个函数分派表。
- 降低桥接面，符合"白名单 / 不暴露 shell / 不暴露任意文件"的工程底线。
