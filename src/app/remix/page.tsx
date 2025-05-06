"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  MusicalNoteIcon,
  ExclamationCircleIcon
} from "@heroicons/react/24/solid";
import Link from "next/link";
import { useAudioStore } from "@/store/audioStore";

export default function RemixPage() {
  const searchParams = useSearchParams();
  const ytUrl = searchParams.get("url") || "";
  const [audioError, setAudioError] = useState<string | null>(null);
  
  // Get state from store
  const { 
    isProcessing, 
    loadingProgress, 
    isPlaying, 
    songTitle, 
    error,
    stems,
    setPlaying,
    toggleStem,
    adjustStemVolume,
    processYoutubeUrl,
    playAllStems, 
    pauseAllStems
  } = useAudioStore();
  
  // Refs
  const waveformRef = useRef<HTMLDivElement>(null);
  
  // Process YouTube URL on component mount
  useEffect(() => {
    if (ytUrl) {
      processYoutubeUrl(ytUrl);
    }
    
    // Cleanup function to pause all audio when component unmounts
    return () => {
      pauseAllStems();
    };
  }, [ytUrl, processYoutubeUrl, pauseAllStems]);
  
  // Watch for store errors and update local error state
  useEffect(() => {
    if (error) {
      setAudioError(error);
    }
  }, [error]);
  
  // Toggle play/pause
  const togglePlayback = () => {
    // Clear any previous errors
    setAudioError(null);
    
    try {
      if (isPlaying) {
        pauseAllStems();
      } else {
        // Check if we have any loaded stems
        const hasLoadedStems = stems.some(stem => stem.active && stem.loaded);
        if (!hasLoadedStems) {
          setAudioError("Audio is still loading. Please wait a moment and try again.");
          return;
        }
        
        playAllStems();
      }
    } catch (err) {
      console.error("Playback error:", err);
      setAudioError("Could not play audio. Please try again.");
    }
  };
  
  // Apply natural language instruction
  const applyInstruction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const instruction = formData.get('instruction')?.toString().toLowerCase() || '';
    
    // Clear any previous errors
    setAudioError(null);
    
    // Very simple parsing for demo purposes
    if (instruction.includes("mute") || instruction.includes("remove")) {
      if (instruction.includes("vocals")) {
        toggleStem("vocals");
      } else if (instruction.includes("drums")) {
        toggleStem("drums");
      } else if (instruction.includes("bass")) {
        toggleStem("bass");
      } else if (instruction.includes("other")) {
        toggleStem("other");
      } else if (instruction.includes("all")) {
        stems.forEach(stem => toggleStem(stem.id));
      }
    } else if (instruction.includes("boost") || instruction.includes("increase")) {
      if (instruction.includes("vocals")) {
        adjustStemVolume("vocals", 1.0);
      } else if (instruction.includes("drums")) {
        adjustStemVolume("drums", 1.0);
      } else if (instruction.includes("bass")) {
        adjustStemVolume("bass", 1.0);
      } else if (instruction.includes("other")) {
        adjustStemVolume("other", 1.0);
      }
    } else if (instruction.includes("lower") || instruction.includes("reduce")) {
      if (instruction.includes("vocals")) {
        adjustStemVolume("vocals", 0.3);
      } else if (instruction.includes("drums")) {
        adjustStemVolume("drums", 0.3);
      } else if (instruction.includes("bass")) {
        adjustStemVolume("bass", 0.3);
      } else if (instruction.includes("other")) {
        adjustStemVolume("other", 0.3);
      }
    } else if (instruction.includes("play")) {
      playAllStems();
    } else if (instruction.includes("stop") || instruction.includes("pause")) {
      pauseAllStems();
    } else {
      setAudioError("I didn't understand that instruction. Try something like 'mute vocals' or 'boost bass'.");
    }
    
    form.reset();
  };
  
  // Calculate if any stems are still loading
  const stemsLoading = stems.some(stem => !stem.loaded);
  const allStemsLoaded = stems.length > 0 && stems.every(stem => stem.loaded);
  
  if (!ytUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-xl mb-4">No YouTube URL provided</p>
        <Link 
          href="/"
          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white"
        >
          Go back
        </Link>
      </div>
    );
  }
  
  if (error && !isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-xl text-red-500 mb-4">Error: {error}</p>
        <Link 
          href="/"
          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white"
        >
          Try again
        </Link>
      </div>
    );
  }
  
  return (
    <main className="flex min-h-screen flex-col p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link 
          href="/"
          className="p-2 rounded-full hover:bg-gray-800"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold truncate flex-1">
          {songTitle || "Loading..."}
        </h1>
      </div>
      
      {isProcessing ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="animate-spin mb-4">
            <ArrowPathIcon className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-xl font-medium mb-2">Processing Audio</h2>
          <p className="text-gray-400 mb-4">Separating stems with AI...</p>
          <div className="w-full max-w-md bg-gray-800 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="mt-2 text-sm text-gray-400">{Math.round(loadingProgress)}%</p>
        </div>
      ) : (
        <>
          {/* Audio Error Alert */}
          {audioError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
              <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{audioError}</p>
            </div>
          )}
          
          {/* Loading Status */}
          {stemsLoading && (
            <div className="mb-4 p-3 bg-indigo-900/30 border border-indigo-700 rounded-lg flex items-center gap-2">
              <div className="animate-spin flex-shrink-0">
                <ArrowPathIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-indigo-300 text-sm">
                Loading audio samples...
                ({stems.filter(s => s.loaded).length}/{stems.length} stems ready)
              </p>
            </div>
          )}
          
          {/* Waveform visualization */}
          <div 
            ref={waveformRef}
            className="waveform-container mb-4"
          >
            <div className="flex h-full items-center justify-center">
              <MusicalNoteIcon className="w-8 h-8 text-gray-600" />
              <span className="text-gray-600 ml-2">
                {isPlaying 
                  ? "Now Playing..." 
                  : allStemsLoaded 
                    ? "Ready to Play"
                    : "Loading Audio..."}
              </span>
            </div>
          </div>
          
          {/* Playback controls */}
          <div className="flex justify-center items-center gap-4 mb-6">
            <button 
              onClick={togglePlayback}
              className={`p-3 rounded-full transition-colors ${
                allStemsLoaded
                  ? "bg-indigo-600 hover:bg-indigo-700" 
                  : "bg-indigo-900/50 cursor-wait"
              }`}
              disabled={!allStemsLoaded}
            >
              {isPlaying ? (
                <PauseIcon className="w-6 h-6" />
              ) : (
                <PlayIcon className="w-6 h-6" />
              )}
            </button>
          </div>
          
          {/* Stems controls */}
          <h2 className="text-lg font-medium mb-3">Stems</h2>
          <div className="space-y-4 mb-8">
            {stems.map(stem => (
              <div key={stem.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${stem.loaded ? '' : 'animate-pulse'}`}
                      style={{ backgroundColor: stem.color }}
                    ></div>
                    <span className="font-medium">
                      {stem.name} 
                      {!stem.loaded && <span className="text-xs text-gray-400 ml-1">(loading)</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleStem(stem.id)}
                    className="p-1.5 rounded-full hover:bg-gray-800"
                    disabled={!stem.loaded}
                  >
                    {stem.active ? (
                      <SpeakerWaveIcon className="w-5 h-5 text-gray-300" />
                    ) : (
                      <SpeakerXMarkIcon className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={stem.volume}
                  onChange={(e) => adjustStemVolume(stem.id, parseFloat(e.target.value))}
                  disabled={!stem.active || !stem.loaded}
                  className="w-full slider-thumb"
                  style={{ 
                    accentColor: stem.color,
                    opacity: (stem.active && stem.loaded) ? 1 : 0.5
                  }}
                />
              </div>
            ))}
          </div>
          
          {/* Natural language controls */}
          <h2 className="text-lg font-medium mb-3">Natural Language Control</h2>
          <form onSubmit={applyInstruction} className="flex gap-2">
            <input
              type="text"
              name="instruction"
              placeholder="E.g., 'boost the bass' or 'mute vocals'"
              className="flex-1 rounded-lg border border-gray-700 bg-black px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Apply
            </button>
          </form>
        </>
      )}
    </main>
  );
} 