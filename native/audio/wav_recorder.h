#pragma once

#include <atomic>
#include <cstddef>
#include <memory>
#include <string>

namespace guitar_learner::audio {

// Background-thread WAV recorder. Audio thread pushes interleaved samples via
// writeChannels(); disk IO happens only on the internal worker thread.
class WavRecorder
{
public:
    WavRecorder();
    explicit WavRecorder(size_t maxSeconds);
    ~WavRecorder();

    WavRecorder(const WavRecorder&) = delete;
    WavRecorder& operator=(const WavRecorder&) = delete;

    // Prepares a WAV file at the given sample rate/channel count and launches
    // the disk writer thread. Returns false for invalid parameters.
    bool startRecording(const std::string& filePath, double sampleRate, int numChannels);

    // Signals the worker to flush and finish, then joins it.
    void stopRecording();

    bool isRecording() const noexcept;
    bool hasError() const noexcept;
    bool hasOverflowed() const noexcept;
    std::string lastError() const;

    // Real-time safe. Called from the audio callback. Source channels beyond
    // numChannels are ignored; missing source channels are written as silence.
    void writeChannels(const float* const* channelData, int numSourceChannels, int numSamples);

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace guitar_learner::audio
