#include "device_input.h"

namespace guitar_learner::audio {

DeviceInput::DeviceInput()
    : inputCallback_ (*this)
{
}

DeviceInput::~DeviceInput()
{
    // 顺序析构：先移除回调再析构（AudioDeviceManager RAII 负责设备关闭）。
    deviceManager_.removeAudioCallback (&inputCallback_);
}

juce::Array<DeviceInfo> DeviceInput::enumerateInputDevices()
{
    juce::Array<DeviceInfo> result;

    // 枚举字符串：AudioDeviceManager 返回“设备类型::设备名称”格式，如 "ASIO::foo"、"WASAPI::bar"。
    const auto& types = deviceManager_.getAvailableDeviceTypes();
    for (auto* type : types)
    {
        const auto typeName = type->getTypeName();
        const auto names = type->getDeviceNames (true); // 只列输入
        for (const auto& name : names)
        {
            DeviceInfo info;
            info.deviceId = typeName + "::" + name;
            info.name = name;
            info.isAsio = (typeName == "ASIO");
            info.inputChannels = 2; // 占位；精确通道数由打开时协商
            result.add (info);
        }
    }

    return result;
}

bool DeviceInput::openDevice (const juce::String& deviceId,
                              double sampleRate,
                              int bufferSize,
                              int inputChannelsToOpen)
{
    // 停止当前活动设备（若在运行）。
    if (running_.load())
    {
        deviceManager_.removeAudioCallback (&inputCallback_);
        deviceManager_.closeAudioDevice();
        running_.store (false);
    }

    juce::AudioDeviceManager::AudioDeviceSetup setup;
    if (! deviceId.isEmpty())
    {
        // deviceId 形如 "ASIO::xxx" 或 "WASAPI::xxx"；仅输入场景，放入 inputDeviceName。
        setup.inputDeviceName = deviceId;
    }
    setup.sampleRate = sampleRate;
    setup.bufferSize = bufferSize;
    setup.useDefaultInputChannels = false;
    setup.inputChannels.setRange (0, inputChannelsToOpen, true);

    // initialise 第 6 参 preferredSetupOptions：直接用它打开指定输入设备。
    const juce::String error = deviceManager_.initialise (inputChannelsToOpen, 0, nullptr, true, {}, &setup);
    if (error.isNotEmpty())
    {
        lastError_ = "initialise failed: " + error;
        return false;
    }

    auto* device = deviceManager_.getCurrentAudioDevice();
    if (device == nullptr)
    {
        lastError_ = "no current audio device after setup";
        return false;
    }

    settings_.deviceId = deviceId.isEmpty() ? device->getTypeName() : deviceId;
    settings_.isAsio = (device->getTypeName() == "ASIO");
    settings_.sampleRate = device->getCurrentSampleRate();
    settings_.bufferSize = device->getCurrentBufferSizeSamples();
    settings_.inputChannelsOpen = inputChannelsToOpen;
    settings_.totalInputChannels = device->getActiveInputChannels().countNumberOfSetBits();

    // 设备管理器调用回调。我们不在此注册回调（由上层 DeviceInputCallback 注册）。
    // 回调由 deviceManager_ 的 audioIODeviceCallback 驱动；此处仅记录设备参数。
    clockSamples_.store (0);
    latestRmsLinear_.store (0.0);
    latestClipped_.store (false);
    peakHold_.reset();
    latestPeakHold_.store (0.0f);

    // 注册回调以驱动实时输入
    deviceManager_.addAudioCallback (&inputCallback_);

    running_.store (true);
    lastError_.clear();
    return true;
}

bool DeviceInput::isRunning() const noexcept { return running_.load(); }

DeviceSettings DeviceInput::getSettings() const noexcept { return settings_; }

juce::int64 DeviceInput::getClockSamples() const noexcept { return clockSamples_.load(); }

double DeviceInput::getLatestRmsLinear() const noexcept { return latestRmsLinear_.load(); }
double DeviceInput::getLatestRmsDbfs() const noexcept { return latestRmsDbfs_.load(); }
float DeviceInput::getLatestPeakHold() const noexcept { return latestPeakHold_.load(); }
bool DeviceInput::getLatestClipped() const noexcept { return latestClipped_.load(); }

void DeviceInput::handleAudioCallback (const float* const* inputChannelData, int numInputChannels, int numSamples)
{
    // 实时回调：无阻塞锁、无 IO、无堆分配。
    if (numInputChannels <= 0 || numSamples <= 0)
    {
        clockSamples_.fetch_add (numSamples > 0 ? numSamples : 0);
        latestClipped_.store (false);
        return;
    }

    const float* ch = inputChannelData[0];
    double sum = 0.0;
    bool clipped = false;
    for (int i = 0; i < numSamples; ++i)
    {
        const float s = ch[i];
        const float a = std::fabs (s);
        if (a >= 0.999f) clipped = true;
        sum += static_cast<double> (s) * static_cast<double> (s);
    }

    const double rms = std::sqrt (sum / static_cast<double> (numSamples));
    latestRmsLinear_.store (rms);
    latestRmsDbfs_.store (rms > 0.0 ? 20.0 * std::log10 (rms) : -std::numeric_limits<double>::infinity());

    // 峰值（块峰值用于 PeakHold）
    float blockPeak = 0.0f;
    for (int i = 0; i < numSamples; ++i)
    {
        const float a = std::fabs (ch[i]);
        if (a > blockPeak) blockPeak = a;
    }
    latestPeakHold_.store (peakHold_.push (blockPeak));
    latestClipped_.store (clipped);

    clockSamples_.fetch_add (numSamples);
}

} // namespace guitar_learner::audio
