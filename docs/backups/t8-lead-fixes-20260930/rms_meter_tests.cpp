#include "rms_meter.h"
#include <juce_core/juce_core.h>
#include <cmath>
#include <iostream>
#include <limits>

namespace rms_test {

struct TestResult
{
    int passed = 0;
    int failed = 0;
    juce::String failures;
};

static void check (TestResult& r, const juce::String& name, bool ok)
{
    if (ok) { ++r.passed; }
    else { ++r.failed; r.failures += name + "\n"; }
}

static bool nearlyEqual (double a, double b, double tol = 1e-6)
{
    return std::fabs (a - b) <= tol;
}

// 生成正弦波（amplitude 峰幅，frequency Hz，sampleRate）
static void fillSine (juce::HeapBlock<float>& buf, int blockSize, float amplitude, double frequency, double sampleRate, int phaseOffset = 0)
{
    buf.malloc (blockSize);
    for (int i = 0; i < blockSize; ++i)
    {
        buf[i] = amplitude * static_cast<float> (std::sin (2.0 * juce::MathConstants<double>::pi * frequency * (phaseOffset + i) / sampleRate));
    }
}

int runAll()
{
    TestResult r;
    constexpr int blockSize = 256;
    constexpr double sampleRate = 48000.0;

    // 1. 静音 → RMS 0
    {
        juce::HeapBlock<float> buf;
        buf.malloc (blockSize);
        for (int i = 0; i < blockSize; ++i) buf[i] = 0.0f;
        auto rms = guitar_learner::audio::calculateRms (buf, blockSize);
        check (r, "silence rms == 0", nearlyEqual (rms, 0.0));
    }

    // 2. 恒定 0.5 → RMS 0.5
    {
        juce::HeapBlock<float> buf;
        buf.malloc (blockSize);
        for (int i = 0; i < blockSize; ++i) buf[i] = 0.5f;
        auto rms = guitar_learner::audio::calculateRms (buf, blockSize);
        check (r, "constant 0.5 rms == 0.5", nearlyEqual (rms, 0.5));
    }

    // 3. 正弦峰值 1.0 → RMS ≈ 0.7071（整周期）
    {
        juce::HeapBlock<float> buf;
        // 用整周期（sampleRate 整除频率保证精确）：选取 1000Hz @48k → 48 个样本/周期，256 非整周期。
        // 只用一整周期精确核验；长度取 48 样本。
        constexpr int n = 48; // 1000Hz 一个整周期
        buf.malloc (n);
        for (int i = 0; i < n; ++i)
            buf[i] = std::sin (2.0 * juce::MathConstants<double>::pi * 1000.0 * i / 48000.0);
        auto rms = guitar_learner::audio::calculateRms (buf, n);
        check (r, "sine full-period rms ~0.7071", nearlyEqual (rms, 1.0 / std::sqrt (2.0), 1e-4));
    }

    // 4. dBFS 转换：0.5 → -6.02 dB
    {
        auto db = guitar_learner::audio::rmsToDbfs (0.5);
        check (r, "0.5 -> -6.02dB", nearlyEqual (db, -6.0206, 1e-3));
        check (r, "0 -> -inf", db == -std::numeric_limits<double>::infinity() ? true : guitar_learner::audio::rmsToDbfs (0.0) == -std::numeric_limits<double>::infinity());
    }

    // 5. null 指针 → 0
    {
        auto rms = guitar_learner::audio::calculateRms (nullptr, blockSize);
        check (r, "null ptr rms == 0", rms == 0.0);
        check (r, "negative block rms == 0", guitar_learner::audio::calculateRms (nullptr, -5) == 0.0);
    }

    // 6. PeakHold：窗口内保持峰值
    {
        guitar_learner::audio::PeakHold hold (3, 48000);
        // 推入 0.3, 0.9, 0.2 一窗口内
        float a = hold.push (0.3f);
        float b = hold.push (0.9f);
        float c = hold.push (0.2f);
        check (r, "peakhold rises to 0.9", b >= 0.899f && b <= 0.901f);
        check (r, "peakhold holds 0.9", c >= 0.899f && c <= 0.901f);
        hold.reset();
        check (r, "after reset peakhold 0", hold.current() == 0.0f);
    }

    // 7. 削波指示（RMS 接近 1.0，clipping 逻辑在后端，这里只验证 RMS 上限范围）
    {
        juce::HeapBlock<float> buf;
        buf.malloc (blockSize);
        for (int i = 0; i < blockSize; ++i) buf[i] = 1.0f;
        auto rms = guitar_learner::audio::calculateRms (buf, blockSize);
        check (r, "full-scale rms ~1.0", nearlyEqual (rms, 1.0));
    }

    juce::String summary = juce::String::formatted ("passed: %d, failed: %d", r.passed, r.failed);
    std::cout << summary << "\n";
    if (r.failed > 0)
        std::cout << "FAILURES:\n" << r.failures;

    return r.failed == 0 ? 0 : 1;
}

} // namespace rms_test

int main()
{
    return rms_test::runAll();
}
