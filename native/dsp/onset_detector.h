#pragma once
#include <cstdint>

namespace guitar_learner::dsp {

// 起音检测结果
struct OnsetResult {
  bool onset;    // 是否为本帧起音
  float energy;  // 当前窗口能量（RMS）
};

// 起音检测器：基于能量包络（RMS）的瞬态检测；回调安全（无分配）。
class OnsetDetector {
public:
  // threshold：起音能量阈值；minGapSamples：两次起音最小间隔（样本，防连击）
  OnsetDetector(float threshold = 0.005f, int minGapSamples = 512, double sampleRate = 48000.0);

  // 处理一帧；回调安全（无分配/无锁/无 IO）
  OnsetResult analyze(const float* samples, int numSamples);

  void reset();

  float getEnergy(const float* samples, int numSamples) const;

private:
  float threshold_;
  int minGapSamples_;
  double sampleRate_;
  int sinceLast_ = 0;   // 距上次起音帧的采样数（初始 >= minGapSamples_ 使首帧可起音）
  float lastEnergy_ = 0.0f;
};

} // namespace guitar_learner::dsp
