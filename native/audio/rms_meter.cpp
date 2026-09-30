#include "rms_meter.h"

#include <cmath>

namespace guitar_learner::audio {

double calculateRms (const float* samples, int blockSize) noexcept
{
    if (samples == nullptr || blockSize <= 0)
        return 0.0;

    double sum = 0.0;
    for (int i = 0; i < blockSize; ++i)
    {
        const float s = samples[i];
        sum += static_cast<double> (s) * static_cast<double> (s);
    }

    return std::sqrt (sum / static_cast<double> (blockSize));
}

double rmsToDbfs (double rms) noexcept
{
    if (rms <= 0.0)
        return -std::numeric_limits<double>::infinity();

    return 20.0 * std::log10 (rms);
}

PeakHold::PeakHold (int windowSeconds, int sampleRate, int blockSize) noexcept
{
    // 每 block 一个槽位：容量 = 窗口秒数 × (sampleRate / blockSize)。
    const int sr = std::max (1, sampleRate);
    const int bs = std::max (1, blockSize);
    const int blocksPerSec = std::max (1, sr / bs);
    const int windowBlocks = std::max (1, windowSeconds * blocksPerSec);

    history_.resize (static_cast<size_t> (windowBlocks)); // prepared 于非实时线程
    cap_ = windowBlocks;
    reset();
}

void PeakHold::reset() noexcept
{
    if (cap_ > 0)
    {
        for (int i = 0; i < cap_; ++i)
            history_[static_cast<size_t> (i)] = 0.0f;
    }
    writeIndex_ = 0;
    filled_ = 0;
    held_ = 0.0f;
}

float PeakHold::push (float blockPeak) noexcept
{
    if (cap_ <= 0)
    {
        // 未配置：不推进保持值（避免吞掉第一次输入）。保持 0。
        return 0.0f;
    }

    history_[static_cast<size_t> (writeIndex_)] = blockPeak;
    writeIndex_ = (writeIndex_ + 1) % cap_;

    if (filled_ < cap_)
        ++filled_;

    float maxV = 0.0f;
    const int limit = filled_ < cap_ ? filled_ : cap_;
    for (int i = 0; i < limit; ++i)
    {
        if (history_[static_cast<size_t> (i)] > maxV)
            maxV = history_[static_cast<size_t> (i)];
    }

    held_ = maxV;
    return held_;
}

} // namespace guitar_learner::audio
