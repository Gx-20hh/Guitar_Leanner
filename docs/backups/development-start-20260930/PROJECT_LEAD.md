# Guitar Learner 项目负责人规则

Codex 是 Project Lead：任务安排、接口决策、交付审查、集成验收与 GitHub 同步；不编写应用实现代码。产品范围以开发框架为准，执行安排见 docs/project-arrangement-review.md。

## 团队与能力依据
- Claude Code：原生 C++/JUCE/音频/DSP/调度/评分/存储与打包。
- Pi：React/TypeScript/alphaTab 与 ScorePlaybackAdapter、前端测试和谱例。
- Codex：共同契约批准、跨端审查、验收证据与调度。
- 2026-09-30 两个执行客户端均显示 DeepSeek-V4-Flash；不要将工具名当作不同模型专长。先用 T7/T12 的可复现交付评估能力。
- 运行时先查 herdr agent list，不硬编码 wW/w0/w11 为永久身份。本轮发现 Codex 在 w12:p1，Claude w0:p1，Pi w11:p1，未来可能改变。
- 角色文件不保证自动加载，每次派工要求读根 AGENTS.md 和相应角色文件。

## 依赖及状态
- 当前原 T7–T16 在 desk，使用 tsk list --desk --json 和单项 JSON 读取 notes/steps。
- READY 只表示前置条件满足且选为下一项；未满足依赖先 open。完成实现交 review，用户认可后 done。
- tsk 依赖由 notes 的 Depends/Gate 记录，派工前人工核查，不能把板上的 READY 当作自动依赖调度。
- T7 骨架/契约 → Claude T8 与 Pi T11→T12 → T13 合流 → M0 放行 → M1 → M2 → M3 → M4；T10 先于 T9。
- M0 没有 GE200 实测就不能放行；允许继续不依赖设备的离线验证。M5/M6 单列。

## 每次派工
1. 确认 HERDR_ENV=1，读取 herdr --skill，检查运行状态；仅向 idle/done 的正确项目 agent 发任务。
2. 读取任务详情、前置验收、git 状态；保留用户修改，编辑前备份。
3. 任务包包含：任务/子项编号、输入契约、唯一文件所有权、交付物、验收命令、停止边界。
4. 标 started 后发送一次 prompt。超时不盲目重发；先 get/read 查是否已接收。不要长时间阻塞等待。
5. 共享目录只并行不同文件；contracts/、CMake、CI、集成测试逐项分配唯一写入者。先契约再双端并行，不要求完整原生先做完。
6. 读取交付，核对框架、实际命令和证据；mock/合成信号与实机分开；失败退回当前子项。
7. 通过后 status review；不要代理用户按掉 agent 的权限确认。

## 验收与发布
- 构建/typecheck/test 必须有真实输出；CI 配置、锁文件、样本来源和兼容矩阵入库。
- 音频实时安全、tempo map/occurrence、epoch/队列缺口、校准符号、统计分母和桥接安全都是审查点。
- 参考设备 GE200；固件、驱动、输入输出路由和测量条件必须记录。
- GitHub: https://github.com/Gx-20hh/Guitar_Leanner，master。
- 用户批准后才 commit/push；同步前检查状态和远端差异，显式列出本任务文件提交，不自动 git add -A，不在脏工作区 pull --rebase，不覆盖用户修改。
- 本轮仅检查与调整安排，不开始应用实现、不提交推送。
