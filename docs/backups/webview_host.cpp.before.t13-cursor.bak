#include "webview_host.h"
#include "guitar_bridge_protocol.h"
#include "transport/transport.h"
#include <juce_gui_basics/juce_gui_basics.h>
#include <vector>

namespace guitar_learner {

namespace
{

juce::String mimeForExtension (const juce::String& ext)
{
    if (ext == "html")     return "text/html; charset=utf-8";
    if (ext == "js")       return "application/javascript; charset=utf-8";
    if (ext == "css")      return "text/css; charset=utf-8";
    if (ext == "svg")      return "image/svg+xml";
    if (ext == "png")      return "image/png";
    if (ext == "jpg" || ext == "jpeg") return "image/jpeg";
    if (ext == "json")     return "application/json; charset=utf-8";
    if (ext == "ico")      return "image/x-icon";
    if (ext == "woff")     return "font/woff";
    if (ext == "woff2")    return "font/woff2";
    if (ext == "ttf")      return "font/ttf";
    if (ext == "map")      return "application/json; charset=utf-8";
    return "application/octet-stream";
}

juce::String parseRelPath (const juce::String& requestPath, bool& ok)
{
    ok = false;
    if (! requestPath.startsWithChar ('/'))
        return {};
    const juce::String rel = requestPath.substring (1);
    if (rel.startsWithChar ('/') || rel.contains ("\\") || rel.contains (":")
        || rel.contains ("?") || rel.contains ("#"))
        return {};
    ok = true;
    return rel;
}

} // namespace

ResourceResolution WebViewHost::resolveResourcePath (const juce::File& root, const juce::String& requestPath)
{
    ResourceResolution result;
    if (! root.isDirectory())
    {
        result.error = "resource root directory missing";
        return result;
    }

    bool parsedOk = false;
    juce::String rel = parseRelPath (requestPath, parsedOk);
    if (! parsedOk)
    {
        result.error = "rejected: malformed resource request";
        return result;
    }

    if (rel.isEmpty())
        rel = "index.html";

    juce::StringArray segments;
    segments.addTokens (rel, "/", juce::StringRef());
    for (const auto& seg : segments)
    {
        if (seg.isEmpty() || seg == "." || seg == ".." || seg.contains ("\\") || seg.contains (":"))
        {
            result.error = "rejected: invalid path segment";
            return result;
        }
    }

    const auto rootNorm = juce::File::createFileWithoutCheckingPath (root.getFullPathName()).getFullPathName();
    const auto candidate = root.getChildFile (rel);
    const auto candNorm = juce::File::createFileWithoutCheckingPath (candidate.getFullPathName()).getFullPathName();

    if (! candNorm.startsWith (rootNorm + juce::File::getSeparatorString()))
    {
        result.error = "rejected: path escapes resource root";
        return result;
    }

    if (! candidate.existsAsFile())
    {
        result.error = "missing resource: " + rel;
        return result;
    }

    result.ok = true;
    result.file = candidate;
    return result;
}

WebViewHost::WebViewHost (Transport& transport)
    : transport_ (transport),
      resourceRootUrl_ (juce::WebBrowserComponent::getResourceProviderRoot())
{
    const juce::File ui = uiDir();

    auto resourceProvider = [ui] (const juce::String& url)
        -> std::optional<juce::WebBrowserComponent::Resource>
    {
        auto res = WebViewHost::resolveResourcePath (ui, url);
        if (! res.ok)
            return std::nullopt;

        juce::WebBrowserComponent::Resource out;
        out.mimeType = mimeForExtension (res.file.getFileExtension()
                                             .fromFirstOccurrenceOf (".", false, false).toLowerCase());
        auto stream = res.file.createInputStream();
        if (stream == nullptr)
            return std::nullopt;

        const auto size = static_cast<size_t> (res.file.getSize());
        out.data.resize (size);
        if (size > 0 && stream->read (out.data.data(), static_cast<int> (size)) != static_cast<int> (size))
            return std::nullopt;

        return out;
    };

    auto options = juce::WebBrowserComponent::Options{}
        .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled()
        .withNativeFunction ("guitarBridge",
                             [this] (const juce::Array<juce::var>& args,
                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
                             {
                                 handleNativeFunction (args, completion);
                             })
        .withResourceProvider (resourceProvider);

    const bool supported = juce::WebBrowserComponent::areOptionsSupported (options);

    if (supported)
    {
        browser_ = std::make_unique<BridgedBrowser> (options, *this);
        browser_->goToURL (resourceRootUrl_);
        addAndMakeVisible (browser_.get());
    }

    statusLabel_.setText (supported
                          ? "WebView2 runtime available"
                          : "WebView2 runtime NOT available: cannot create browser",
                          juce::dontSendNotification);
    statusLabel_.setColour (juce::Label::textColourId,
                            supported ? juce::Colours::limegreen : juce::Colours::red);
    addAndMakeVisible (statusLabel_);
    setSize (900, 600);
}

juce::File WebViewHost::uiDir() const
{
    const auto exe = juce::File::getSpecialLocation (juce::File::currentExecutableFile);
    return exe.getParentDirectory().getChildFile ("ui");
}

bool WebViewHost::isRuntimeAvailable() const { return browser_ != nullptr; }

juce::String WebViewHost::runtimeStatus() const
{
    return browser_ ? "WebView2 runtime available" : "WebView2 runtime NOT available";
}

void WebViewHost::resized()
{
    auto area = getLocalBounds();
    statusLabel_.setBounds (area.removeFromBottom (24));
    if (browser_ != nullptr)
        browser_->setBounds (area);
}

void WebViewHost::handleNativeFunction (const juce::Array<juce::var>& args,
                                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() < 1 || ! args[0].isObject())
    {
        juce::var err (new juce::DynamicObject());
        err.getDynamicObject()->setProperty ("protocolVersion", 1);
        err.getDynamicObject()->setProperty ("requestId", juce::var());
        err.getDynamicObject()->setProperty ("ok", false);
        juce::var errobj (new juce::DynamicObject());
        errobj.getDynamicObject()->setProperty ("code", "E_MALFORMED_REQUEST");
        errobj.getDynamicObject()->setProperty ("message", "expected a request object as first argument");
        err.getDynamicObject()->setProperty ("error", errobj);
        completion (err);
        return;
    }

    const auto requestId = guitar_bridge::extractStringField (args[0], "requestId");
    const auto type = guitar_bridge::extractStringField (args[0], "type");

    juce::var reply;

    if (type == "ping")
        reply = guitar_bridge::makePingReplyVar (juce::JSON::toString (args[0], false));
    else if (type == "play")
        reply = handlePlay (args[0]);
    else if (type == "pause")
        reply = handlePause (args[0]);
    else if (type == "stop")
        reply = handleStop (args[0]);
    else if (type == "seek")
        reply = handleSeek (args[0]);
    else if (type == "setSpeed")
        reply = handleSetSpeed (args[0]);
    else if (type == "setLoop")
        reply = handleSetLoop (args[0]);
    else if (type == "loadScore")
        reply = handleLoadScore (args[0]);
    else if (type == "getTransportPosition")
        reply = handleGetTransportPosition (args[0]);
    else
        reply = makeError (requestId, "E_UNKNOWN_COMMAND", "command not allowed: " + type);

    completion (reply);
}

juce::var WebViewHost::handlePlay (const juce::var& request)
{
    transport_.play();
    return makeReply (guitar_bridge::extractStringField (request, "requestId"), juce::var());
}

juce::var WebViewHost::handlePause (const juce::var& request)
{
    transport_.pause();
    return makeReply (guitar_bridge::extractStringField (request, "requestId"), juce::var());
}

juce::var WebViewHost::handleStop (const juce::var& request)
{
    transport_.stop();
    return makeReply (guitar_bridge::extractStringField (request, "requestId"), juce::var());
}

juce::var WebViewHost::handleSeek (const juce::var& request)
{
    const auto requestId = guitar_bridge::extractStringField (request, "requestId");
    auto payload = guitar_bridge::getField (request, "payload");
    if (! payload.isObject())
        return makeError (requestId, "E_BAD_PAYLOAD", "payload must be an object with 'tick'");

    const int tick = getIntField (payload, "tick", -1);
    if (tick < 0)
        return makeError (requestId, "E_BAD_PAYLOAD", "payload.tick must be a non-negative integer");

    transport_.seek (tick);
    return makeReply (requestId, juce::var());
}

juce::var WebViewHost::handleSetSpeed (const juce::var& request)
{
    const auto requestId = guitar_bridge::extractStringField (request, "requestId");
    auto payload = guitar_bridge::getField (request, "payload");
    if (! payload.isObject())
        return makeError (requestId, "E_BAD_PAYLOAD", "payload must be an object with 'ratio'");

    juce::var ratioField = guitar_bridge::getField (payload, "ratio");
    if (! (ratioField.isInt() || ratioField.isDouble()))
        return makeError (requestId, "E_BAD_PAYLOAD", "payload.ratio must be a number");

    transport_.setSpeed (static_cast<double> (ratioField));
    return makeReply (requestId, juce::var());
}

juce::var WebViewHost::handleSetLoop (const juce::var& request)
{
    const auto requestId = guitar_bridge::extractStringField (request, "requestId");
    auto payload = guitar_bridge::getField (request, "payload");
    if (! payload.isObject())
        return makeError (requestId, "E_BAD_PAYLOAD", "payload must be an object with 'startTick'/'endTick'");

    const int startTick = getIntField (payload, "startTick", -1);
    const int endTick = getIntField (payload, "endTick", -1);
    if (startTick < 0 || endTick < 0 || startTick >= endTick)
        return makeError (requestId, "E_BAD_PAYLOAD", "loop range invalid");

    transport_.setLoop (startTick, endTick);
    return makeReply (requestId, juce::var());
}

juce::var WebViewHost::handleLoadScore (const juce::var& request)
{
    const auto requestId = guitar_bridge::extractStringField (request, "requestId");
    auto payload = guitar_bridge::getField (request, "payload");
    if (! payload.isObject())
        return makeError (requestId, "E_BAD_PAYLOAD", "payload must be an object with 'events' array");

    auto eventsField = guitar_bridge::getField (payload, "events");
    if (! eventsField.isArray())
        return makeError (requestId, "E_BAD_PAYLOAD", "payload.events must be an array");

    auto* arr = eventsField.getArray();
    if (arr == nullptr)
        return makeError (requestId, "E_BAD_PAYLOAD", "payload.events array unreadable");

    std::vector<TransportMidiEvent> events;
    events.reserve (static_cast<size_t> (arr->size()));

    for (const auto& item : *arr)
    {
        if (! item.isObject())
            continue;

        TransportMidiEvent ev{};
        ev.tick = getIntField (item, "tick", 0);
        ev.type = static_cast<TransportMidiEvent::EventType> (getIntField (item, "type", 0));
        ev.channel = getIntField (item, "channel", 0);
        ev.key = getIntField (item, "key", 0);
        ev.velocity = getIntField (item, "velocity", 0);
        ev.length = getIntField (item, "length", 0);
        ev.tempoBpm = getIntField (item, "tempoBpm", 120);
        ev.timeSigNum = getIntField (item, "timeSigNum", 4);
        ev.timeSigDen = getIntField (item, "timeSigDen", 4);
        events.push_back (ev);
    }

    transport_.loadScore (events.data(), static_cast<int> (events.size()));

    juce::var replyPayload (new juce::DynamicObject());
    replyPayload.getDynamicObject()->setProperty ("count", static_cast<int> (events.size()));
    return makeReply (requestId, replyPayload);
}

juce::var WebViewHost::handleGetTransportPosition (const juce::var& request)
{
    const auto requestId = guitar_bridge::extractStringField (request, "requestId");

    juce::var payload (new juce::DynamicObject());
    payload.getDynamicObject()->setProperty ("tick", transport_.currentTick());
    payload.getDynamicObject()->setProperty ("playing", transport_.isPlaying());
    payload.getDynamicObject()->setProperty ("positionSeconds", transport_.positionSeconds());
    payload.getDynamicObject()->setProperty ("speed", transport_.speedRatio());

    return makeReply (requestId, payload);
}

juce::var WebViewHost::makeError (const juce::String& requestId,
                                  const juce::String& code,
                                  const juce::String& message)
{
    juce::var reply (new juce::DynamicObject());
    auto* obj = reply.getDynamicObject();
    obj->setProperty ("protocolVersion", guitar_bridge::kProtocolVersion);
    if (requestId.isEmpty())
        obj->setProperty ("requestId", juce::var());
    else
        obj->setProperty ("requestId", requestId);
    obj->setProperty ("ok", false);

    juce::var err (new juce::DynamicObject());
    err.getDynamicObject()->setProperty ("code", code);
    err.getDynamicObject()->setProperty ("message", message);
    obj->setProperty ("error", err);

    return reply;
}

juce::var WebViewHost::makeReply (const juce::String& requestId, const juce::var& payload)
{
    juce::var reply (new juce::DynamicObject());
    auto* obj = reply.getDynamicObject();
    obj->setProperty ("protocolVersion", guitar_bridge::kProtocolVersion);
    if (requestId.isEmpty())
        obj->setProperty ("requestId", juce::var());
    else
        obj->setProperty ("requestId", requestId);
    obj->setProperty ("ok", true);
    if (payload.isUndefined())
        obj->setProperty ("payload", juce::var());
    else
        obj->setProperty ("payload", payload);
    return reply;
}

int WebViewHost::getIntField (const juce::var& obj, const juce::String& name, int defaultValue)
{
    auto value = guitar_bridge::getField (obj, name);
    if (value.isInt() || value.isDouble())
        return static_cast<int> (value);
    return defaultValue;
}

bool WebViewHost::BridgedBrowser::pageAboutToLoad (const juce::String& url)
{
    return url == owner_.resourceRootUrl_
        || url.startsWith (owner_.resourceRootUrl_);
}

void WebViewHost::BridgedBrowser::newWindowAttemptingToLoad (const juce::String& url)
{
    juce::ignoreUnused (url);
}

} // namespace guitar_learner
