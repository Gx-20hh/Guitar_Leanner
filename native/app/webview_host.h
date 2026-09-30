#pragma once

// Guitar Learner WebView2 宿主（T7-B）
// 锁定 JUCE 9.0.3 Options API：withBackend(webview2) / withNativeIntegrationEnabled /
// withNativeFunction("guitarBridge", ...) / withResourceProvider。
// 前端打包（Pi 负责）复制到 exe 旁 ui/ 目录；withResourceProvider 只允许该资源根。
// WebView2 Runtime 缺失时明确失败，不静默降级到 IE。

#include <juce_gui_extra/juce_gui_extra.h>
#include <juce_gui_basics/juce_gui_basics.h>

namespace guitar_learner {

class WebViewHost : public juce::Component
{
public:
    WebViewHost();

    // 若本机 WebView2 runtime 缺失（areOptionsSupported 返回 false），显示明确错误。
    bool isRuntimeAvailable() const;
    juce::String runtimeStatus() const;
    void resized() override;

private:
    std::unique_ptr<juce::WebBrowserComponent> browser_;
    juce::Label statusLabel_;

    // 资源根：默认 exe 旁 ui/ 目录（构建时已复制）。
    juce::File uiDir() const;

    // 桥接回调用（guitarBridge(request) Promise）。
    void handleNativeFunction (const juce::Array<juce::var>& args,
                               juce::WebBrowserComponent::NativeFunctionCompletion completion);
};

} // namespace guitar_learner
