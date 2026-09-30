# 桥接错误码（T7-A，审查修正版）

状态：契约已由项目负责人最终裁定（wire contract）。所有错误码属于 `Reply.error`；`ok:false` 与 `error` 是必需组合。

## 错误码清单（统一口径）

| 码 | 触发条件 | 校验阶段 | `requestId` |
|---|---|---|---|
| `E_MALFORMED_REQUEST` | JSON 无法解析，**或 `requestId` 非法**（缺失/非字符串/空/超长/非 ASCII） | 解析 | `null` |
| `E_VERSION_UNSUPPORTED` | `protocolVersion` 缺失或不为 `1` | 版本 | **回填**（若 requestId 有效可提取） |
| `E_UNKNOWN_COMMAND` | `type` 不在白名单命令集内 | 命令白名单 | **回填** |
| `E_BAD_PAYLOAD` | `type` 合法但 `payload` 无效（缺失/类型错/字段非法/长度越界） | payload | **回填** |

## 关键规则（与 ping-protocol.md 统一，不再矛盾）

1. **能回填 `requestId` 就必须回填**。只有 `E_MALFORMED_REQUEST`（请求无法解析或 requestId 本身非法）回 `null`。
2. **requestId 非法**（缺失/非字符串/空/ASCII 外/长度不在 1–64）→ 归入 `E_MALFORMED_REQUEST`，`null`。
3. 其余阶段失败（版本/命令/payload），只要 requestId 本身有效，就回填 requestId。
4. `requestId` 限定：**ASCII，长度 1–64 字符**。
5. `ping.payload.message` 限定：**按 Unicode 码点，长度 1–256**（可含中文）。
6. 两端（原生校验与前端生成）必须采用同一 ASCII / Unicode 码点口径。

## 校验顺序（原型约定）

1. JSON 解析失败 → `E_MALFORMED_REQUEST`，`requestId: null`
2. requestId 非法 → `E_MALFORMED_REQUEST`，`requestId: null`
3. protocolVersion 非法/不支持 → `E_VERSION_UNSUPPORTED`，回填 requestId（若有效）
4. type 不在白名单 → `E_UNKNOWN_COMMAND`，回填 requestId
5. payload 校验失败 → `E_BAD_PAYLOAD`，回填 requestId

## 约束

- 错误对象必含 `code`（枚举）与 `message`（ASCII 可读文本，仅诊断）。
- 同一时刻只允许一个错误码；按上述顺序返回首个失败。
- `message` 不得携带完整原始请求文本（避免把可能敏感内容回传页面日志）。
- 新增命令与新增错误码必须先登记本清单再实现。

## 未来扩展（只记录，不实现）

设备、输入电平、校准、评分等后续命令的错误码，在 T7-B/T8 各自任务前按同样流程（契约先行）登记。
