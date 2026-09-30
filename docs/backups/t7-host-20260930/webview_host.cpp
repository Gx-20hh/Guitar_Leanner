#include "webview_host.h"
#include "guitar_bridge_protocol.h"
#include <juce_gui_basics/juce_gui_basics.h>

namespace guitar_learner {

namespace
{

// 根据扩展名推断 MIME（仅资源根内部静态资源）。
juce::String mimeForExtension (const juce::String& ext)
{
    if (ext == "html") return "text/html; charset=utf-8";
    if (ext == "js")   return "application/javascript; charset=utf-8";
    if (ext == "css")  return "text/css; charset=utf-8";
    if (ext == "svg")  return "image/svg+xml";
    if (ext == "png")  return "image/png";
    if (ext == "jpg" || ext == "jpeg") return "image/jpeg";
    if (ext == "json") return "application/json; charset=utf-8";
    if (ext == "ico")  return "image/x-icon";
    if (ext == "woff")  return "font/woff";
    if (ext == "woff2") return "font/woff2";
    if (ext == "ttf")   return "font/ttf";
    if (ext == "map")   return "application/json; charset=utf-8";
    return "application/octet-stream";
}

// 规范化路径分隔符为 '/'
juce::String normalizedPath (const juce::String& p)
{
    return juce::File::createFileWithoutCheckingPath (p).getFullPathName()
               .replaceCharacter ('\\', '/');
}

} // namespace

WebViewHost::WebViewHost()
{
    juce::File ui = uiDir();

    // 前端资源根：exe 旁的 ui/ 目录。
    // 只允许该目录内的相对路径；路径以 '/' 开头映射到 ui 目录文件；严格限制逃逸。
    auto resourceProvider = [this, ui] (const juce::String& url)
        -> std::optional<juce::WebBrowserComponent::Resource>
    {
        // 只允许 ui/ 下的相对或根相对路径
        auto rootNorm = normalizedPath (ui.getFullPathName());
        auto pathNorm = normalizedPath (url);

        // 拒绝绝对外部路径和含 ".." 的逃逸
        if (pathNorm.startsWith ("/"))
            pathNorm = pathNorm.fromFirstOccurrenceOf ("/", false, false);

        auto file = ui.getChildFile (pathNorm);
        auto fileNorm = normalizedPath (file.getFullPathName());

        if (fileNorm.contains (".."))
            return std::nullopt;

        // 必须位于 ui/ 下
        if (!fileNorm.startsWith (rootNorm))
            return std::nullopt;

        if (file.existsAsFile())
        {
            juce::WebBrowserComponent::Resource res;
            res.mimeType = mimeForExtension (file.getFileExtension().fromFirstOccurrenceOf (".", false, false).toLowerCase());
            auto stream = file.createInputStream();
            if (stream == nullptr)
                return std::nullopt;
            const auto size = (size_t) file.getSize();
            res.data.resize (size);
            if (size > 0 && stream->read (res.data.data(), (int) size) != (int) size)
                return std::nullopt;
            return res;
        }
        return std::nullopt;
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

    // areOptionsSupported 是 WebBrowserComponent 的静态方法（不是 Options 的），
    // 在完整 Options 上探测后端/原生集成/资源提供是否可用。
    bool supported = juce::WebBrowserComponent::areOptionsSupported (options);

    if (supported)
    {
        browser_ = std::make_unique<juce::WebBrowserComponent> (options);
        browser_->goToURL ("ui/index.html");
        addAndMakeVisible (browser_.get());
    }

    statusLabel_.setText (supported
                          ? "WebView2 runtime available"
                          : "WebView2 runtime NOT available: cannot create browser",
                          juce::dontSendNotification);
    statusLabel_.setColour (juce::Label::textColourId, supported
                            ? juce::Colours::limegreen
                            : juce::Colours::red);
    addAndMakeVisible (statusLabel_);
    setSize (900, 600);
}

juce::File WebViewHost::uiDir() const
{
    auto exe = juce::File::getSpecialLocation (juce::File::currentExecutableFile);
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
    if (browser_ != nullptr)
        browser_->setBounds (area);
    statusLabel_.setBounds (area.removeFromBottom (24));
}

void WebViewHost::handleNativeFunction (const juce::Array<juce::var>& args,
                                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    // 契约：唯一函数 guitarBridge(request)，request 是 JS 对象（第一个参数）。
    if (args.size() < 1 || !args[0].isObject())
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

    // request 是 JS 对象；将其交给协议校验器（校验器接收 JSON 文本，得到一致判定逻辑）。
    auto requestJson = juce::JSON::toString (args[0], true);
    auto replyObj = guitar_bridge::makePingReplyVar (requestJson);

    // completion 接收 var；直接把 Reply 对象（JS 对象）传入，前端获得 Promise<Reply>。
    completion (replyObj);
}

} // namespace guitar_learner
