#pragma once

#include <JuceHeader.h>
#include <vector>
#include <string>
#include <memory>
#include <functional>

struct CursorEvent {
  enum class Type { barStart, beatTick, noteOn, noteOff, tempoChange, complete };
  Type type;
  int occurrenceId;
  double tick;
  double timeSeconds;
  int midiNote;
  double durationSeconds;
  int barIndex;
  int beatIndex;
};

struct TransportMidiEvent {
  int tick;
  enum class EventType { noteOn, noteOff, tempo, timeSig } type;
  int channel;
  int key;
  int velocity;
  int length;
  int tempoBpm;
  int timeSigNum;
  int timeSigDen;
};

struct TempoPoint {
  int tick;
  double bpm;
};

class Transport {
public:
  Transport();
  ~Transport();

  void init(juce::AudioDeviceManager* deviceManager);
  void shutdown();
  void loadSoundFont(const char* sf2Path);
  bool isSoundFontLoaded() const;
  void loadScore(const TransportMidiEvent* events, int count);
  void clearScore();
  void play();
  void pause();
  void stop();
  void seek(int tick);
  void setSpeed(double ratio);
  void setLoop(int startTick, int endTick);
  void clearLoop();
  bool isPlaying() const;
  int currentTick() const;
  double positionSeconds() const;
  double speedRatio() const;
  using CursorCallback = std::function<void(const CursorEvent&)>;
  void setCursorCallback(CursorCallback cb);
  void prepareToPlay(int samplesPerBlock, double sampleRate) {}
  void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill);
  void releaseResources() {}

private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
