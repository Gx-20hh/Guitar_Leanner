#include "audio/wav_recorder.h"

#include <juce_core/juce_core.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <thread>
#include <vector>

namespace guitar_learner::audio {

namespace {

bool writeLE16(std::FILE* f, uint16_t value)
{
    uint8_t b[2] = { static_cast<uint8_t>(value & 0xff),
                     static_cast<uint8_t>((value >> 8) & 0xff) };
    return std::fwrite(b, 1, 2, f) == 2;
}

bool writeLE32(std::FILE* f, uint32_t value)
{
    uint8_t b[4] = { static_cast<uint8_t>(value & 0xff),
                     static_cast<uint8_t>((value >> 8) & 0xff),
                     static_cast<uint8_t>((value >> 16) & 0xff),
                     static_cast<uint8_t>((value >> 24) & 0xff) };
    return std::fwrite(b, 1, 4, f) == 4;
}

bool writeWavHeader(std::FILE* f, double sampleRate, int numChannels)
{
    const uint32_t rate = static_cast<uint32_t>(sampleRate);
    const uint16_t channels = static_cast<uint16_t>(numChannels);
    const uint16_t bitsPerSample = 16;
    const uint16_t blockAlign = static_cast<uint16_t>(numChannels * sizeof(int16_t));
    const uint32_t byteRate = rate * static_cast<uint32_t>(numChannels) * sizeof(int16_t);
    const uint32_t dataSize = 0;

    if (std::fwrite("RIFF", 1, 4, f) != 4) return false;
    if (!writeLE32(f, 36 + dataSize)) return false;
    if (std::fwrite("WAVE", 1, 4, f) != 4) return false;
    if (std::fwrite("fmt ", 1, 4, f) != 4) return false;
    if (!writeLE32(f, 16)) return false;                // Subchunk1Size
    if (!writeLE16(f, 1)) return false;                 // AudioFormat = PCM
    if (!writeLE16(f, channels)) return false;
    if (!writeLE32(f, rate)) return false;
    if (!writeLE32(f, byteRate)) return false;
    if (!writeLE16(f, blockAlign)) return false;
    if (!writeLE16(f, bitsPerSample)) return false;
    if (std::fwrite("data", 1, 4, f) != 4) return false;
    if (!writeLE32(f, dataSize)) return false;
    return true;
}

bool finalizeWavHeader(std::FILE* f, uint32_t dataSize)
{
    if (f == nullptr) return false;
#ifdef _WIN32
    if (_fseeki64(f, 4, SEEK_SET) != 0) return false;
#else
    if (fseeko(f, 4, SEEK_SET) != 0) return false;
#endif
    if (!writeLE32(f, 36 + dataSize)) return false;
#ifdef _WIN32
    if (_fseeki64(f, 40, SEEK_SET) != 0) return false;
#else
    if (fseeko(f, 40, SEEK_SET) != 0) return false;
#endif
    return writeLE32(f, dataSize);
}

} // namespace

struct WavRecorder::Impl
{
    struct Fifo
    {
        juce::AbstractFifo fifo;
        std::vector<int16_t> buffer;

        explicit Fifo(int capacity)
            : fifo(capacity), buffer(static_cast<size_t>(capacity))
        {
        }
    };

    const size_t maxSeconds;

    std::string filePath;
    double sampleRate = 0.0;
    int numChannels = 0;

    std::unique_ptr<Fifo> fifo;
    std::thread thread;
    std::mutex mutex;
    std::condition_variable cv;

    std::atomic<bool> recording{false};
    std::atomic<bool> stopRequested{false};
    std::atomic<bool> error{false};
    std::atomic<bool> overflowed{false};
    std::string errorMsg;
    size_t dataBytesWritten = 0;

    explicit Impl(size_t maxSecondsIn)
        : maxSeconds(maxSecondsIn ? maxSecondsIn : 1)
    {
    }

    void run()
    {
        std::FILE* f = std::fopen(filePath.c_str(), "wb");
        if (f == nullptr)
        {
            error.store(true);
            std::lock_guard<std::mutex> lk(mutex);
            errorMsg = "failed to open " + filePath;
            return;
        }

        if (!writeWavHeader(f, sampleRate, numChannels))
        {
            error.store(true);
            {
                std::lock_guard<std::mutex> lk(mutex);
                errorMsg = "failed to write WAV header";
            }
            std::fclose(f);
            return;
        }

        dataBytesWritten = 0;

        while (true)
        {
            const int ready = fifo->fifo.getNumReady();
            if (ready == 0)
            {
                if (stopRequested.load(std::memory_order_acquire))
                    break;

                std::unique_lock<std::mutex> lk(mutex);
                cv.wait_for(lk, std::chrono::milliseconds(50), [&] {
                    return stopRequested.load(std::memory_order_acquire)
                           || fifo->fifo.getNumReady() > 0;
                });
                continue;
            }

            int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
            fifo->fifo.prepareToRead(ready, start1, size1, start2, size2);

            size_t bytesThisTime = 0;
            if (size1 > 0)
            {
                const size_t bytes = static_cast<size_t>(size1) * sizeof(int16_t);
                bytesThisTime += std::fwrite(fifo->buffer.data() + start1, 1, bytes, f);
            }
            if (size2 > 0)
            {
                const size_t bytes = static_cast<size_t>(size2) * sizeof(int16_t);
                bytesThisTime += std::fwrite(fifo->buffer.data() + start2, 1, bytes, f);
            }
            fifo->fifo.finishedRead(ready);
            dataBytesWritten += bytesThisTime;

            if (std::ferror(f))
            {
                error.store(true);
                {
                    std::lock_guard<std::mutex> lk(mutex);
                    errorMsg = "write error while recording";
                }
                break;
            }
        }

        if (!error.load(std::memory_order_acquire))
        {
            if (!finalizeWavHeader(f, static_cast<uint32_t>(dataBytesWritten)))
            {
                error.store(true);
                {
                    std::lock_guard<std::mutex> lk(mutex);
                    errorMsg = "failed to finalize WAV header";
                }
            }
        }

        std::fclose(f);
    }
};

WavRecorder::WavRecorder()
    : impl_(std::make_unique<Impl>(10))
{
}

WavRecorder::WavRecorder(size_t maxSeconds)
    : impl_(std::make_unique<Impl>(maxSeconds))
{
}

WavRecorder::~WavRecorder()
{
    stopRecording();
}

bool WavRecorder::startRecording(const std::string& filePath, double sampleRate, int numChannels)
{
    stopRecording();

    if (sampleRate <= 0.0 || numChannels <= 0)
        return false;

    impl_->filePath = filePath;
    impl_->sampleRate = sampleRate;
    impl_->numChannels = numChannels;
    impl_->error.store(false);
    {
        std::lock_guard<std::mutex> lk(impl_->mutex);
        impl_->errorMsg.clear();
    }
    impl_->overflowed.store(false);
    impl_->dataBytesWritten = 0;

    const int capacity = static_cast<int>(sampleRate * static_cast<double>(impl_->maxSeconds)) * numChannels;
    const int safeCapacity = std::max(capacity, 1024);
    impl_->fifo = std::make_unique<Impl::Fifo>(safeCapacity);

    impl_->stopRequested.store(false);
    impl_->recording.store(true);
    impl_->thread = std::thread([this] { impl_->run(); });

    return true;
}

void WavRecorder::stopRecording()
{
    if (!impl_->recording.load(std::memory_order_acquire) && !impl_->thread.joinable())
        return;

    impl_->stopRequested.store(true, std::memory_order_release);
    impl_->cv.notify_all();

    if (impl_->thread.joinable())
        impl_->thread.join();

    impl_->recording.store(false, std::memory_order_release);
}

bool WavRecorder::isRecording() const noexcept
{
    return impl_->recording.load(std::memory_order_acquire);
}

bool WavRecorder::hasError() const noexcept
{
    return impl_->error.load(std::memory_order_acquire);
}

bool WavRecorder::hasOverflowed() const noexcept
{
    return impl_->overflowed.load(std::memory_order_acquire);
}

std::string WavRecorder::lastError() const
{
    std::lock_guard<std::mutex> lk(impl_->mutex);
    return impl_->errorMsg;
}

void WavRecorder::writeChannels(const float* const* channelData,
                                int numSourceChannels,
                                int numSamples)
{
    if (!impl_->recording.load(std::memory_order_acquire))
        return;
    if (numSamples <= 0)
        return;

    const int numCh = impl_->numChannels;
    if (numCh <= 0)
        return;

    const int totalItems = numSamples * numCh;
    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    impl_->fifo->fifo.prepareToWrite(totalItems, start1, size1, start2, size2);

    if (size1 + size2 < totalItems)
    {
        impl_->overflowed.store(true, std::memory_order_release);
        return;
    }

    int written = 0;
    for (int region = 0; region < 2; ++region)
    {
        const int start = (region == 0) ? start1 : start2;
        const int len = (region == 0) ? size1 : size2;
        for (int i = 0; i < len; ++i)
        {
            const int frame = written / numCh;
            const int channel = written % numCh;
            float v = 0.0f;
            if (channel < numSourceChannels && channelData != nullptr && channelData[channel] != nullptr)
                v = channelData[channel][frame];

            const int16_t sample = static_cast<int16_t>(
                std::clamp(v, -1.0f, 1.0f) * 32767.0f);
            impl_->fifo->buffer[static_cast<size_t>(start) + i] = sample;
            ++written;
        }
    }

    impl_->fifo->fifo.finishedWrite(totalItems);
}

} // namespace guitar_learner::audio
