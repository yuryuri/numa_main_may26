import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Link 
          href="/"
          className="text-indigo-400 hover:text-indigo-300"
        >
          &larr; Back to Home
        </Link>
      </div>
      
      <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-6">
        About Numa
      </h1>
      
      <div className="space-y-6 text-gray-300">
        <p className="text-xl">
          Numa is a mobile-first progressive web app that allows anyone to remix and manipulate audio from YouTube in real time, directly from their mobile browser.
        </p>
        
        <h2 className="text-2xl font-bold text-white mt-8">Our Mission</h2>
        <p>
          We believe that music creation and remixing should be accessible to everyone, not just professional DJs and producers with expensive equipment. Numa democratizes music remixing by putting powerful audio manipulation tools in your pocket.
        </p>
        
        <h2 className="text-2xl font-bold text-white mt-8">How It Works</h2>
        <ol className="list-decimal pl-6 space-y-4">
          <li>
            <strong>Audio Extraction:</strong> Numa extracts audio from YouTube videos and converts it to a high-quality WAV format.
          </li>
          <li>
            <strong>Stem Separation:</strong> Using advanced AI audio processing (Demucs/Spleeter), we separate the audio into different stems: vocals, drums, bass, and other elements.
          </li>
          <li>
            <strong>Real-time Manipulation:</strong> Our intuitive interface lets you adjust levels, mute/solo stems, and even use natural language to control your mix.
          </li>
        </ol>
        
        <h2 className="text-2xl font-bold text-white mt-8">Technology</h2>
        <p>
          Numa is built with cutting-edge web technology including React, Web Audio API, and machine learning models for audio separation. The app works entirely in your browser with no downloads required.
        </p>
        
        <h2 className="text-2xl font-bold text-white mt-8">Fair Use</h2>
        <p>
          Numa is designed for personal, non-commercial use and music education. We respect copyright and encourage users to do the same. Please only use Numa with content you have rights to remix or that falls under fair use.
        </p>
        
        <div className="border-t border-gray-800 pt-8 mt-8">
          <p className="text-gray-400">
            &copy; {new Date().getFullYear()} Numa Music Technology
          </p>
        </div>
      </div>
    </main>
  );
} 