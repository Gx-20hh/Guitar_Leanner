#pragma once

// 设备输入层（T8）：AudioDeviceManager 封装 + 单一原生样本时钟 + 实时安全 RMS。
// 只做输入采集与电平；不做评分/伴奏/录音（后续任务）。
// 构造/枚举在主线程；音频回调只推进样本时钟与 RMS（无锁/无 IO/无堆分配）。

#include <juce_audio_devices/juce_audio_devices.h>
#include "rms_meter.h"

#include <atomic>
#include <limits>
#include <cmath>

namespace guitar_learner::audio {

// 设备参数快照（跨线程读取安全：不可变）
struct DeviceSettings
{
    juce::String deviceId;
    bool isAsio = false;
    double sampleRate = 0.0;
    int bufferSize = 0;
    int inputChannelsOpen = 0;
    int totalInputChannels = 0;
};

// 枚举一个后端下可见的输入设备（用于 listDevices）
struct DeviceInfo
{
    juce::String deviceId;
    juce::String name;
    bool isAsio = false;
    int inputChannels = 0;
};

class DeviceInput
{
public:
    DeviceInput();
    ~DeviceInput();

    // 枚举当前可见输入设备（ASIO 优先，WASAPI 次之）。调用自非实时线程。
    juce::Array<DeviceInfo> enumerateInputDevices();

    // 以指定设备/采样率/缓冲打开输入。返回成功与否；失败时 lastError 说明。
    bool openDevice (const juce::String& deviceId,
                     double sampleRate = 48000.0,
                     int bufferSize = 256,
                     int inputChannelsToOpen = 1);

    bool isRunning() const noexcept;

    // 读取线程安全快照（非实时线程用；实时回调写，此处只读原子）
    DeviceSettings getSettings() const noexcept;

    // 当前累计样本数（int64），单一原生样本时钟来源。
    juce::int64 getClockSamples() const noexcept;

    // 最近一次 RMS 与峰值（无锁，简单原子槽）。供 UI 非实时轮询/事件。
    double getLatestRmsLinear() const noexcept;
    double getLatestRmsDbfs() const noexcept;
    float getLatestPeakHold() const noexcept;
    bool getLatestClipped() const noexcept;

    // 实时回调：每次回调调用（由设备管理器驱动）。
    // 计算当前块 RMS、推进样本时钟、维护削波标记。
    void handleAudioCallback (const float* const* inputChannelData, int numInputChannels, int numSamples);

    juce::String getLastError() const noexcept { return lastError_; }

private:
    // JUCE 音频设备回调：把设备 IO 回调转发到 DeviceInput::handleAudioCallback（实时线程）。
    class InputCallback final : public juce::AudioIODeviceCallback
    {
    public:
        explicit InputCallback (DeviceInput& owner) : owner_ (owner) {}

        void audioDeviceIOCallbackWithContext (const float* const* inputChannelData,
                                               int numInputChannels,
                                               float* const* outputChannelData,
                                               int numOutputChannels,
                                               int numSamples,
                                               const juce::AudioIODeviceCallbackContext& context) override
        {
            juce::ignoreUnused (outputChannelData, numOutputChannels, context);
            owner_.handleAudioCallback (inputChannelData, numInputChannels, numSamples);
        }

        void audioDeviceAboutToStart (juce::AudioIODevice* device) override
        {
            juce::ignoreUnused (device);
        }

        void audioDeviceStopped() override
        {
            // 设备停止：样本时钟冻结（不置零，调用方按 epoch 语义处理）。
        }

    private:
        DeviceInput& owner_;
    };

    // 内部状态（仅主线程/回调访问）
    juce::AudioDeviceManager deviceManager_;
    InputCallback inputCallback_;
    std::atomic<juce::int64> clockSamples_ { 0 };
    std::atomic<double> latestRmsLinear_ { 0.0 };
    std::atomic<double> latestRmsDbfs_ { -std::numeric_limits<double>::infinity() };
    std::atomic<float> latestPeakHold_ { 0.0f };
    std::atomic<bool> latestClipped_ { false };
    std::atomic<bool> running_ { false };

    PeakHold peakHold_;
    DeviceSettings settings_;
    juce::String lastError_;
    // 预分配回调内 RMS 用的小缓冲（可选，回调内逐样本累积即可，无需额外分配）
};

} // namespace guitar_learner::audio
