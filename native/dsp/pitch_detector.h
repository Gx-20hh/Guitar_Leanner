#pragma once  
#include <cstdint>  
#include <vector>  
  
namespace guitar_learner::dsp {  
  
// YIN pitch estimation result  
struct PitchResult {  
  double frequencyHz; // 0.0 = no detection  
  double confidence;  // 0..1  
  bool valid;  
};  
  
// YIN pitch detector: callback-safe (pre-allocated buffers, no alloc/lock/IO)  
// Analysis window: 2048 samples (default), expandable to 4096 for low notes  
class PitchDetector {  
public:  
  PitchDetector(int windowSize = 2048, double sampleRate = 48000.0, double minFreq = 65.0, double maxFreq = 1400.0);  
  
  // Process one analysis window; callback-safe (no alloc)  
  PitchResult analyze(const float* samples, int numSamples);  
  
  double getSampleRate() const { return sampleRate_; }  
  int getWindowSize() const { return windowSize_; }  
  
private:  
  int windowSize_;  
  double sampleRate_;  
  double minFreq_;  
  double maxFreq_;  
  std::vector<float> diffBuf_;  // pre-allocated YIN difference buffer  
  std::vector<double> cmndfBuf_; // pre-allocated CMNDF buffer  
  
  double parabolicInterpolation(int tau, double y0, double y1, double y2) const;
};

} // namespace guitar_learner::dsp
  
