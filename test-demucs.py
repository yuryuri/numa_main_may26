#!/usr/bin/env python
import torch
import torchaudio
import soundfile
import os

# Test if soundfile can save files
print("Testing soundfile save capability...")
try:
    # Create a simple audio sample
    sample_rate = 44100
    test_data = torch.zeros(2, sample_rate)  # 1 second of silence, stereo
    test_file = "test_output.wav"
    
    # Try to save with torchaudio
    print(f"Available torchaudio backends: {torchaudio.list_audio_backends()}")
    print(f"Current backend: {torchaudio.get_audio_backend()}")
    
    # Try different backends
    for backend in torchaudio.list_audio_backends():
        try:
            print(f"Testing backend: {backend}")
            torchaudio.set_audio_backend(backend)
            torchaudio.save(test_file, test_data, sample_rate)
            print(f"Successfully saved audio with backend: {backend}")
            os.remove(test_file)
        except Exception as e:
            print(f"Error with backend {backend}: {e}")
    
    # Also try with soundfile directly
    print("Testing with soundfile directly...")
    soundfile.write(test_file, test_data.numpy().T, sample_rate)
    print("Successfully saved audio with soundfile")
    os.remove(test_file)
    
    print("Audio file saving test completed successfully")
except Exception as e:
    print(f"Error: {e}") 