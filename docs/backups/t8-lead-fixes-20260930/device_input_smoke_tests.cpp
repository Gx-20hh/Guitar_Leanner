#include "device_input.h"
#include <juce_core/juce_core.h>
#include <iostream>

// T8 设备层冒烟测试：枚举输入设备并尝试（可选）打开默认输入。
// 通过标准：枚举不崩溃、能列出当前可见设备。打开默认设备成功与否记录为证据（不视为总体失败）。
// GE200 实机未连接时，此处仅记录"无 GE200"，不冒充通过硬件门。

int main()
{
    guitar_learner::audio::DeviceInput input;

    auto devices = input.enumerateInputDevices();
    std::cout << "enumerated " << devices.size() << " input device(s)\n";

    bool foundGE200 = false;
    for (const auto& d : devices)
    {
        std::cout << "  device: " << d.deviceId.toStdString()
                  << " (asio=" << (d.isAsio ? "yes" : "no") << ", ch=" << d.inputChannels << ")\n";
        if (d.name.containsIgnoreCase ("GE200") || d.name.containsIgnoreCase ("MOOER"))
            foundGE200 = true;
    }

    if (foundGE200)
        std::cout << "GE200 device present\n";
    else
        std::cout << "GE200 NOT detected; hardware gate pending real device\n";

    {
        // 嵌套作用域：DeviceInput 不可拷贝/赋值，用块内构造+析构自然关闭设备。
        guitar_learner::audio::DeviceInput opener;
        auto devices2 = opener.enumerateInputDevices();
        std::cout << "opener saw " << devices2.size() << " device(s)\n";

        bool opened = opener.openDevice ({}, 48000.0, 256, 1);
        if (opened)
        {
            auto s = opener.getSettings();
            std::cout << "opened default input: sr=" << s.sampleRate
                      << " buf=" << s.bufferSize
                      << " clock=" << (juce::int64) opener.getClockSamples() << "\n";
            // 短暂等待设备回调推进样本时钟（不阻塞实时线程；这里只是轮询）
            juce::Thread::sleep (50);
            std::cout << "clock after 50ms: " << (juce::int64) opener.getClockSamples() << "\n";
        }
        else
        {
            std::cout << "open default input failed (constrained): " << opener.getLastError().toStdString() << "\n";
        }
    } // opener 在此析构，关闭设备

    // 通过 = 枚举成功（无论 GE200 是否在）。硬件门以 docs/validation/t8-device.md 记录为准。
    return 0;
}
