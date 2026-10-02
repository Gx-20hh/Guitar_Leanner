#include "onset_detector.h"
#include <juce_core/juce_core.h>
#include <iostream>

namespace onset_test {

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

int runAll()
{
    TestResult r;
    constexpr int frame = 1024;
    guitar_learner::dsp::OnsetDetector det (0.005f, frame); // 起音间隔 = 1 帧
    juce::HeapBlock<float> buf;
    buf.malloc (frame);

    auto fill = [&](float value) {
        for (int i = 0; i < frame; ++i) buf[i] = value;
    };

    // 1. 静音帧 → 无起音
    fill (0.0f);
    auto silent = det.analyze (buf, frame);
    check (r, "silence no onset", ! silent.onset);
    check (r, "silence energy ~0", silent.energy < 1e-3f);

    // 2. 首强帧（能量高于阈值，间隔就绪）→ 起音
    fill (0.5f);
    auto first = det.analyze (buf, frame);
    check (r, "first strong frame onset", first.onset);

    // 3. 连续强帧（间隔未到）→ 不起音
    auto second = det.analyze (buf, frame);
    check (r, "continuous strong frame no onset", ! second.onset);

    // 4. reset 后强帧又起音
    det.reset();
    auto afterReset = det.analyze (buf, frame);
    check (r, "after reset strong frame onset", afterReset.onset);

    juce::String summary = juce::String::formatted ("passed: %d, failed: %d", r.passed, r.failed);
    std::cout << summary << "\n";
    if (r.failed > 0)
        std::cout << "FAILURES:\n" << r.failures;

    return r.failed == 0 ? 0 : 1;
}

} // namespace onset_test

int main()
{
    return onset_test::runAll();
}
