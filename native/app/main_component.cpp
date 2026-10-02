#include "main_component.h"
#include "transport/transport.h"

namespace guitar_learner {

MainComponent::MainComponent()
    : webViewHost_ (transport_)
{
    initAudio();
    loadDefaultSoundFont();
    addAndMakeVisible (webViewHost_);
    setSize (900, 600);
}

MainComponent::~MainComponent()
{
    shutdownAudio();
}

void MainComponent::initAudio()
{
    transport_.init (&deviceManager_);

    juce::AudioDeviceManager::AudioDeviceSetup setup;
    setup.sampleRate = 48000.0;
    setup.bufferSize = 256;

    deviceManager_.initialise (0, 2, nullptr, true, {}, &setup);
    deviceManager_.addAudioCallback (this);
}

void MainComponent::shutdownAudio()
{
    deviceManager_.removeAudioCallback (this);
    transport_.shutdown();
    deviceManager_.closeAudioDevice();
}

void MainComponent::loadDefaultSoundFont()
{
    const auto exe = juce::File::getSpecialLocation (juce::File::currentExecutableFile);
    const auto sf2 = exe.getParentDirectory().getChildFile ("resources/TimGM6mb.sf2");

    transport_.loadSoundFont (sf2.getFullPathName().toRawUTF8());
}

void MainComponent::audioDeviceAboutToStart (juce::AudioIODevice* device)
{
    if (device != nullptr)
        transport_.prepareToPlay (device->getCurrentBufferSizeSamples(),
                                  device->getCurrentSampleRate());
}

void MainComponent::audioDeviceStopped()
{
    transport_.releaseResources();
}

void MainComponent::audioDeviceIOCallbackWithContext (const float* const* inputChannelData,
                                                       int numInputChannels,
                                                       float* const* outputChannelData,
                                                       int numOutputChannels,
                                                       int numSamples,
                                                       const juce::AudioIODeviceCallbackContext& /*context*/)
{
    if (numInputChannels > 0 && inputChannelData != nullptr)
    {
        inputBuffer_.setDataToReferTo (const_cast<float* const*> (inputChannelData),
                                       numInputChannels, numSamples);
        juce::AudioSourceChannelInfo inputInfo (&inputBuffer_, 0, numSamples);
        transport_.captureInput (inputInfo);
    }

    if (numOutputChannels > 0 && outputChannelData != nullptr)
    {
        outputBuffer_.setDataToReferTo (outputChannelData, numOutputChannels, numSamples);
        outputBuffer_.clear();
        juce::AudioSourceChannelInfo outputInfo (&outputBuffer_, 0, numSamples);
        transport_.getNextAudioBlock (outputInfo);
    }
}

} // namespace guitar_learner
