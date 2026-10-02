#include "pitch_detector.h"

namespace guitar_learner::dsp {

// 本地整数 min/max（避免依赖 <algorithm>）
static int imin (int a, int b) { return a < b ? a : b; }
static int imax (int a, int b) { return a > b ? a : b; }

// 本地浮点辅助（避免依赖 <cmath> 特殊函数在当前包含顺序下的失步，保持回调期无分配）
static double absLike (double x) { return x < 0.0 ? -x : x; }
static int floorLike (double v) { return static_cast<int> (v); }               // v>0
static int ceilLike (double v) { const int n = static_cast<int> (v); return static_cast<double> (n) < v ? n + 1 : n; }

PitchDetector::PitchDetector (int windowSize, double sampleRate, double minFreq, double maxFreq)
    : windowSize_ (windowSize), sampleRate_ (sampleRate), minFreq_ (minFreq), maxFreq_ (maxFreq)
{
    // 预分配，回调期不分配内存。
    diffBuf_.resize (static_cast<size_t> (windowSize_ > 0 ? windowSize_ : 1));
    cmndfBuf_.resize (static_cast<size_t> (windowSize_ > 0 ? windowSize_ : 1));
}

double PitchDetector::parabolicInterpolation (int tau, double y0, double y1, double y2) const
{
    const double denominator = 2.0 * (2.0 * y1 - y2 - y0);
    if (absLike (denominator) < 1e-12)
        return static_cast<double> (tau);
    return static_cast<double> (tau) + ((y2 - y0) / denominator);
}

PitchResult PitchDetector::analyze (const float* samples, int numSamples)
{
    if (samples == nullptr || numSamples <= 0)
        return { 0.0, 0.0, false };

    const int n = imin (windowSize_, numSamples);
    if (n < 4)
        return { 0.0, 0.0, false };

    const int tauMax = imin (n / 2, windowSize_ - 1);

    // 1. 差分函数 d(tau)
    float* diff = diffBuf_.data();
    for (int tau = 1; tau <= tauMax; ++tau)
    {
        double sum = 0.0;
        const int limit = n - tau;
        for (int i = 0; i < limit; ++i)
        {
            const double delta = static_cast<double> (samples[i]) - static_cast<double> (samples[i + tau]);
            sum += delta * delta;
        }
        diff[tau] = static_cast<float> (sum);
    }

    // 2. CMNDF
    double* cmndf = cmndfBuf_.data();
    cmndf[0] = 1.0;
    {
        double running = 0.0;
        for (int tau = 1; tau <= tauMax; ++tau)
        {
            running += static_cast<double> (diff[tau]);
            if (running > 1e-12)
                cmndf[tau] = (static_cast<double> (diff[tau]) * tau) / running;
            else
                cmndf[tau] = 1.0;
        }
    }

    // 3. 频率窗口 → tau 搜索范围
    const int tauMin = imax (1, ceilLike (sampleRate_ / maxFreq_));
    const int tauSearchMax = imin (tauMax, floorLike (sampleRate_ / minFreq_));

    const double threshold = 0.15;
    int bestTau = -1;

    // 标准 YIN：取首个低于阈值（即基础周期谷）；无谷则退回带内全局最小（仍判为有效音）。
    for (int tau = tauMin; tau <= tauSearchMax; ++tau)
    {
        if (cmndf[tau] < threshold)
        {
            bestTau = tau;
            break;
        }
    }

    if (bestTau < 0)
    {
        bestTau = tauMin;
        for (int tau = tauMin; tau <= tauSearchMax; ++tau)
            if (cmndf[tau] < cmndf[bestTau])
                bestTau = tau;
        // 无低于阈值的谷（如噪声/极弱）：仍给出谷的最低置信，交由 valid 判（需 confidence 合理）。
    }

    // 4. 抛物线插值精化
    const int p0 = imax (1, bestTau - 1);
    const int p2 = imin (tauSearchMax, bestTau + 1);
    const double refined = parabolicInterpolation (bestTau, cmndf[p0], cmndf[bestTau], cmndf[p2]);

    const double bestCmndf = cmndf[bestTau];
    const double frequencyHz = refined > 0.0 ? sampleRate_ / refined : 0.0;
    const double confidence = 1.0 - bestCmndf;
    const bool valid = frequencyHz >= minFreq_ && frequencyHz <= maxFreq_ && confidence > 0.0;

    return { frequencyHz, confidence, valid };
}

} // namespace guitar_learner::dsp
