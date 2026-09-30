# contracts/ 目录说明

本目录保存原生 ↔ 前端桥接的可版本化契约。当前产物（T7-A，草稿待冻结）：

| 文件 | 内容 |
|---|---|
| `ping-protocol.md` | ping 请求/回复协议：消息结构、字段约束、错误关联、版本 |
| `error-codes.md` | 错误码清单与处理顺序 |
| `bridge-api.md` | WebView2/JUCE 桥接 API 选择与页面加载来源限制 |
| `bridge-naming.md` | 原生函数名与前端调用约定 |
| `examples/*.json` | 成功/失败/错误 JSON 示例 |

使用规则：

- 同一时段只有一个写入者。当前 T7-A 由 Claude（原生端）写 envelope，Pi 复核后冻结。
- 冻结后 T7-B 原生实现与 Pi 前端按这份契约并行开发。
- 新增命令/错误码必须先更新本目录（契约先行），再实现。
- 版本锁定：JUCE 9.0.3。不使用 hostObjects；只用 WebBrowserComponent Options 的原生集成函数。
