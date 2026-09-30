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
    deviceManager_.closeAudioDevice();
}

juce::Array<DeviceInfo> DeviceInput::enumerateInputDevices()
{
    juce::Array<DeviceInfo> result;

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
            info.backendType = typeName;
            info.isAsio = (typeName == "ASIO");
            info.inputChannels = -1; // unknown：枚举不打开设备；真实通道开在 openDevice 成功后
            result.add (info);
        }
    }

    return result;
}

// 解析 "backend::deviceName"；后端名与设备名分离。
static bool splitDeviceId (const juce::String& deviceId, juce::String& backend, juce::String& deviceName)
{
    const int sep = deviceId.indexOf ("::");
    if (sep < 0)
        return false;

    backend    = deviceId.substring (0, sep);
    deviceName = deviceId.substring (sep + 2);
    return backend.isNotEmpty() && deviceName.isNotEmpty();
}

bool DeviceInput::openDevice (const juce::String& deviceId,
                              double sampleRate,
                              int bufferSize,
                              int inputChannelsToOpen)
{
    // 确定性参数预校验：先于任何设备枚举/closeDevice/掩码分配。64 是分配安全上界，非硬件能力。
    if (! std::isfinite (sampleRate) || sampleRate <= 0.0)
    {
        lastError_ = "invalid sampleRate: must be finite and positive";
        return false;
    }
    if (bufferSize <= 0)
    {
        lastError_ = "invalid bufferSize: must be positive";
        return false;
    }
    if (inputChannelsToOpen < 1 || inputChannelsToOpen > 64)
    {
        lastError_ = "invalid inputChannelsToOpen: must be in 1..64";
        return false;
    }

    if (deviceId.isEmpty())
    {
        lastError_ = "deviceId must be in 'backend::name' form";
        return false;
    }

    juce::String backend, deviceName;
    if (! splitDeviceId (deviceId, backend, deviceName))
    {
        lastError_ = "deviceId must be in 'backend::name' form: " + deviceId;
        return false;
    }

    // 预校验后端类型存在，避免 JUCE initialiseFromXML 在未知 deviceType 时静默回退
    // 到第一个可用类型（见 JUCE 源码 findType(currentDeviceType)==nullptr 分支）。
    // 同时校验请求的设备名在该后端下可见：两者都以列表核对为准。
    {
        bool backendKnown = false;
        bool deviceVisible = false;
        const auto& types = deviceManager_.getAvailableDeviceTypes(); // 内部会先扫描
        for (auto* type : types)
        {
            const auto typeName = type->getTypeName();
            if (typeName == backend)
            {
                backendKnown = true;
                deviceVisible = type->getDeviceNames (true).contains (deviceName);
                break;
            }
        }

        if (! backendKnown)
        {
            lastError_ = "unsupported backend '" + backend + "' not found in available device types";
            invalidateLevels();
            return false;
        }

        if (! deviceVisible)
        {
            lastError_ = "device '" + deviceName + "' not visible under backend '" + backend + "'";
            invalidateLevels();
            return false;
        }
    }

    // 显式关闭当前设备（若有）。
    closeDevice();

    // 构建 setup：仅输入通道，显式设备名、采样率、缓冲。
    juce::AudioDeviceManager::AudioDeviceSetup setup;
    setup.inputDeviceName = deviceName;
    setup.sampleRate = sampleRate;
    setup.bufferSize = bufferSize;
    setup.useDefaultInputChannels = false;
    setup.inputChannels.setRange (0, inputChannelsToOpen, true);

    // initialiseFromXML：xml 携带 deviceType 以显式限定后端，不静默回退默认后端。
    // selectDefaultDeviceOnFailure=false：失败返回错误串，不降级到其他设备。
    // JUCE 的 initialiseFromXML 会以 xml 属性覆盖 setup：缺 audioDeviceInChans 时
    // useDefaultInputChannels 置 true 并忽略 setup.inputChannels 掩码。因此显式写入
    // 采样率、缓冲与输入通道掩码（"1"×inputChannelsToOpen），确保请求被应用。
    juce::XmlElement setupXml ("DEVICESETUP");
    setupXml.setAttribute ("deviceType", backend);
    setupXml.setAttribute ("audioInputDeviceName", deviceName);
    setupXml.setAttribute ("audioDeviceRate", sampleRate);
    setupXml.setAttribute ("audioDeviceBufferSize", bufferSize);

    juce::String inputChansMask;
    for (int i = 0; i < inputChannelsToOpen; ++i)
        inputChansMask += "1";
    setupXml.setAttribute ("audioDeviceInChans", inputChansMask);

    const juce::String err = deviceManager_.initialise (inputChannelsToOpen, 0, &setupXml, false, {}, &setup);
    if (err.isNotEmpty())
    {
        lastError_ = "open failed: " + err;
        invalidateLevels();
        return false;
    }

    auto* device = deviceManager_.getCurrentAudioDevice();
    if (device == nullptr)
    {
        lastError_ = "no current audio device after open";
        invalidateLevels();
        return false;
    }

    // 记录消息线程快照（此后仅消息线程读；回调不触达）。
    settings_.deviceId = deviceId;
    settings_.backendType = backend;
    settings_.isAsio = (backend == "ASIO");
    settings_.sampleRate = device->getCurrentSampleRate();
    settings_.bufferSize = device->getCurrentBufferSizeSamples();
    settings_.inputChannelsOpen = inputChannelsToOpen;
    settings_.totalInputChannels = device->getActiveInputChannels().countNumberOfSetBits();
    settings_.running = true;

    // 新纪元：样本时钟归零，epoch 递增（不再声称跨 reopen 单调连续）。
    clockSamples_.store (0);
    clockEpoch_.fetch_add (1);
    invalidateLevels();

    // 用实际采样率/缓冲配置 PeakHold（消息线程，非实时）。
    peakHold_ = PeakHold (3 /*windowSeconds*/, (int) settings_.sampleRate, std::max (1, settings_.bufferSize));

    deviceManager_.addAudioCallback (&inputCallback_);

    running_.store (true);
    settings_.running = true;
    lastError_.clear();
    return true;
}

void DeviceInput::closeDevice()
{
    if (deviceManager_.getCurrentAudioDevice() != nullptr)
        deviceManager_.removeAudioCallback (&inputCallback_);

    deviceManager_.closeAudioDevice();
    running_.store (false);
    settings_.running = false;
    invalidateLevels();
}

bool DeviceInput::isRunning() const noexcept { return running_.load(); }

DeviceSettings DeviceInput::getSettings() const noexcept
{
    // 消息线程读取：静态设备参数（settings_）不动；running 实时取自原子 running_，
    // 确保 audioDeviceStopped 后 getSettings().running 为 false，不残留 true。
    auto s = settings_;
    s.running = running_.load();
    return s;
}

juce::int64 DeviceInput::getClockSamples() const noexcept { return clockSamples_.load(); }
juce::uint64 DeviceInput::getClockEpoch() const noexcept { return clockEpoch_.load(); }

double DeviceInput::getLatestRmsLinear() const noexcept { return latestRmsLinear_.load(); }
double DeviceInput::getLatestRmsDbfs() const noexcept { return latestRmsDbfs_.load(); }
float DeviceInput::getLatestPeakHold() const noexcept { return latestPeakHold_.load(); }
bool DeviceInput::getLatestClipped() const noexcept { return latestClipped_.load(); }

void DeviceInput::invalidateLevels() noexcept
{
    latestRmsLinear_.store (0.0);
    latestRmsDbfs_.store (-std::numeric_limits<double>::infinity());
    latestPeakHold_.store (0.0f);
    latestClipped_.store (false);
}

void DeviceInput::invalidateOnStop() noexcept
{
    // 实时线程（audioDeviceStopped 回调）；不写消息线程专有的 settings_。
    running_.store (false);
    invalidateLevels();
}

void DeviceInput::handleAudioCallback (const float* const* inputChannelData, int numInputChannels, int numSamples)
{
    // 实时回调：无阻塞锁、无 IO、无堆分配。
    if (numSamples <= 0)
        return;

    clockSamples_.fetch_add (numSamples);

    // 无输入通道或通道数据为空：失效陈旧电平，不推进 RMS/峰值。
    if (numInputChannels <= 0 || inputChannelData == nullptr || inputChannelData[0] == nullptr)
    {
        invalidateLevels();
        return;
    }

    const float* ch = inputChannelData[0];
    double sum = 0.0;
    bool clipped = false;
    float blockPeak = 0.0f;
    for (int i = 0; i < numSamples; ++i)
    {
        const float s = ch[i];
        const float a = std::fabs (s);
        if (a >= 0.999f) clipped = true;
        if (a > blockPeak) blockPeak = a;
        sum += static_cast<double> (s) * static_cast<double> (s);
    }

    const double rms = std::sqrt (sum / static_cast<double> (numSamples));
    latestRmsLinear_.store (rms);
    latestRmsDbfs_.store (rms > 0.0 ? 20.0 * std::log10 (rms) : -std::numeric_limits<double>::infinity());
    latestPeakHold_.store (peakHold_.push (blockPeak));
    latestClipped_.store (clipped);
}

} // namespace guitar_learner::audio
