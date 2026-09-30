#include "device_input.h"
#include <juce_core/juce_core.h>
#include <iostream>

// T8 设备层冒烟（受限）：枚举设备并尝试以 WASAPI 默认输入打开（若存在）。
// 通过标准 = 枚举与打开路径真实可跑且无崩溃；**不视为硬件验收**。
// GE200 未实测前，此处只记录“设备存在与否”，任何打开失败都是受限证据而非成功。
// 严禁挂起：打开尝试有超时边界（打开失败即返回；成功则短暂轮询后即停止）。

static constexpr int kMaxSpinMs = 2000; // 回调推进轮询上限，防止挂起

int main()
{
    guitar_learner::audio::DeviceInput input;

    auto devices = input.enumerateInputDevices();
    std::cout << "enumerated " << devices.size() << " input device(s)\n";

    bool foundGE200 = false;
    for (const auto& d : devices)
    {
        std::cout << "  device: " << d.deviceId.toStdString()
                  << " (backend=" << d.backendType.toStdString()
                  << ", asio=" << (d.isAsio ? "yes" : "no")
                  << ", ch=" << d.inputChannels << "=unknown)\n";
        if (d.name.containsIgnoreCase ("GE200") || d.name.containsIgnoreCase ("MOOER"))
            foundGE200 = true;
    }

    if (foundGE200)
        std::cout << "GE200 present; hardware gate pending real capture evidence\n";
    else
        std::cout << "GE200 NOT present; hardware gate NOT passed (pending real device)\n";

    // 尝试打开第一个可见的 WASAPI 输入设备（若枚举到）。失败为受限记录，不判成功。
    {
        juce::String targetDeviceId;
        for (const auto& d : devices)
        {
            if (! d.isAsio) // 优先 WASAPI（无 ASIO 驱动时）；真实 GE200 测试将显式指定
            {
                targetDeviceId = d.deviceId;
                break;
            }
        }

        if (targetDeviceId.isEmpty())
        {
            std::cout << "no WASAPI input device to try; open skipped (constrained)\n";
        }
        else
        {
            guitar_learner::audio::DeviceInput opener;
            const bool opened = opener.openDevice (targetDeviceId, 48000.0, 256, 1);
            if (opened)
            {
                const auto s = opener.getSettings();
                std::cout << "opened: " << targetDeviceId.toStdString()
                          << " sr=" << s.sampleRate << " buf=" << s.bufferSize
                          << " chOpen=" << s.inputChannelsOpen
                          << " totalCh=" << s.totalInputChannels << "\n";

                // 短轮询确认回调推进样本时钟（有上界，防挂起）
                const auto start = juce::Time::getMillisecondCounter();
                const juce::int64 startClock = opener.getClockSamples();
                while (opener.getClockSamples() == startClock
                       && juce::Time::getMillisecondCounter() - start < kMaxSpinMs)
                {
                    juce::Thread::sleep (10);
                }
                std::cout << "clock advanced to " << (juce::int64) opener.getClockSamples()
                          << " (epoch " << (juce::uint64) opener.getClockEpoch() << ")\n";
                opener.closeDevice();
            }
            else
            {
                std::cout << "open failed (constrained): " << opener.getLastError().toStdString() << "\n";
            }
        }
    }

    // 枚举与打开路径无崩溃即算冒烟通过；硬件门在 t8-device.md 中单独记录。
    return 0;
}
