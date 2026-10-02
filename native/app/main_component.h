#pragma once

// Guitar Learner 主窗口组件（T7-B + T13 原生伴奏）
// 内嵌 WebViewHost（WebView2 前端）并持有 Transport（原生样本时钟伴奏）。

#include <juce_gui_basics/juce_gui_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include "webview_host.h"
#include "transport/transport.h"

namespace guitar_learner {

class MainComponent : public juce::Component,
                      public juce::AudioIODeviceCallback
{
public:
    MainComponent();
    ~MainComponent() override;

    void audioDeviceAboutToStart (juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;
    void audioDeviceIOCallbackWithContext (const float* const* inputChannelData,
                                            int numInputChannels,
                                            float* const* outputChannelData,
                                            int numOutputChannels,
                                            int numSamples,
                                            const juce::AudioIODeviceCallbackContext& context) override;

private:
    void initAudio();
    void shutdownAudio();
    void loadDefaultSoundFont();

    juce::AudioDeviceManager deviceManager_;
    Transport transport_;
    WebViewHost webViewHost_;
    juce::AudioSampleBuffer inputBuffer_;
    juce::AudioSampleBuffer outputBuffer_;
};

} // namespace guitar_learner
