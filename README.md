# Numa Music Remixing App

A web application for separating YouTube audio into stems (vocals, drums, bass, other) and controlling them individually.

## Features

- Extract audio from YouTube videos
- Separate audio into individual stems using Demucs
- Control stem volumes independently
- Mix and remix audio in real-time using Web Audio API

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/yuryuri/numa1.git
   cd numa1
   ```

2. Run the setup script to create the virtual environment and install dependencies:
   ```
   ./setup.sh
   ```

3. Activate the virtual environment:
   ```
   source numa-env/bin/activate
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Requirements

- Python 3.10+
- Node.js 18+
- Sox and libsndfile (installed via setup.sh)

## License

MIT
