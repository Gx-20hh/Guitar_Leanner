#include "device_input.h"
#include <juce_core/juce_core.h>
#include <iostream>
#include <limits>

// T8 设备层单元测试（纯逻辑，不依赖真实硬件）。
// 覆盖审查要求：null 回调通道、stopped 失效、closeDevice 语义、epoch 时钟、枚举格式。

namespace device_test {

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

    // 1. 枚举格式与通道未知
    {
        guitar_learner::audio::DeviceInput input;
        auto devices = input.enumerateInputDevices();
        for (auto& d : devices)
        {
            check (r, "deviceId has backend::name form", d.deviceId.contains ("::"));
            check (r, "inputChannels unknown (-1)", d.inputChannels == -1);
            check (r, "backendType nonempty", d.backendType.isNotEmpty());
        }
        // 枚举本身成功（无论有无硬件）
        check (r, "enumerate ran without crash", true);
    }

    // 2. openDevice 空 deviceId / 坏格式：明确失败并给出错误（不静默回退）
    {
        guitar_learner::audio::DeviceInput input;
        bool ok1 = input.openDevice (juce::String(), 48000.0, 256, 1);
        check (r, "empty deviceId fails", ! ok1);

        bool ok2 = input.openDevice ("NoBackendSep", 48000.0, 256, 1);
        check (r, "bad deviceId format fails", ! ok2);
        check (r, "lastError set on bad format", input.getLastError().isNotEmpty());
    }

    // 3. 回调：正常块推进时钟与 RMS（mock 传入，不依赖设备）
    {
        guitar_learner::audio::DeviceInput input;

        float buf[4] = { 0.5f, -0.5f, 0.5f, -0.5f };
        const float* chans[] = { buf };
        input.handleAudioCallback (chans, 1, 4);

        check (r, "clock advanced by 4 samples",
               input.getClockSamples() == 4);
        check (r, "rms computed (0.5 const -> 0.5)",
               input.getLatestRmsLinear() > 0.499 && input.getLatestRmsLinear() < 0.501);
        check (r, "rms dbfs ~ -6.02", input.getLatestRmsDbfs() < -6.0 && input.getLatestRmsDbfs() > -6.05);
    }

    // 4. null 输入通道：失效陈旧电平；时钟仍推进
    {
        guitar_learner::audio::DeviceInput input;

        float buf[4] = { 0.5f, -0.5f, 0.5f, -0.5f };
        const float* chans[] = { buf };
        input.handleAudioCallback (chans, 1, 4); // 先有电平

        const float* nullChans[] = { nullptr };
        input.handleAudioCallback (nullChans, 1, 4); // 全 null

        check (r, "null channel invalidates rms (dbfs -inf)",
               input.getLatestRmsDbfs() == -std::numeric_limits<double>::infinity());
        check (r, "null channel invalidates peak", input.getLatestPeakHold() == 0.0f);
        check (r, "clock continues advancing on null chans",
               input.getClockSamples() == 8);
    }

    // 5. 无输入通道（numInputChannels==0）：失效电平
    {
        guitar_learner::audio::DeviceInput input;
        input.handleAudioCallback (nullptr, 0, 4);
        check (r, "no input chans invalidates rms",
               input.getLatestRmsDbfs() == -std::numeric_limits<double>::infinity());
        check (r, "clock advanced with no chans", input.getClockSamples() == 4);
    }

    // 6. invalidateOnStop（audioDeviceStopped 回调等价）：running false + 失效电平
    {
        guitar_learner::audio::DeviceInput input;

        float buf[4] = { 0.5f, -0.5f, 0.5f, -0.5f };
        const float* chans[] = { buf };
        input.handleAudioCallback (chans, 1, 4);

        // 模拟设备停止：invalidateOnStop 是 private，通过公开路径不直接可调。
        // 此处用 closeDevice 覆盖停止语义（公开路径），并单独验证电平失效由 stopped 负责：
        // JUCE 会调 audioDeviceStopped -> invalidateOnStop；closeDevice 也会失效。
        // 这里直接验证 closeDevice 后的语义：
        check (r, "pre-close rms valid", input.getLatestRmsDbfs() != -std::numeric_limits<double>::infinity());
        input.closeDevice();
        check (r, "closeDevice clears running", ! input.isRunning());
        check (r, "closeDevice invalidates rms",
               input.getLatestRmsDbfs() == -std::numeric_limits<double>::infinity());
    }

    // 7. 电平在重新有效输入前保持失效（陈旧数据不误报）
    {
        guitar_learner::audio::DeviceInput input;
        input.handleAudioCallback (nullptr, 0, 4); // 无输入 -> 失效
        // 时钟 4
        check (r, "invalid after first null callback",
               input.getLatestRmsDbfs() == -std::numeric_limits<double>::infinity());

        float buf[2] = { 0.1f, -0.1f };
        const float* chans[] = { buf };
        input.handleAudioCallback (chans, 1, 2); // 恢复输入
        check (r, "valid after real input returns",
               input.getLatestRmsDbfs() != -std::numeric_limits<double>::infinity());
    }

    juce::String summary = juce::String::formatted ("passed: %d, failed: %d", r.passed, r.failed);
    std::cout << summary << "\n";
    if (r.failed > 0)
        std::cout << "FAILURES:\n" << r.failures;

    return r.failed == 0 ? 0 : 1;
}

} // namespace device_test

int main()
{
    return device_test::runAll();
}
