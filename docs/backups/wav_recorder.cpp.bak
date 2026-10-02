#include "wav_recorder.h"
#include <cmath>
#include <condition_variable>
#include <mutex>
#include <thread>

static constexpr size_t kRingSize = 1 << 18; // 256k samples (~5.3s at 48kHz mono)

struct WavRecorder::Impl {
  juce::CriticalSection lock;
  bool recording = false;
  double sampleRate = 48000.0;
  int numChannels = 1;

  // Ring buffer: interleaved samples [ch0,ch1,...,ch0,ch1,...]
  std::vector<float> ring;
  size_t writePos = 0;
  size_t readPos = 0;
  size_t pendingFrames = 0;

  // Background writer thread
  std::unique_ptr<juce::FileOutputStream> outStream;
  std::unique_ptr<std::thread> writerThread;
  std::mutex writerMutex;
  std::condition_variable writerCv;
  bool writerStop = false;

  void writerLoop() {
    std::vector<float> chunk;
    while (true) {
      std::unique_lock<std::mutex> lk(writerMutex);
      writerCv.wait(lk, [this] { return writerStop || pendingFrames >= 1024; });
      if (writerStop && pendingFrames == 0) break;

      // Read from ring buffer
      {
        juce::ScopedLock sl(lock);
        size_t toRead = std::min(pendingFrames, kRingSize / numChannels);
        chunk.assign(toRead * numChannels, 0.0f);
        for (size_t i = 0; i < toRead * numChannels; ++i) {
          chunk[i] = ring[(readPos + i) % ring.size()];
        }
        readPos = (readPos + toRead * numChannels) % ring.size();
        pendingFrames -= toRead;
      }

      // Write to WAV file (PCM 32-bit float)
      if (outStream && !chunk.empty()) {
        outStream->write(chunk.data(), chunk.size() * sizeof(float));
      }
    }
  }

  void writeWavHeader(juce::OutputStream& stream, int totalFrames) {
    uint32_t dataSize = totalFrames * numChannels * 4;
    uint32_t fileSize = 36 + dataSize;
    stream.write("RIFF", 4);
    stream.writeInt(fileSize);
    stream.write("WAVE", 4);
    stream.write("fmt ", 4);
    stream.writeInt(16);
    stream.writeShort(3); // IEEE float
    stream.writeShort((short)numChannels);
    stream.writeInt((int)sampleRate);
    stream.writeInt((int)(sampleRate * numChannels * 4));
    stream.writeShort((short)(numChannels * 4));
    stream.writeShort(32);
    stream.write("data", 4);
    stream.writeInt(dataSize);
  }
};

WavRecorder::WavRecorder() : impl_(std::make_unique<Impl>()) {}
WavRecorder::~WavRecorder() { stopRecording(); }

void WavRecorder::startRecording(const juce::File& file, double sr, int ch) {
  juce::ScopedLock sl(impl_->lock);
  if (impl_->recording) return;
  impl_->sampleRate = sr;
  impl_->numChannels = ch;
  impl_->ring.assign(kRingSize, 0.0f);
  impl_->writePos = 0;
  impl_->readPos = 0;
  impl_->pendingFrames = 0;
  impl_->recording = true;

  impl_->outStream.reset(file.createOutputStream());
  if (impl_->outStream) {
    // Placeholder header — updated on stop
    impl_->writeWavHeader(*impl_->outStream, 0);
  }

  impl_->writerStop = false;
  impl_->writerThread.reset(new std::thread([this] { impl_->writerLoop(); }));
}

void WavRecorder::stopRecording() {
  {
    juce::ScopedLock sl(impl_->lock);
    if (!impl_->recording) return;
    impl_->recording = false;
  }

  {
    std::lock_guard<std::mutex> lk(impl_->writerMutex);
    impl_->writerStop = true;
    impl_->writerCv.notify_all();
  }
  if (impl_->writerThread && impl_->writerThread->joinable())
    impl_->writerThread->join();
  impl_->writerThread.reset();

  // Rewrite header with actual frame count
  if (impl_->outStream) {
    // Count total frames written
    impl_->outStream->flush();
    impl_->outStream->setPosition(0);
    // Recalculate data size; approximate from file size
    int64_t fileSize = impl_->outStream->getTotalLength();
    int totalFrames = (int)((fileSize - 44) / (impl_->numChannels * 4));
    impl_->writeWavHeader(*impl_->outStream, totalFrames);
    impl_->outStream.reset();
  }
}

bool WavRecorder::isRecording() const { return impl_->recording; }

void WavRecorder::pushSamples(const float* const* input, int ch, int numSamples) {
  juce::ScopedLock sl(impl_->lock);
  if (!impl_->recording) return;
  int writeCh = std::min(ch, impl_->numChannels);
  for (int i = 0; i < numSamples; ++i) {
    for (int c = 0; c < writeCh; ++c) {
      impl_->ring[impl_->writePos] = input[c] ? input[c][i] : 0.0f;
      impl_->writePos = (impl_->writePos + 1) % impl_->ring.size();
    }
  }
  impl_->pendingFrames += numSamples;
  impl_->writerCv.notify_one();
}
