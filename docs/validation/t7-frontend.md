# T7 前端独立骨架 — 验证记录（Pi / w11）

日期：2026-09-30
范围：仅 `frontend/` 与本文档。未改 `contracts/`、`native/`、根构建配置。未实现桥接传输。

## 任务定位
建立 React / TypeScript / Vite 最小本地诊断页与锁文件，提供 typecheck / test / build 脚本。
定位为**开发阶段连接诊断**，如实标为未连接；不假装接入参考设备 MOOER GE200（未实机验收）。
桥接传输协议由 Claude 起草、经冻结后才接入；本子项不实现任何传输，只做独立前端。

## 交付文件
- `frontend/package.json` — 依赖与脚本
- `frontend/package-lock.json` — npm 锁文件（v3 格式）
- `frontend/vite.config.ts` — Vite + Vitest 共用配置（jsdom 环境；`@bridge` 别名）
- `frontend/tsconfig.json` — strict TS 配置（仅包含 src）
- `frontend/index.html` — 入口
- `frontend/src/main.tsx` — React 挂载
- `frontend/src/App.tsx` — 诊断页组件
- `frontend/src/styles.css` — 视觉（暖炭基色 + 黄铜状态带，左对齐单栏）
- `frontend/src/bridge/diagnostic.ts` — 本地诊断状态（明确"未连接，协议待冻结"）
- `frontend/src/bridge/diagnostic.test.ts` — 逻辑单元测试
- `frontend/src/App.test.tsx` — 组件冒烟测试
- `frontend/src/test-utils.tsx` — 最小测试工具（@testing-library/react）
- `docs/validation/t7-frontend.md` — 本文档

未创建：bridge 传输/客户端（协议未冻结）；alphaTab（T11）；音频/评分（原生端）。

## 执行的命令与退出码
在当前目录执行（Windows；RTK 代理下用 bash 壳）：
| 命令 | 结果 | 退出码 |
|---|---|---|
| `node --version` / `npm --version` | v24.14.0 / 11.12.1 | 0 |
| `npm install` | added 168 packages | 0 |
| `npm run typecheck`（tsc --noEmit） | 无输出，通过 | 0 |
| `npm test`（vitest run） | 2 files / 3 tests passed | 0 |
| `npm run build`（tsc --noEmit && vite build） | dist 产物，gzip js 47.16 kB | 0 |
| `npm run dev` + curl `http://localhost:5173/` | HTTP 200，标题"连接诊断"正确 | 0 |

## 验证边界与限制
- 以上均为我本机实测结果。**未验证**：WebView2 宿主内加载、原生 request/reply、CI、GE200 实机连接（均未开展）。
- 桥接传输未实现：无 mock 冒充原生接通；页面只读展示"未连接"。诊断状态来自 `getConnectorDiagnostic()`，如实返回 `disconnected` / `transportReady=false`。
- 稳定 DTO 的类型归属 `contracts/`，本子项未复制协议 DTO；待契约冻结后在 `frontend/` 接桥接客户端。
- 安装走网络，锁文件已固化依赖；`node_modules/`、`dist/` 由根 `.gitignore` 忽略。

## 运行入口
- 开发预览：`cd frontend && npm run dev` → 打开 http://localhost:5173/
- 类型检查：`npm run typecheck`；测试：`npm test`；构建：`npm run build`

## 联调事项（待契约冻结后）
协议冻结后，由 Pi 在 `frontend/` 实现桥接客户端，与原生 request/reply 联调，再用 mock 辅助但不代替；最终以真实 WebView2 request/reply 验收（对齐安排文档 T7-C）。
