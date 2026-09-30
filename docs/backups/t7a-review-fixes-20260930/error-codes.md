# 桥接错误码（T7-A 契约）

状态：草稿，待 Pi 复核后冻结。所有错误码属于 Reply.error；`ok:false` 与 `error` 是必需组合。

| 码 | 触发条件 | 校验阶段 | requestId |
|---|---|---|---|
| `E_MALFORMED_REQUEST` | JSON 无法解析，或顶层结构/类型损坏，无法安全提取 `requestId` | 解析 | `null`（无法安全提取时） |
| `E_VERSION_UNSUPPORTED` | `protocolVersion` 缺失或不为 `1` | 版本 | 若能提取则回填，否则 `null` |
| `E_UNKNOWN_COMMAND` | `type` 不在白名单命令集内 | 命令白名单 | 回填（若已提取） |
| `E_BAD_PAYLOAD` | `type` 合法但 `payload` 无效（缺失/类型错/字段非法/长度越界） | payload | 回填 |

约束：

- 错误对象必含 `code`（上述枚举）与 `message`（ASCII 可读文本，仅诊断）。
- 同一时刻只允许一个错误码。按 解析 → 版本 → 白名单 → payload 顺序返回首个失败。
- `message` 不得携带完整原始请求文本，避免把可能的敏感内容回传给页面日志。
- `E_MALFORMED_REQUEST` 的 `requestId` 固定为 `null`；其余错误尽量回填，若提取失败也回 `null`。
- 本清单是契约的一部分，新增命令与新增错误码必须先登记本清单再实现。

## 未来扩展（只记录，不实现）

- 设备、输入等级、校准、评分等后续命令的错误码，在 T7-B/T8 各自任务前按同样流程（契约先行）登记。
