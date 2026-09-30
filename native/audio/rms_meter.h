#pragma once

// RMS 电平计算（T8）
// 仅依赖 juce_core：无窗口/GUI/音频设备依赖，可独立单测。
// 实时回调安全：owned 存储预分配于非实时线程（构造/setup 时），回调内 push 只更新状态，无分配/锁/IO。

#include <juce_core/juce_core.h>

#include <vector>

namespace guitar_learner::audio {

// 计算一个 block 的 RMS（线性振幅）。用于设备输入通道电平。
// samples 为 float 缓冲区；blockSize 为样本数。
// 返回线性 RMS（0..~1.0）。空 block 返回 0。
double calculateRms (const float* samples, int blockSize) noexcept;

// 将线性 RMS 转为 dBFS。<=0 输入返回负无穷（-inf），否则 20*log10(rms)。
double rmsToDbfs (double rms) noexcept;

// 峰值保持器：跨 block 维护一窗口内峰值，用于电平表"峰值保持"展示。
// 容量在构造时以 窗口秒数 × sampleRate / blockSize 计算，prepared 于非实时线程；
// push() 在实时回调调用，只读写 std::vector 已有元素（无分配），线程安全由调用约定保证。
class PeakHold
{
public:
    PeakHold () noexcept = default;

    // blockSize 需与实际音频回调块大小一致，否则窗口时长失真。
    PeakHold (int windowSeconds, int sampleRate, int blockSize) noexcept;

    // 输入本 block 峰值（线性），返回当前保持值。push 不分配内存。
    float push (float blockPeak) noexcept;
    void reset() noexcept;

    // 若窗口未配置（默认构造），当前值恒为 0
    bool isConfigured() const noexcept { return cap_ > 0; }
    float current() const noexcept { return held_; }

private:
    std::vector<float> history_;
    int cap_ = 0;
    int writeIndex_ = 0;
    int filled_ = 0;
    float held_ = 0.0f;
};

} // namespace guitar_learner::audio
