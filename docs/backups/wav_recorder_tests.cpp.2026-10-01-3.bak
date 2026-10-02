#include <cassert>
#include <cstdio>
#include <filesystem>
#include "../native/audio/wav_recorder.cpp"

int main() {
  // Test 1: initial state
  WavRecorder rec;
  assert(!rec.isRecording());

  // Test 2: start/stop recording cycle
  auto tmpFile = juce::File::createTempFile(".wav");
  rec.startRecording(tmpFile, 48000.0, 1);
  assert(rec.isRecording());

  // Push some fake samples
  std::vector<float> samples(256, 0.5f);
  const float* ptrs[1] = { samples.data() };
  rec.pushSamples(ptrs, 1, 256);

  rec.stopRecording();
  assert(!rec.isRecording());
  assert(tmpFile.existsAsFile());
  assert(tmpFile.getSize() > 44); // at least WAV header

  tmpFile.deleteFile();

  // Test 3: double start is idempotent
  auto f2 = juce::File::createTempFile(".wav");
  rec.startRecording(f2, 44100.0, 2);
  rec.startRecording(juce::File::createTempFile(".wav"), 48000.0, 1);
  rec.stopRecording();
  f2.deleteFile();

  printf("wav_recorder_tests: ALL PASSED\n");
  return 0;
}
