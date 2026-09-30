# T7 开发状态

2026-09-30 用户授权启动开发；tsk T7 已设 started。历史安排核查文档中的“本轮不开发”指之前的核查轮，不限制本轮。

- Claude：先在 contracts/ 交付最小 ping 协议；负责人批准后做 native/、CMake、CI 和原生测试。
- Pi：先独立完成 frontend/ 骨架；协议冻结后接客户端。两端不能同时写 contracts/。
- Codex：安装/核对工具链、审查契约、检查交付并做实际桌面集成验收。
- 原生前置：WebView2 Runtime 154.0.4258.37 已存在；VS2022 C++ Build Tools 正通过 winget 安装，不自动重启。
- 参考设备仍为 GE200；本任务不打开音频设备、不安装或切换声卡驱动。
- 最终验收必须是 Windows 原生宿主加载本地前端，真实 ping/reply，且错误请求路径有测试。浏览器 mock 不能替代。
- 构建、前端检查、原生测试和实际 UI 验证尚未全部完成；不能将本任务标 done。

更新：VS2022 BuildTools 17.14.41 C++ workload 安装成功；vswhere 检测完整安装，附带 CMake 3.31.6-msvc6 可运行。Pi 前端骨架 typecheck/test/build 通过（3 tests）；T7 前端配置步骤已完成，正接入冻结契约。
