#include "audio/wav_recorder.h"

#include <cmath>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace {

uint16_t readLE16(const uint8_t* p)
{
    return static_cast<uint16_t>(p[0]) | (static_cast<uint16_t>(p[1]) << 8);
}

uint32_t readLE32(const uint8_t* p)
{
    return static_cast<uint32_t>(p[0])
         | (static_cast<uint32_t>(p[1]) << 8)
         | (static_cast<uint32_t>(p[2]) << 16)
         | (static_cast<uint32_t>(p[3]) << 24);
}

struct WavInfo
{
    bool valid = false;
    uint16_t channels = 0;
    uint32_t sampleRate = 0;
    uint16_t bitsPerSample = 0;
    uint32_t dataBytes = 0;
    size_t dataOffset = 0;
};

WavInfo parseWav(const std::filesystem::path& path)
{
    WavInfo info;
    std::ifstream f(path, std::ios::binary | std::ios::ate);
    if (!f) return info;

    const auto end = f.tellg();
    f.seekg(0, std::ios::beg);
    if (end < static_cast<std::streamoff>(44)) return info;

    uint8_t header[44];
    f.read(reinterpret_cast<char*>(header), 44);
    if (std::memcmp(header, "RIFF", 4) != 0) return info;
    if (std::memcmp(header + 8, "WAVE", 4) != 0) return info;
    if (std::memcmp(header + 12, "fmt ", 4) != 0) return info;
    if (std::memcmp(header + 36, "data", 4) != 0) return info;

    info.valid = true;
    info.channels = readLE16(header + 22);
    info.sampleRate = readLE32(header + 24);
    info.bitsPerSample = readLE16(header + 34);
    info.dataBytes = readLE32(header + 40);
    info.dataOffset = 44;
    return info;
}

} // namespace

int main()
{
    int failures = 0;

    const std::filesystem::path tmpPath =
        std::filesystem::temp_directory_path() / "guitar_learner_wav_recorder_test.wav";

    // Clean up any stale file.
    std::filesystem::remove(tmpPath);

    // 1. start/stop with known input
    {
        guitar_learner::audio::WavRecorder recorder;
        const double sampleRate = 48000.0;
        const int channels = 1;
        const int frames = 2048;
        const float amplitude = 0.5f;

        std::vector<float> mono(frames);
        for (int i = 0; i < frames; ++i)
            mono[i] = amplitude * static_cast<float>(std::sin(2.0 * 3.141592653589793 * 440.0 * i / sampleRate));

        const float* channelPtrs[1] = { mono.data() };

        if (!recorder.startRecording(tmpPath.string(), sampleRate, channels))
        {
            std::cout << "FAIL: startRecording returned false\n";
            ++failures;
        }

        if (!recorder.isRecording())
        {
            std::cout << "FAIL: isRecording() false after start\n";
            ++failures;
        }

        recorder.writeChannels(channelPtrs, 1, frames);
        recorder.stopRecording();

        if (recorder.isRecording())
        {
            std::cout << "FAIL: isRecording() true after stop\n";
            ++failures;
        }

        if (recorder.hasError())
        {
            std::cout << "FAIL: recorder error: " << recorder.lastError() << "\n";
            ++failures;
        }

        if (recorder.hasOverflowed())
        {
            std::cout << "FAIL: unexpected overflow\n";
            ++failures;
        }

        // 2. validate written file
        const WavInfo info = parseWav(tmpPath);
        if (!info.valid)
        {
            std::cout << "FAIL: output is not a valid WAV\n";
            ++failures;
        }
        if (info.channels != 1)
        {
            std::cout << "FAIL: expected 1 channel, got " << info.channels << "\n";
            ++failures;
        }
        if (info.sampleRate != 48000)
        {
            std::cout << "FAIL: expected 48000 Hz, got " << info.sampleRate << "\n";
            ++failures;
        }
        if (info.bitsPerSample != 16)
        {
            std::cout << "FAIL: expected 16-bit, got " << info.bitsPerSample << "\n";
            ++failures;
        }
        const uint32_t expectedDataBytes = static_cast<uint32_t>(frames * channels * sizeof(int16_t));
        if (info.dataBytes != expectedDataBytes)
        {
            std::cout << "FAIL: expected " << expectedDataBytes << " data bytes, got "
                      << info.dataBytes << "\n";
            ++failures;
        }

        // 3. validate a few decoded samples
        std::ifstream f(tmpPath, std::ios::binary);
        if (f)
        {
            f.seekg(static_cast<std::streamoff>(info.dataOffset), std::ios::beg);
            std::vector<int16_t> decoded(frames);
            f.read(reinterpret_cast<char*>(decoded.data()), static_cast<std::streamsize>(frames * sizeof(int16_t)));

            int bad = 0;
            for (int i = 0; i < frames; ++i)
            {
                const float expected = std::clamp(mono[i], -1.0f, 1.0f) * 32767.0f;
                const float diff = std::fabs(static_cast<float>(decoded[i]) - expected);
                if (diff > 2.0f) ++bad;
            }
            if (bad > 0)
            {
                std::cout << "FAIL: " << bad << " samples differ by > 2 LSB\n";
                ++failures;
            }
        }
        else
        {
            std::cout << "FAIL: could not reopen output file for sample check\n";
            ++failures;
        }
    }

    // 4. idempotent stop
    {
        guitar_learner::audio::WavRecorder recorder;
        recorder.stopRecording();
        recorder.stopRecording();
        if (recorder.hasError())
        {
            std::cout << "FAIL: error after idle stop\n";
            ++failures;
        }
    }

    std::filesystem::remove(tmpPath);

    if (failures == 0)
    {
        std::cout << "wav_recorder_tests: ALL PASSED\n";
        return 0;
    }

    std::cout << "wav_recorder_tests: " << failures << " FAILURE(S)\n";
    return 1;
}
