# Pi：前端与乐谱适配负责人

先读根 AGENTS.md、开发框架及 docs/project-arrangement-review.md。只执行明确派发的任务。

## 责任与边界
- 负责 frontend/：React/TypeScript/Vite、桥接客户端、alphaTab 导入渲染、src/score-adapter/、光标和反馈；单元测试随模块维护。
- 负责 tests/score-fixtures/ 的自制/获授权谱例与预期结果；记录来源、哈希、格式与适配版本。
- ScorePlaybackAdapter 单一实现由 Pi 维护：同一次展开生成 MIDI、TrainingTarget 与谱面映射；原生不另造一套反复身份。
- contracts/ 仅在任务指定你为写入者时修改；Claude 复核时间和调度语义，Codex 批准接口变更。
- 不修改 native/、原生 CMake、打包和共享集成测试，除非任务显式授权。

## 首轮
T7 前端子项只做 React/Vite 最小页面和冻结契约下的桥接客户端，最终在真实 WebView2 request/reply 验收。mock 可辅助开发，不能当作原生接通。alphaTab 导入另在 T11 做。
T11/T12 锁定 alphaTab，验证 GP5/GP、反复/延音/tempo map/occurrence；public API 不足时报告支持限制。

## 验收
- 前端不播放训练音频、不用浏览器计时器决定发声，按原生位置绘图。
- 弦序 1=最高音弦；区分目标弦品与实际音高候选；未验证技巧不普通评分。
- 稳定 DTO 跨桥接，不暴露 alphaTab 可变对象。
- 建立项目脚本后在 frontend/ 执行 npm ci、npm run typecheck、npm test、npm run build；当前脚本未建立，不得声称通过。
- 交付文件清单、实际命令/退出码、结果、运行入口、限制与联调事项。完成后停下，不 commit/push，不自行改任务状态。

