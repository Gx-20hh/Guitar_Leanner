#pragma once

// Guitar Learner 桥接协议校验器（原生侧）
// 契约：contracts/ping-protocol.md、contracts/error-codes.md（T7-A 审查修正版）
// 本文件可直接作为非 GUI 单元测试目标编译（不依赖 WebBrowserComponent）。

#include <juce_core/juce_core.h>

namespace guitar_bridge {

// protocolVersion 当前锁定为 1。
inline constexpr int kProtocolVersion = 1;

// protocolVersion、命令、requestId 上限契约常量
inline constexpr int kRequestIdMaxLength = 64;
inline constexpr int kMessageMaxLength = 256;

// 解析后的命令结构；仅存放有效字段（校验后无歧义）
struct ParsedRequest
{
    juce::String requestId;
    juce::String type;
    juce::String message; // ping.payload.message
    bool hasMessage = false;
};

// 校验结果：成功时 ok=true；失败时 code/message 填充
struct ValidateResult
{
    bool ok = false;
    juce::String errorCode;
    juce::String errorMessage;
    // 在回填 requestId 的校验阶段有效；见 error-codes.md
    bool requestIdAvailable = false;
    juce::String requestId;
};

// 返回用于回复的 JSON 字符串（完整 Reply）。request 原样字符串。
// 若无法安全提取 requestId，回填 null。
juce::String makePingReply(const juce::String& requestJson);

// 返回用于回复的 var 对象（完整 Reply）。兼容 completion(var) 直接传递，避免 JSON 字符串嵌套。
juce::var makePingReplyVar(const juce::String& requestJson);

// 校验并解析 request；失败时 ValidateResult.errorCode 有值。
ValidateResult validateAndParse(const juce::String& requestJson, ParsedRequest& out);

// 辅助：从 JSON 顶层提取 String 字段（不在 object? 返回无效）
juce::String extractStringField(const juce::var& obj, const juce::String& name);

} // namespace guitar_bridge
