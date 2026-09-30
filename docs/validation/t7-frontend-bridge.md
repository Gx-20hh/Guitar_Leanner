# T7 前端桥接客户端 — 验证记录（Pi / w11）

日期：2026-09-30。
范围：仅 `frontend/` 与本文档。未改 `contracts/`、`native/`、根构建配置。
依据：负责人最终裁定 `docs/validation/t7-contract-review.md`（优先于契约草稿）与 `contracts/`（只读复核）。

## 契约只读复核结论
已通读 contracts/（README、ping-protocol、bridge-api、bridge-naming、error-codes、examples/*.json）与裁定文档。未发现前端无法落实的矛盾；前端按裁定实现。复核要点与实现一致：
- 入参为单个 JS 对象（非 JSON 字符串）；函数名仅 `guitarBridge`；`Promise<Reply>`。
- requestId：ASCII 1–64；message：Unicode 码点 1–256。
- ok 成功 / error 失败 互斥；ok 回固定 `pong from native`；错误允许 requestId 回填或 null。
- 前端须校验 version / ID / 分支互斥；null 或错 ID 不当成功；原生缺失明确未连接，不自动 mock。
- 只加载打包本地前端，不逃逸 ui 目录，无 WebView2 明确失败（属原生侧约束，已记录未实机验证）。

## 判定事项（用户提供，已采纳）
契约 `native/javascript/index.js` 路径在 JUCE 9.0.3 已废止（404）。正确官方目录为
`modules/juce_gui_extra/native/typescript/webview-interop`。见 `docs/validation/t7-helper-location.txt`。
宿主不自动提供 `./juce` 模块，因此前端在 `frontend/` 内 vendored 匹配版本 helper；不声明不存在的 ambient 模块。

## helper 来源与许可（保留完整第三方许可与版本）
- 包：`@juce-framework/webview` v1.0.0（license: `AGPL-3.0-only OR LicenseRef-JUCE`）。
- 来源：JUCE 9.0.3 官方仓库（git tag `9.0.3`）该目录原样文件。
- 获取失败记录：直接 `curl raw.githubusercontent.com` 连接被重置（TLS）；npm registry 指向国内镜像且该包 tarball 缺失（404）。经 `mcp__fetch` + GitHub git blob API 获取成功。
- vendored 位置：`frontend/vendor/juce-webview-interop/`，含 `dist/index.js`、`dist/index.d.ts`、`dist/index.js.map`、`dist/index.d.ts.map` 及 LICENSE.md / LICENSE-AGPL.md / LICENSE-JUCE.md / README.md。
- 字节级核验：用 git blob SHA-1（`sha1("blob <len>\0" + content)`）对照仓库记录，全部匹配：
  - index.js `abd3d2b86…`（19772 B）
  - index.d.ts `f0d02f77…`（9413 B）
  - index.js.map `a8b3dc6d…`（36529 B）
  - index.d.ts.map `bd76d6f1…`（2854 B）
- 许可文件原样保留（AGPL-3.0 / JUCE 双许可声明），未从无关版本抄 API；API 用法取自同名 9.0.3 的官方 `.d.ts`（`getNativeFunction(name: string): (...args)=>Promise<unknown>`）。
- 注意：`dist/index.js` 已内联 `check_native_interop`（运行时无独立文件），自包含。

## 交付文件（新增于既有骨架）
- `frontend/vendor/juce-webview-interop/`（上述 helper + 许可 + 说明）。
- `frontend/src/bridge/types.ts` — ping 协议类型镜像（权威源在 contracts/，本文件仅消费用）。
- `frontend/src/bridge/validators.ts` — requestId/message 口径与回复校验（分支/版本/ID/互斥）。
- `frontend/src/bridge/client.ts` — 桥接客户端：`runPing`（有限超时、校验、原生缺失检测）；`NativeTransport` 抽象，默认真实实现。
- `frontend/src/bridge/diagnostic.ts` — 已更新：按 `isNativeBridgeAvailable()` 如实反映"原生桥接是否注入"。
- `frontend/src/App.tsx`（已更新）— 新增"原生桥接自检"区：发送 ping 按钮、结果（pong from native / 错误码 / 校验失败 / 超时 / 原生不可用）、实际往返耗时；保留 GE200 未接入提示。
- `frontend/src/bridge/client.test.ts`、`validators.test.ts` — 客户端与校验单元测试（注入替身 transport，仅测试；实际 GUI 不 mock）。
- `frontend/vite.config.ts`、`frontend/tsconfig.json`（已更新）— 将 `@juce-framework/webview` 映射到 vendored 产物（运行时→index.js，类型→index.d.ts）。

## 执行的命令与退出码（本机实测）
| 命令 | 结果 | 退出码 |
|---|---|---|
| `npm run typecheck`（tsc --noEmit） | 无输出，通过 | 0 |
| `npm test`（vitest run） | 4 files / 24 tests passed | 0 |
| `npm run build`（tsc && vite build） | dist 生成（js gzip 51.17 kB；已含 vendored helper） | 0 |
| `npm run dev` + curl localhost | HTTP 200，标题"连接诊断"正确 | 0 |

测试覆盖：正常 ping、错误回复（E_UNKNOWN_COMMAND）、原生缺失（nativeUnavailable，且不触发 invoke）、有限超时（不把迟到回复当成功）、回复版本不符、ok/error 互斥违例、ok 回复 ID 不符/null、错误回复 ID 不符（非 null）、null 错误 ID 视为合法失败、requestId ASCII/长度边界、Unicode 码点口径（表情=1 码点、中文 1–256、超 256 回退默认）、生成 ID 唯一且 ASCII 1–64。

## 验证边界与限制
- 以上为前端本机实测。**未验证**：真实 WebView2 宿主内 request/reply、原生端实现、Windows CI、GE200 实机（均属后续联调/原生/硬件环节）。原生仍在开发（VS2022 Build Tools 已装、CMake 3.31.6 由用户确认）。
- 检测"原生可用"= `window.__JUCE__.initialisationData.__juce__functions` 是否含 `guitarBridge`（契约注入点）。mock 下该列表为空，故不会把 mock 当成功。
- 前端不拥有协议 DTO 定义权：`contracts/` 为权威；本文件类型仅镜像消费。
- 测试环境 stderr 出现 helper 的"window.__JUCE__ undefined…定义 placeholder"提示为预期无害输出（jsdom 无原生），且正因 mock 被排除才测得 nativeUnavailable。
- dist/、node_modules/、vendor 内 map 为构建/来源产物，属任务所需；`node_modules`、`dist` 由根 .gitignore 忽略（vendor 需保留并提交以供原生/ui 打包）。

## 运行入口
- 开发预览：`cd frontend && npm run dev` → http://localhost:5173/（页面含"发送 ping"）。
- typecheck / test / build：`npm run typecheck` / `npm test` / `npm run build`。
- 原生打包入口：`frontend/dist`（产物）与 `frontend/vendor/juce-webview-interop/`（helper 源与许可）。

## 联调事项（给原生/负责人）
- 契约裁定已允许实现；T7 最终放行仍需：真实宿主/前端构建、协议测试、WebView2 内 ping/reply 证据（非模型自述）。
- 原生将 `frontend/dist` 复制到 exe 旁 `ui/`，经 `withResourceProvider` 提供；前端按契约用 `getNativeFunction("guitarBridge")`。
- 我未领取 T11，未 commit/push，未改任务板。
