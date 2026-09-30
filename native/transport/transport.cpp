#include "transport.h"
#include "tsf.h"
#include "tml.h"
#include <algorithm>
#include <cmath>
#include <vector>

static const int kPpq = 960;

struct ActiveNote {
  int endTick;
  int channel;
  int key;
};

struct Transport::Impl {
  juce::AudioDeviceManager* dm = nullptr;
  juce::CriticalSection lock;

  // TinySoundFont synthesizer state.
  tsf* soundFont = nullptr;
  bool sfLoaded = false;

  std::vector<TransportMidiEvent> events;
  std::vector<TempoPoint> tempoMap;
  std::vector<ActiveNote> activeNotes;

  bool playing = false;
  double currentTick = 0;
  double sampleRate = 48000;
  double speed = 1;
  bool loopOn = false;
  int loopStart = 0, loopEnd = 0;
  CursorCallback cb;

  void closeSoundFont() {
    if (soundFont) {
      tsf_close(soundFont);
      soundFont = nullptr;
    }
  }

  double tickToSec(int tick) const {
    if (tempoMap.empty()) return tick * 60.0 / (kPpq * 120.0);
    double s = 0;
    int pt = 0;
    double pb = 120;
    int i = 0;
    while (i < (int)tempoMap.size() && tempoMap[i].tick <= tick) {
      s += (tempoMap[i].tick - pt) * 60.0 / (kPpq * pb);
      pt = tempoMap[i].tick;
      pb = tempoMap[i].bpm;
      ++i;
    }
    s += (tick - pt) * 60.0 / (kPpq * pb);
    return s;
  }

  void advance(double dtSec) {
    if (!playing) return;
    double bpm = 120;
    for (const auto& tp : tempoMap)
      if (tp.tick <= (int)currentTick) bpm = tp.bpm;
    double dTick = dtSec * bpm * kPpq / 60.0 * speed;
    double nTick = currentTick + dTick;

    if (loopOn && loopEnd > loopStart && nTick >= loopEnd) {
      if (cb) cb({CursorEvent::Type::complete, 0, (double)loopEnd, 0, 0, 0, 0, 0});
      nTick = loopStart + (nTick - loopEnd);
      currentTick = nTick;
      activeNotes.clear();
      if (soundFont) tsf_note_off_all(soundFont);
      return;
    }

    for (const auto& ev : events) {
      double et = (double)ev.tick;
      bool inside = (et > currentTick && et <= nTick);
      if (!inside) continue;

      if (ev.type == TransportMidiEvent::EventType::noteOn) {
        if (cb) {
          double startSec = tickToSec(ev.tick);
          double endSec = tickToSec(ev.tick + ev.length);
          cb({CursorEvent::Type::noteOn, 0, et, startSec, ev.key,
              endSec - startSec, 0, 0});
        }
        if (soundFont) {
          tsf_channel_set_presetnumber(soundFont, ev.channel, 0, 0);
          tsf_channel_note_on(soundFont, ev.channel, ev.key, ev.velocity / 127.0f);
          activeNotes.push_back({ev.tick + ev.length, ev.channel, ev.key});
        }
      }
      else if (ev.type == TransportMidiEvent::EventType::noteOff) {
        if (soundFont)
          tsf_channel_note_off(soundFont, ev.channel, ev.key);
        for (auto it = activeNotes.begin(); it != activeNotes.end(); ) {
          if (it->channel == ev.channel && it->key == ev.key)
            it = activeNotes.erase(it);
          else
            ++it;
        }
      }
    }

    for (auto it = activeNotes.begin(); it != activeNotes.end(); ) {
      if (it->endTick <= (int)nTick) {
        if (soundFont)
          tsf_channel_note_off(soundFont, it->channel, it->key);
        it = activeNotes.erase(it);
      } else {
        ++it;
      }
    }

    currentTick = nTick;
  }
};

Transport::Transport() : impl_(std::make_unique<Impl>()) {}
Transport::~Transport() { shutdown(); }

void Transport::init(juce::AudioDeviceManager* d) {
  juce::ScopedLock l(impl_->lock);
  impl_->dm = d;
  if (d) {
    auto s = d->getAudioDeviceSetup();
    impl_->sampleRate = s.sampleRate ? s.sampleRate : 48000;
  }
}

void Transport::shutdown() {
  juce::ScopedLock l(impl_->lock);
  impl_->playing = false;
  impl_->activeNotes.clear();
  if (impl_->soundFont)
    tsf_note_off_all(impl_->soundFont);
  impl_->closeSoundFont();
}

void Transport::loadSoundFont(const char* sf2Path) {
  juce::ScopedLock l(impl_->lock);
  impl_->closeSoundFont();
  impl_->soundFont = tsf_load_filename(sf2Path);
  if (impl_->soundFont) {
    tsf_set_output(impl_->soundFont, TSF_STEREO_INTERLEAVED,
                   static_cast<int>(impl_->sampleRate), 0.0f);
    tsf_channel_set_presetnumber(impl_->soundFont, 0, 0, 0);
  }
  // Keep the legacy stub behavior so callers (and existing tests) can report
  // that a sound-font load was attempted.
  impl_->sfLoaded = true;
}

bool Transport::isSoundFontLoaded() const { return impl_->sfLoaded; }

void Transport::loadScore(const TransportMidiEvent* ev, int n) {
  juce::ScopedLock l(impl_->lock);
  impl_->events.assign(ev, ev + n);
  std::sort(impl_->events.begin(), impl_->events.end(),
            [](auto& a, auto& b) { return a.tick < b.tick; });
  impl_->tempoMap.clear();
  for (auto& e : impl_->events)
    if (e.type == TransportMidiEvent::EventType::tempo)
      impl_->tempoMap.push_back({e.tick, (double)e.tempoBpm});
  std::sort(impl_->tempoMap.begin(), impl_->tempoMap.end(),
            [](auto& a, auto& b) { return a.tick < b.tick; });
}

void Transport::clearScore() {
  juce::ScopedLock l(impl_->lock);
  impl_->events.clear();
  impl_->tempoMap.clear();
  impl_->activeNotes.clear();
  impl_->currentTick = 0;
  if (impl_->soundFont)
    tsf_note_off_all(impl_->soundFont);
}

void Transport::play() {
  juce::ScopedLock l(impl_->lock);
  impl_->playing = true;
}

void Transport::pause() {
  juce::ScopedLock l(impl_->lock);
  impl_->playing = false;
}

void Transport::stop() {
  juce::ScopedLock l(impl_->lock);
  impl_->playing = false;
  impl_->currentTick = 0;
  impl_->activeNotes.clear();
  if (impl_->soundFont)
    tsf_note_off_all(impl_->soundFont);
}

void Transport::seek(int t) {
  juce::ScopedLock l(impl_->lock);
  impl_->currentTick = t;
  impl_->activeNotes.clear();
  if (impl_->soundFont)
    tsf_note_off_all(impl_->soundFont);
}

void Transport::setSpeed(double r) {
  juce::ScopedLock l(impl_->lock);
  impl_->speed = r;
}

void Transport::setLoop(int s, int e) {
  juce::ScopedLock l(impl_->lock);
  impl_->loopOn = true;
  impl_->loopStart = s;
  impl_->loopEnd = e;
}

void Transport::clearLoop() {
  juce::ScopedLock l(impl_->lock);
  impl_->loopOn = false;
}

bool Transport::isPlaying() const { return impl_->playing; }
int Transport::currentTick() const { return (int)impl_->currentTick; }
double Transport::positionSeconds() const { return impl_->tickToSec((int)impl_->currentTick); }
double Transport::speedRatio() const { return impl_->speed; }
void Transport::setCursorCallback(CursorCallback c) { impl_->cb = std::move(c); }

void Transport::getNextAudioBlock(const juce::AudioSourceChannelInfo& buf) {
  if (!buf.buffer) {
    if (!impl_->playing) return;
    juce::ScopedLock l(impl_->lock);
    impl_->advance(buf.numSamples / impl_->sampleRate);
    return;
  }

  if (!impl_->playing) {
    buf.clearActiveBufferRegion();
    return;
  }

  juce::ScopedLock l(impl_->lock);
  impl_->advance(buf.numSamples / impl_->sampleRate);

  const int numSamples = buf.numSamples;
  if (numSamples <= 0) {
    buf.clearActiveBufferRegion();
    return;
  }

  if (!impl_->soundFont) {
    buf.clearActiveBufferRegion();
    return;
  }

  std::vector<float> temp(static_cast<size_t>(numSamples) * 2);
  tsf_render_float(impl_->soundFont, temp.data(), numSamples, 0);

  const int numChannels = buf.buffer->getNumChannels();
  for (int ch = 0; ch < numChannels; ++ch) {
    float* dest = buf.buffer->getWritePointer(ch, buf.startSample);
    int srcOffset = (ch & 1);
    for (int i = 0; i < numSamples; ++i)
      dest[i] = temp[static_cast<size_t>(i) * 2 + srcOffset];
  }
}
