#include "guitar_bridge_protocol.h"
#include <juce_core/juce_core.h>
#include <iostream>

namespace guitar_bridge_test {

struct TestResult
{
    int passed = 0;
    int failed = 0;
    juce::String failureList;
};

static void runSingle (const juce::String& name, bool ok, TestResult& r)
{
    if (ok) { ++r.passed; }
    else { ++r.failed; r.failureList += name + "\n"; }
}

// 提取 reply JSON 的顶层字段
static juce::var replyField (const juce::String& replyJson, const juce::String& name)
{
    juce::var v;
    juce::JSON::parse (replyJson, v);
    if (v.isObject() && v.getDynamicObject())
        return v.getDynamicObject()->getProperty (name);
    return {};
}

// 提取 reply.error.code
static juce::String replyErrorCode (const juce::String& replyJson)
{
    auto err = replyField (replyJson, "error");
    if (err.isObject() && err.getDynamicObject())
        return err.getDynamicObject()->getProperty ("code").toString();
    return {};
}

int runAllTests()
{
    TestResult r;

    // 1. 正常 ping
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"req_abc\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"hello\"}}");
        runSingle ("valid: reply ok", replyField (reply, "ok").toString() == "1", r);
        runSingle ("valid: requestId echoed", replyField (reply, "requestId").toString() == "req_abc", r);
        auto payload = replyField (reply, "payload");
        runSingle ("valid: fixed message pong",
                   payload.isObject() && payload.getDynamicObject()->getProperty ("message").toString() == "pong from native", r);
        runSingle ("valid: no error field", !replyErrorCode (reply).isNotEmpty(), r);
    }

    // 2. requestId 非法（空）→ E_MALFORMED_REQUEST, null
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"hello\"}}");
        runSingle ("invalid id empty: ok=false", replyField (reply, "ok").toString() == "0", r);
        runSingle ("invalid id empty: requestId null",
                   replyField (reply, "requestId").isVoid() || replyField (reply, "requestId").isVoid(), r);
        runSingle ("invalid id empty: E_MALFORMED_REQUEST",
                   replyErrorCode (reply) == "E_MALFORMED_REQUEST", r);
    }

    // 3. requestId 非法（超长，65 字符）→ E_MALFORMED_REQUEST, null
    {
        juce::String longId;
        for (int i = 0; i < 65; ++i) longId += "a";
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"" + longId + "\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"hello\"}}");
        runSingle ("invalid id long: requestId null",
                   replyField (reply, "requestId").isVoid() || replyField (reply, "requestId").isVoid(), r);
        runSingle ("invalid id long: E_MALFORMED_REQUEST",
                   replyErrorCode (reply) == "E_MALFORMED_REQUEST", r);
    }

    // 4. requestId 非法（非 ASCII，中文）→ E_MALFORMED_REQUEST
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"id\\u4e2d6\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"hello\"}}");
        runSingle ("invalid id nonascii: E_MALFORMED_REQUEST",
                   replyErrorCode (reply) == "E_MALFORMED_REQUEST", r);
    }

    // 5. 错误版本 → E_VERSION_UNSUPPORTED, 回填 requestId
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":3,\"requestId\":\"req_abc\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"hello\"}}");
        runSingle ("bad version: E_VERSION_UNSUPPORTED",
                   replyErrorCode (reply) == "E_VERSION_UNSUPPORTED", r);
        runSingle ("bad version: requestId echoed valid",
                   replyField (reply, "requestId").toString() == "req_abc", r);
    }

    // 6. 未知命令 → E_UNKNOWN_COMMAND, 回填 requestId
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"req_abc\",\"type\":\"frobnicate\","
            "\"payload\":{}}");
        runSingle ("unknown cmd: E_UNKNOWN_COMMAND",
                   replyErrorCode (reply) == "E_UNKNOWN_COMMAND", r);
        runSingle ("unknown cmd: requestId echoed valid",
                   replyField (reply, "requestId").toString() == "req_abc", r);
    }

    // 7. payload.message 空 → E_BAD_PAYLOAD, 回填 requestId
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"req_abc\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"\"}}");
        runSingle ("bad payload empty: E_BAD_PAYLOAD",
                   replyErrorCode (reply) == "E_BAD_PAYLOAD", r);
        runSingle ("bad payload empty: requestId echoed valid",
                   replyField (reply, "requestId").toString() == "req_abc", r);
    }

    // 8. payload.message 缺失 → E_BAD_PAYLOAD
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"req_abc\",\"type\":\"ping\",\"payload\":{}}");
        runSingle ("bad payload missing: E_BAD_PAYLOAD",
                   replyErrorCode (reply) == "E_BAD_PAYLOAD", r);
    }

    // 9. payload.message 超长（257 个 a）→ E_BAD_PAYLOAD
    {
        juce::String longMsg;
        for (int i = 0; i < 257; ++i) longMsg += "a";
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"req_abc\",\"type\":\"ping\","
            "\"payload\":{\"message\":\"" + longMsg + "\"}}");
        runSingle ("bad payload long: E_BAD_PAYLOAD",
                   replyErrorCode (reply) == "E_BAD_PAYLOAD", r);
    }

    // 10. payload 不是对象 → E_BAD_PAYLOAD
    {
        auto reply = guitar_bridge::makePingReply (
            "{\"protocolVersion\":1,\"requestId\":\"req_abc\",\"type\":\"ping\","
            "\"payload\":42}");
        runSingle ("bad payload notobj: E_BAD_PAYLOAD",
                   replyErrorCode (reply) == "E_BAD_PAYLOAD", r);
    }

    // 11. 根不是对象 → E_MALFORMED_REQUEST, null
    {
        auto reply = guitar_bridge::makePingReply ("[1,2,3]");
        runSingle ("root not obj: E_MALFORMED_REQUEST",
                   replyErrorCode (reply) == "E_MALFORMED_REQUEST", r);
        runSingle ("root not obj: requestId null",
                   replyField (reply, "requestId").isVoid() || replyField (reply, "requestId").isVoid(), r);
    }

    // 12. 非法 JSON（非 JSON 文本）→ E_MALFORMED_REQUEST
    {
        auto reply = guitar_bridge::makePingReply ("not json at all");
        runSingle ("bad json: E_MALFORMED_REQUEST",
                   replyErrorCode (reply) == "E_MALFORMED_REQUEST", r);
    }

    juce::String summary = juce::String::formatted ("passed: %d, failed: %d", r.passed, r.failed);
    std::cout << summary << "\n";
    if (r.failed > 0)
        std::cout << "FAILURES:\n" << r.failureList;

    return r.failed == 0 ? 0 : 1;
}

} // namespace guitar_bridge_test

int main()
{
    return guitar_bridge_test::runAllTests();
}
