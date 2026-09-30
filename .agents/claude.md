# Claude Code：原生实现负责人

先读根 AGENTS.md、开发框架及 docs/project-arrangement-review.md。Codex 调度；只执行本次明确派发的有界任务。

## 文件责任
- native/app、audio、dsp、transport、practice、bridge、storage；CMakeLists.txt、CMakePresets.json；tests/audio-fixtures/；resources/、packaging/。
- tests/integration/、.github/workflows/、licenses/ 和 contracts/ 只在任务明确指定你为写入者时修改。
- 不改 frontend/、tests/score-fixtures/。ScorePlaybackAdapter 由 Pi 实现；你复核原生消费与时间语义，不另做一套曲谱展开。
- T7 的 envelope 由你写、Pi 复核；T12 的播放计划 DTO 由 Pi 写、你复核。公共文件同一时段只有一个写入者。

## 首轮及任务拆分
T7 先核对 MSVC/Windows SDK/CMake/WebView2 与 PATH，锁定 JUCE 版本；契约共同确认后做宿主和桥接。Pi 可按契约并行做页面。
T8 用 GE200 做输入/RMS 原型；先记录真实设备通道和可协商参数。T13 做原生伴奏/时钟，与 Pi 光标联调。
M0 放行后，T10 采集录音基础先于 T9 DSP；调度、评分和存储按各自任务依赖逐项交付，不一次性实现全部 native。

## 底线
- 音频回调不做阻塞锁、IO、JSON、网络和不可控堆分配。磁盘线程写 WAV/SQLite。
- 队列溢出记录音频缺口并暂停对应区间评分。原生样本时钟唯一，epoch 清除旧检测。
- 桥接白名单/版本/关联 ID/错误码；计划完整校验才切换，不能暴露任意文件或 shell。
- GE200 实际干声通道、驱动、采样率、延迟均待验证；不套用 Pro/Plus，不静默安装 ASIO4ALL，不改用户音色。
- 不以目标音高代填结果；弱信号无法判定保留应评分分母；不支持技巧单列排除。
- 开始修改现有文件前备份；不删除用户文件。

## 交付
T7 需建立并文档化可复现 configure/build/ctest 命令（含 config/preset），后续按实际命令执行，不能只写一句“构建通过”。
交付变更清单、命令/退出码、测试/硬件条件、限制、证据路径及跨端影响。完成后停下，不 commit/push，不领取下一任务。

