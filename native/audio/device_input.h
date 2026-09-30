#pragma once

// 设备输入层（T8）：AudioDeviceManager 封装 + 单一原生样本时钟 + 实时安全 RMS。
// 只做输入采集与电平；不做评分/伴奏/录音（后续任务）。
//
// 线程所有权：
//   - 枚举/openDevice/closeDevice/getSettings/getLastError：仅消息线程调用。
//   - 音频回调（InputCallback）：实时线程；只推进样本时钟、写原子电平槽、读 PeakHold。
//   - 电平读（getLatest*）：可被消息线程/UI 轮询；原子读。
//   - settings_ 只在 openDevice 成功（消息线程）写入，仅消息线程读取，不回调读写。

#include <juce_audio_devices/juce_audio_devices.h>
#include "rms_meter.h"

#include <atomic>
#include <limits>
#include <cmath>

namespace guitar_learner::audio {

// 设备参数快照（消息线程所有权，openDevice 后写入；不回调读写、不跨线程拷贝）
struct DeviceSettings
{
    juce::String deviceId;      // "backend::name"
    juce::String backendType;   // "ASIO" / "WASAPI"（getTypeName）
    bool isAsio = false;
    double sampleRate = 0.0;
    int bufferSize = 0;
    int inputChannelsOpen = 0;
    int totalInputChannels = 0;
    bool running = false;
};

// 枚举结果（用于 listDevices）。inputChannels=-1 表示未知：枚举不打开设备，\
// 真实通道数须在 openDevice 成功后从设备查询（totalInputChannels 与 getActiveInputChannels）。
struct DeviceInfo
{
    juce::String deviceId;      // "backend::name"，openDevice 用同一字符串
    juce::String name;
    juce::String backendType;
    bool isAsio = false;
    int inputChannels = -1;     // -1 = unknown（不打开设备探测）
};

class DeviceInput
{
public:
    DeviceInput();
    ~DeviceInput();

    // 枚举当前可见输入设备（消息线程）。不打开任何设备。
    juce::Array<DeviceInfo> enumerateInputDevices();

    // 以 "backend::name" 打开输入。仅消息线程。
    // 后端显式指定（deviceId 前缀），未匹配后端/设备 => 失败，不静默回退默认设备。
    // 打开成功即开始新的样本时钟（clockEpoch 递增，clockSamples 置 0）。
    bool openDevice (const juce::String& deviceId,
                     double sampleRate = 48000.0,
                     int bufferSize = 256,
                     int inputChannelsToOpen = 1);

    // 停止设备：移除回调、清除运行态、失效电平。仅消息线程。
    void closeDevice();

    bool isRunning() const noexcept;

    // 消息线程读（非实时）；与回调无竞争（settings 不回调触达）。
    DeviceSettings getSettings() const noexcept;

    // 单一原生样本时钟：自本次 open 起的累计样本数（int64）。每次 open 重新置 0，
    // 伴随 clockEpoch 递增标志新纪元，不得当作跨 reopen 单调连续。
    juce::int64 getClockSamples() const noexcept;
    juce::uint64 getClockEpoch() const noexcept;

    // 最近一次 RMS / 峰值 / 削波（原子槽，可跨线程读）。
    // 无输入或停止后：rms=-inf、peak=0、clipped=false（陈旧电平失效）。
    double getLatestRmsLinear() const noexcept;
    double getLatestRmsDbfs() const noexcept;
    float getLatestPeakHold() const noexcept;
    bool getLatestClipped() const noexcept;

    // 实时回调入口（由 InputCallback 转发；实时线程）。
    void handleAudioCallback (const float* const* inputChannelData, int numInputChannels, int numSamples);

    juce::String getLastError() const noexcept { return lastError_; }

private:
    // JUCE 音频设备回调（实时线程）。转发 handleAudioCallback，并在停止时失效状态。
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
            owner_.invalidateOnStop();
        }

    private:
        DeviceInput& owner_;
    };

    // 设备停止/无输入：失效陈旧电平（消息线程标记 running=false 由 closeDevice 负责；
    // 此处只处理回调停止导致的电平失效，原子写，实时线程安全）。
    void invalidateLevels() noexcept;

    // audioDeviceStopped 回调触发（实时线程）-> 失效电平 + 标记未运行。
    // 注意：不能在实时线程改 settings_（消息线程所有权），只置 running 原子。
    void invalidateOnStop() noexcept;

    juce::AudioDeviceManager deviceManager_;
    InputCallback inputCallback_;
    std::atomic<bool> running_ { false };
    std::atomic<juce::int64> clockSamples_ { 0 };
    std::atomic<juce::uint64> clockEpoch_ { 0 };
    std::atomic<double> latestRmsLinear_ { 0.0 };
    std::atomic<double> latestRmsDbfs_ { -std::numeric_limits<double>::infinity() };
    std::atomic<float> latestPeakHold_ { 0.0f };
    std::atomic<bool> latestClipped_ { false };

    PeakHold peakHold_;        // 设备打开时以实际 bufferSize/sampleRate 配置（消息线程）
    DeviceSettings settings_;  // 消息线程所有权
    juce::String lastError_;
};

} // namespace guitar_learner::audio
