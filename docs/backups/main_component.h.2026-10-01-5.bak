#pragma once

// Guitar Learner 主窗口组件（T7-B）
// 内嵌 WebViewHost（WebView2 前端）。最小 GUI：只加载打包前端本地资源。

#include <juce_gui_basics/juce_gui_basics.h>
#include "webview_host.h"

namespace guitar_learner {

class MainComponent : public juce::Component
{
public:
    MainComponent();

private:
    WebViewHost webViewHost_;
};

} // namespace guitar_learner
