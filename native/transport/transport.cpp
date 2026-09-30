#include "transport.h"
#include <algorithm>
#include <cmath>

static const int kPpq = 960;

struct Transport::Impl {
  juce::AudioDeviceManager* dm = nullptr;
  juce::CriticalSection lock;
  bool sfLoaded = false;
  std::vector<TransportMidiEvent> events;
  std::vector<TempoPoint> tempoMap;
  bool playing = false;
  double currentTick = 0;
  double sampleRate = 48000;
  double speed = 1;
  bool loopOn = false;
  int loopStart = 0, loopEnd = 0;
  CursorCallback cb;

  double tickToSec(int tick) const {
    if (tempoMap.empty()) return tick * 60.0 / (kPpq * 120.0);
    double s = 0; int pt = 0; double pb = 120;
    int i = 0;
    while (i < (int)tempoMap.size() && tempoMap[i].tick <= tick) {
      s += (tempoMap[i].tick - pt) * 60.0 / (kPpq * pb);
      pt = tempoMap[i].tick; pb = tempoMap[i].bpm; ++i;
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
      currentTick = nTick; return;
    }
    for (const auto& ev : events) {
      double et = (double)ev.tick;
      if (et > currentTick && et <= nTick && ev.type == TransportMidiEvent::EventType::noteOn) {
        if (cb) cb({CursorEvent::Type::noteOn, 0, et, tickToSec(ev.tick), ev.key,
                     tickToSec(ev.tick+ev.length)-tickToSec(ev.tick), 0, 0});
      }
    }
    currentTick = nTick;
  }
};

Transport::Transport() : impl_(std::make_unique<Impl>()) {}
Transport::~Transport() { shutdown(); }

void Transport::init(juce::AudioDeviceManager* d) {
  juce::ScopedLock l(impl_->lock); impl_->dm = d;
  if (d) { auto s = d->getAudioDeviceSetup(); impl_->sampleRate = s.sampleRate ? s.sampleRate : 48000; }
}
void Transport::shutdown() { juce::ScopedLock l(impl_->lock); impl_->playing = false; }
void Transport::loadSoundFont(const char*) { impl_->sfLoaded = true; }
bool Transport::isSoundFontLoaded() const { return impl_->sfLoaded; }

void Transport::loadScore(const TransportMidiEvent* ev, int n) {
  juce::ScopedLock l(impl_->lock);
  impl_->events.assign(ev, ev+n);
  std::sort(impl_->events.begin(), impl_->events.end(),
            [](auto& a, auto& b){return a.tick<b.tick;});
  impl_->tempoMap.clear();
  for (auto& e : impl_->events)
    if (e.type==TransportMidiEvent::EventType::tempo)
      impl_->tempoMap.push_back({e.tick,(double)e.tempoBpm});
  std::sort(impl_->tempoMap.begin(), impl_->tempoMap.end(),
            [](auto& a, auto& b){return a.tick<b.tick;});
}
void Transport::clearScore() {
  juce::ScopedLock l(impl_->lock);
  impl_->events.clear(); impl_->tempoMap.clear(); impl_->currentTick=0;
}
void Transport::play()  { juce::ScopedLock l(impl_->lock); impl_->playing=true; }
void Transport::pause() { juce::ScopedLock l(impl_->lock); impl_->playing=false; }
void Transport::stop()  { juce::ScopedLock l(impl_->lock); impl_->playing=false; impl_->currentTick=0; }
void Transport::seek(int t) { juce::ScopedLock l(impl_->lock); impl_->currentTick=t; }
void Transport::setSpeed(double r) { juce::ScopedLock l(impl_->lock); impl_->speed=r; }
void Transport::setLoop(int s, int e) {
  juce::ScopedLock l(impl_->lock); impl_->loopOn=true; impl_->loopStart=s; impl_->loopEnd=e;
}
void Transport::clearLoop() { juce::ScopedLock l(impl_->lock); impl_->loopOn=false; }
bool Transport::isPlaying() const     { return impl_->playing; }
int Transport::currentTick() const    { return (int)impl_->currentTick; }
double Transport::positionSeconds() const { return impl_->tickToSec((int)impl_->currentTick); }
double Transport::speedRatio() const  { return impl_->speed; }
void Transport::setCursorCallback(CursorCallback c) { impl_->cb = std::move(c); }

void Transport::getNextAudioBlock(const juce::AudioSourceChannelInfo& buf) {
  if (!impl_->playing) { buf.clearActiveBufferRegion(); return; }
  juce::ScopedLock l(impl_->lock);
  impl_->advance(buf.numSamples / impl_->sampleRate);
  buf.clearActiveBufferRegion();
}
