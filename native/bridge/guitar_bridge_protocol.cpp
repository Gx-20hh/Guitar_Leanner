#include "guitar_bridge_protocol.h"

namespace guitar_bridge {

juce::String extractStringField(const juce::var& obj, const juce::String& name)
{
    auto* props = obj.getDynamicObject();
    if (props == nullptr)
        return {};

    auto value = props->getProperty (name);
    if (value.isString())
        return value.toString();

    return {};
}

juce::var getField(const juce::var& obj, const juce::String& name)
{
    auto* props = obj.getDynamicObject();
    if (props == nullptr)
        return juce::var::undefined();

    return props->getProperty (name);
}

// 判断是否为合法 requestId：非空 ASCII 字符串，UTF-8 长度 1..kRequestIdMaxLength。
static bool isValidRequestId (const juce::String& s)
{
    if (s.isEmpty())
        return false;
    if (!s.isNotEmpty() || s.length() < 1 || s.length() > kRequestIdMaxLength)
        return false;
    // ASCII 校验：所有字符必须是 0x21..0x7E（可打印 ASCII，不含控制字符与空格）。
    // JUCE String 的 .length() 为 UTF-16 code unit 数；非 ASCII 会映射为多个 code unit，
    // 此处仅做 ASCII 逐字符校验避免误放行。
    bool asciiOnly = true;
    for (juce::CharPointer_UTF8 p = s.toUTF8(); *p != 0; ++p)
    {
        unsigned char u = static_cast<unsigned char> (*p);
        if (u < 0x21 || u > 0x7E)
        {
            asciiOnly = false;
            break;
        }
    }
    return asciiOnly;
}

// 计算 Unicode 码点数（UTF-8 解码，粗略按非 ASCII 连续字节统计）
static int unicodeCodepointCount (const juce::String& s)
{
    // 按 UTF-16 code unit 的 surrogate 对合并为 1 码点。
    int count = 0;
    int n = s.length();
    for (int i = 0; i < n; ++i)
    {
        juce::juce_wchar c = s[i];
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n)
        {
            juce::juce_wchar c2 = s[i + 1];
            if (c2 >= 0xDC00 && c2 <= 0xDFFF)
            {
                ++i;
            }
        }
        ++count;
    }
    return count;
}

bool isProtocolVersionSupported (const juce::String& versionJson)
{
    // protocolVersion 必须为整数 1。
    int v = versionJson.getIntValue();
    return v == kProtocolVersion;
}

// 组装 Reply var 对象（ok=true 或 error）。可序列化为 JSON，也可直接传 completion(var)。
static juce::var buildReplyVar (bool ok,
                                const juce::String& requestId,   // 空 → null
                                const juce::String& payloadMessage,
                                const juce::String& errorCode,
                                const juce::String& errorMessage)
{
    juce::var reply (new juce::DynamicObject());
    auto* obj = reply.getDynamicObject();
    jassert (obj != nullptr);

    obj->setProperty ("protocolVersion", kProtocolVersion);
    if (requestId.isEmpty())
        obj->setProperty ("requestId", juce::var());
    else
        obj->setProperty ("requestId", requestId);
    obj->setProperty ("ok", ok);

    if (ok)
    {
        juce::var payload (new juce::DynamicObject());
        payload.getDynamicObject()->setProperty ("message", payloadMessage);
        obj->setProperty ("payload", payload);
    }
    else
    {
        juce::var err (new juce::DynamicObject());
        err.getDynamicObject()->setProperty ("code", errorCode);
        err.getDynamicObject()->setProperty ("message", errorMessage);
        obj->setProperty ("error", err);
    }

    return reply;
}

static juce::String buildReply (bool ok,
                                const juce::String& requestId,
                                const juce::String& payloadMessage,
                                const juce::String& errorCode,
                                const juce::String& errorMessage)
{
    return juce::JSON::toString (buildReplyVar (ok, requestId, payloadMessage, errorCode, errorMessage), true);
}

ValidateResult validateAndParse (const juce::String& requestJson, ParsedRequest& out)
{
    ValidateResult result;

    juce::var parsed;
    juce::Result parseResult = juce::JSON::parse (requestJson, parsed);

    if (parseResult.failed())
    {
        result.errorCode = "E_MALFORMED_REQUEST";
        result.errorMessage = "request could not be parsed; no requestId extractable";
        result.requestIdAvailable = false;
        return result;
    }

    if (!parsed.isObject())
    {
        result.errorCode = "E_MALFORMED_REQUEST";
        result.errorMessage = "request root must be a JSON object";
        result.requestIdAvailable = false;
        return result;
    }

    juce::String requestId = extractStringField (parsed, "requestId");
    if (!isValidRequestId (requestId))
    {
        // requestId 非法 → 统一 E_MALFORMED_REQUEST，null
        result.errorCode = "E_MALFORMED_REQUEST";
        result.errorMessage = "requestId must be a non-empty ASCII string of length 1..64";
        result.requestIdAvailable = false;
        return result;
    }
    result.requestId = requestId;
    result.requestIdAvailable = true;

    // 版本
    juce::var version = getField (parsed, "protocolVersion");
    if (!version.isInt() || version.toString().getIntValue() != kProtocolVersion)
    {
        result.errorCode = "E_VERSION_UNSUPPORTED";
        result.errorMessage = "protocolVersion is not supported; current version is 1";
        result.ok = false;
        return result;
    }

    // 命令白名单
    juce::String type = extractStringField (parsed, "type");
    if (type != "ping")
    {
        result.errorCode = "E_UNKNOWN_COMMAND";
        result.errorMessage = "command not allowed: " + type;
        return result;
    }

    // payload
    auto payload = getField (parsed, "payload");
    if (!payload.isObject())
    {
        result.errorCode = "E_BAD_PAYLOAD";
        result.errorMessage = "payload must be an object";
        return result;
    }

    juce::String message = extractStringField (payload, "message");
    if (message.isEmpty() || unicodeCodepointCount (message) < 1
        || unicodeCodepointCount (message) > kMessageMaxLength)
    {
        result.errorCode = "E_BAD_PAYLOAD";
        result.errorMessage = "payload.message must be a non-empty string of length 1..256 (unicode codepoints)";
        return result;
    }

    out.requestId = requestId;
    out.type = type;
    out.message = message;
    out.hasMessage = true;

    result.ok = true;
    return result;
}

juce::String makePingReply (const juce::String& requestJson)
{
    return juce::JSON::toString (makePingReplyVar (requestJson), true);
}

juce::var makePingReplyVar (const juce::String& requestJson)
{
    ParsedRequest parsed;
    ValidateResult result = validateAndParse (requestJson, parsed);

    if (result.ok)
    {
        // 成功回复固定 message "pong from native"
        return buildReplyVar (true, result.requestId, "pong from native", {}, {});
    }

    // 失败回复：能回填则回填 requestId，否则 null
    if (result.requestIdAvailable && !result.requestId.isEmpty())
        return buildReplyVar (false, result.requestId, {}, result.errorCode, result.errorMessage);
    return buildReplyVar (false, {}, {}, result.errorCode, result.errorMessage);
}

} // namespace guitar_bridge
