#pragma once

// RMS 电平计算（T8）
// 仅依赖 juce_core：无窗口/GUI/音频设备依赖，可独立单测。
// 实时回调安全：预分配缓冲，无锁/IO/堆分配。调用仅推进状态与新样本。

#include <juce_core/juce_core.h>

namespace guitar_learner::audio {

// 计算一个 block 的 RMS（线性振幅）。用于设备输入通道电平。
// samples 为 float 缓冲区；blockSize 为样本数。
// 返回线性 RMS（0..~1.0）。空 block 返回 0。
double calculateRms (const float* samples, int blockSize) noexcept;

// 将线性 RMS 转为 dBFS。<=0 输入返回负无穷（-inf），否则 20*log10(rms)。
double rmsToDbfs (double rms) noexcept;

// 峰值保持器：跨 block 维护一窗口内峰值，用于电平表"峰值保持"展示。
// 预分配固定窗口；可在实时回调使用。
class PeakHold
{
public:
    explicit PeakHold (int windowSecondsAt48k = 3, int sampleRate = 48000) noexcept;

    // 输入本 block 峰值（线性），返回当前保持值
    float push (float blockPeak) noexcept;
    void reset() noexcept;

    float current() const noexcept { return held_; }

private:
    float* history_;
    int cap_;
    int writeIndex_ = 0;
    int filled_ = 0;
    float held_ = 0.0f;
};

} // namespace guitar_learner::audio
