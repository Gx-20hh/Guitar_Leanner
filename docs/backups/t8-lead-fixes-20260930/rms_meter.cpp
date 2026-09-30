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

PeakHold::PeakHold (int windowSecondsAt48k, int sampleRate) noexcept
{
    // 每 block 一个槽位；以 sampleRate/blockSize 计算每秒块数。
    const int blockSize = 256; // 约定 UI 分析块（与回调块大小解耦，仅用于容量估算）
    const int sr = std::max (1, sampleRate);
    const int blocksPerSec = std::max (1, sr / blockSize);
    cap_ = std::max (1, windowSecondsAt48k * blocksPerSec);

    history_ = new float[static_cast<size_t> (cap_)];
    reset();
}

void PeakHold::reset() noexcept
{
    for (int i = 0; i < cap_; ++i)
        history_[i] = 0.0f;
    writeIndex_ = 0;
    filled_ = 0;
    held_ = 0.0f;
}

float PeakHold::push (float blockPeak) noexcept
{
    if (cap_ <= 0)
    {
        held_ = blockPeak;
        return held_;
    }

    history_[writeIndex_] = blockPeak;
    writeIndex_ = (writeIndex_ + 1) % cap_;

    if (filled_ < cap_)
        ++filled_;

    float maxV = 0.0f;
    const int limit = filled_ < cap_ ? filled_ : cap_;
    for (int i = 0; i < limit; ++i)
    {
        if (history_[i] > maxV)
            maxV = history_[i];
    }

    held_ = maxV;
    return held_;
}

} // namespace guitar_learner::audio
