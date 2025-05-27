# Numa - AI-Powered Stem Separation and Remix Tool

Numa is a web application that allows users to separate YouTube songs into individual stems (vocals, drums, bass, and other instruments) and remix them in real-time. Built with Next.js and the Web Audio API, it provides an intuitive interface for music manipulation.

## Features

- 🎵 YouTube song stem separation using AI
- 🎚️ Real-time volume control for each stem
- 🔇 Individual stem muting/unmuting
- 📊 Waveform visualization with playhead tracking
- ⬇️ Download individual stems
- 🎯 Precise seeking and playback control
- 💬 Natural language control interface

## Tech Stack

- Next.js 13+ (App Router)
- TypeScript
- Web Audio API
- WaveSurfer.js
- Zustand for state management
- Tailwind CSS
- Heroicons

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yuryuri/numa_main_may26.git
   cd numa-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with the following:
   ```
   NEXT_PUBLIC_API_URL=your_api_url
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a YouTube URL on the home page
2. Wait for the AI to separate the stems
3. Use the controls to adjust volume, mute/unmute stems
4. Click on waveforms to seek to specific positions
5. Download individual stems using the download buttons
6. Use natural language commands to control the mix

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
