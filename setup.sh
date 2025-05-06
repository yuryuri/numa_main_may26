#!/bin/bash

# Create Python virtual environment
python3 -m venv numa-env

# Activate virtual environment
source numa-env/bin/activate

# Install Python dependencies
pip install torch torchaudio demucs soundfile sox

# Install system dependencies (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  brew install sox libsndfile
fi

# Install Node.js dependencies
npm install

echo "Setup complete! Run 'source numa-env/bin/activate' to activate the Python environment before starting the app." 