#include "onset_detector.h"
#include <cmath>

namespace guitar_learner::dsp {

OnsetDetector::OnsetDetector (float threshold, int minGapSamples, double sampleRate)
    : threshold_ (threshold), minGapSamples_ (minGapSamples), sampleRate_ (sampleRate)
{
    reset();
}

float OnsetDetector::getEnergy (const float* samples, int numSamples) const
{
    if (samples == nullptr || numSamples <= 0)
        return 0.0f;
    double sumSq = 0.0;
    for (int i = 0; i < numSamples; ++i)
        sumSq += static_cast<double> (samples[i]) * static_cast<double> (samples[i]);
    return static_cast<float> (std::sqrt (sumSq / static_cast<double> (numSamples)));
}

void OnsetDetector::reset()
{
    sinceLast_ = minGapSamples_; // 使下一强帧可判为起音
    lastEnergy_ = 0.0f;
}

OnsetResult OnsetDetector::analyze (const float* samples, int numSamples)
{
    if (samples == nullptr || numSamples <= 0)
        return { false, 0.0f };

    const float energy = getEnergy (samples, numSamples);
    bool onset = false;
    if (energy >= threshold_ && sinceLast_ >= minGapSamples_)
    {
        onset = true;
        sinceLast_ = 0;
    }
    else
    {
        sinceLast_ += numSamples;
    }
    lastEnergy_ = energy;
    return { onset, energy };
}

} // namespace guitar_learner::dsp
