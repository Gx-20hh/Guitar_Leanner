# T7 桥接契约裁定

负责人 Codex 已审查 T7-A 草案。以下修正是本轮原生/前端实现的统一依据，Claude负责同步 contracts/，Pi只读并检查消费一致性。2026-09-30。

- JUCE 固定 9.0.3。areOptionsSupported 为 WebBrowserComponent 静态方法；不使用不存在的 withFrontendWindowing、WindowCreationType::Puppeteer 或 hostObjects。
- Options 使用 webview2 backend、native integration、withNativeFunction 和 resource provider。原生函数名只有 guitarBridge。
- 传输参数是一个 JS 对象，返回 Promise<reply>；不把对象再转为 JSON 字符串传入。
- request: protocolVersion=1（整数），requestId为1–64个ASCII字符（非空），type=ping，payload.message为1–256个Unicode码点。
- 成功: protocolVersion=1、相同requestId、ok=true、payload.message固定为 pong from native；不得含error。
- 失败: protocolVersion=1、requestId为安全可提取的合法ID或null、ok=false、error包含code/message；不得含payload。
- 验证顺序: 顶层对象与ID结构→版本→命令→payload。顶层/ID坏为E_MALFORMED_REQUEST；版本错E_VERSION_UNSUPPORTED；非ping命令E_UNKNOWN_COMMAND；payload错E_BAD_PAYLOAD。
- 能安全提取合法ID就回填（包括其他结构失败）；ID本身缺失/非法时null。错误文案不包含完整原始请求。
- 前端必须校验回复的version、ID、ok分支互斥和payload/error结构。null或错ID不能当作成功；原生不存在时明确未连接，不能隐式用mock顶替。
- 客户端采用有限超时并释放待处理状态；迟到回复不改变已结束请求状态。开发诊断UI提供ping按钮和清晰成功/失败结果。
- 关键用例：正常ping、错误版本、未知命令、缺/空/过长ID、缺/空/非字符串message、Unicode码点边界、错误ID回复、互斥字段违反、原生不可用、超时。
- 只加载已打包的本地前端。拒绝跳转到外部文档；资源请求不能逃逸ui目录。不存在WebView2时明确失败，不悄悄降到IE。

契约本身通过上述修正后允许实现；T7最终放行仍需本机真实宿主/前端构建、协议测试和WebView2 ping/reply证据。模型自述不代替这些证据。
