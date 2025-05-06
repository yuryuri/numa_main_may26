"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";

export default function Home() {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    // Navigate to remix page with the URL
    window.location.href = `/remix?url=${encodeURIComponent(url)}`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
          Numa
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Remix YouTube audio on your mobile device
        </p>
      </div>

      <div className="relative w-full max-w-lg flex flex-col items-center">
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex flex-col gap-4 w-full">
            <label htmlFor="youtube-url" className="text-sm font-medium">
              Paste a YouTube URL
            </label>
            <input
              id="youtube-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-lg font-medium text-white transition-colors"
            >
              Remix Now
            </button>
          </div>
        </form>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <ol className="text-left space-y-6 max-w-md mx-auto">
            <li className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">1</div>
              <div>
                <h3 className="font-medium">Paste YouTube URL</h3>
                <p className="text-gray-400 text-sm">Enter any YouTube video URL</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">2</div>
              <div>
                <h3 className="font-medium">AI Audio Separation</h3>
                <p className="text-gray-400 text-sm">We'll split the track into vocals, drums, bass, and other elements</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center">3</div>
              <div>
                <h3 className="font-medium">Remix in Real Time</h3>
                <p className="text-gray-400 text-sm">Adjust levels, mute stems, add effects with simple controls</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <footer className="mt-auto pt-8 w-full border-t border-gray-800 flex flex-col items-center">
        <p className="text-gray-400 text-sm">
          Numa &copy; {new Date().getFullYear()} | 
          <Link href="/about" className="text-indigo-400 hover:text-indigo-300 ml-1">
            About
          </Link>
        </p>
      </footer>
    </main>
  );
}
