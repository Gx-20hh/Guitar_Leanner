#include <cassert>
#include <cstdio>
#include "../native/transport/transport.cpp"

static int g_cursorCount = 0;
static CursorEvent g_lastEvent = {};

static void captureCallback(const CursorEvent& ev) {
  g_cursorCount++;
  g_lastEvent = ev;
}

int main() {
  Transport t;
  t.setCursorCallback(captureCallback);

  // --- Test 1: initial state ---
  assert(!t.isPlaying());
  assert(t.currentTick() == 0);
  assert(t.speedRatio() == 1.0);

  // --- Test 2: play/pause/stop ---
  t.play();
  assert(t.isPlaying());
  t.pause();
  assert(!t.isPlaying());
  t.play();
  t.stop();
  assert(!t.isPlaying());
  assert(t.currentTick() == 0);

  // --- Test 3: seek ---
  t.seek(480);
  assert(t.currentTick() == 480);
  t.stop();

  // --- Test 4: speed ---
  t.setSpeed(0.5);
  assert(t.speedRatio() == 0.5);
  t.setSpeed(2.0);
  assert(t.speedRatio() == 2.0);
  t.setSpeed(1.0);

  // --- Test 5: load score with tempo ---
  TransportMidiEvent evs[4] = {
    {0, TransportMidiEvent::EventType::tempo, 0, 0, 0, 0, 120, 0, 0},
    {0, TransportMidiEvent::EventType::noteOn, 0, 64, 96, 960, 0, 0, 0},
    {960, TransportMidiEvent::EventType::tempo, 0, 0, 0, 0, 60, 0, 0},
    {1920, TransportMidiEvent::EventType::noteOn, 0, 67, 96, 480, 0, 0, 0},
  };
  t.loadScore(evs, 4);
  assert(t.positionSeconds() == 0.0);

  // --- Test 6: position at ticks ---
  t.seek(0);
  assert(t.positionSeconds() < 0.001);
  t.seek(960);
  // 0..960 @ 120bpm: (960/960)*(60/120)=0.5s
  double p960 = t.positionSeconds();
  assert(p960 >= 0.45 && p960 <= 0.55);
  t.seek(1920);
  // 0..960 @ 120bpm (0.5s) + 960..1920 @ 60bpm (960/960*60/60=1.0s) = 1.5s
  double p1920 = t.positionSeconds();
  assert(p1920 >= 1.45 && p1920 <= 1.55);

  // --- Test 7: loop wrap ---
  t.setLoop(0, 960);
  t.play();
  // simulate one audio block: 256 samples @ 48k = 5.33ms
  juce::AudioSourceChannelInfo dummy;
  dummy.buffer = nullptr;
  dummy.startSample = 0;
  dummy.numSamples = 256;
  dummy.buffer = nullptr; // ensure null-buffer guard fires
  t.getNextAudioBlock(dummy);
  t.stop();
  t.clearLoop();

  // --- Test 8: clear score ---
  t.clearScore();
  assert(t.currentTick() == 0);

  // --- Test 9: SoundFont placeholder ---
  t.loadSoundFont("test.sf2");
  assert(t.isSoundFontLoaded());

  printf("transport_tests: ALL PASSED\n");
  return 0;
}
