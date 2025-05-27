import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useAudioStore } from '@/store/audioStore';

interface WaveformVisualizerProps {
  audioUrl: string;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  color?: string;
  stemId: string;
}

export default function WaveformVisualizer({
  audioUrl,
  isPlaying,
  onTimeUpdate,
  color = '#6366f1',
  stemId,
}: WaveformVisualizerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [attemptedFetch, setAttemptedFetch] = useState(false);
  const maxRetries = 3;
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Get current time from store
  const { currentTime, seekTo } = useAudioStore();

  // Keep wavesurfer in sync with global time
  useEffect(() => {
    if (wavesurferRef.current && isReady && Math.abs(wavesurferRef.current.getCurrentTime() - currentTime) > 0.1) {
      wavesurferRef.current.seekTo(currentTime / (wavesurferRef.current.getDuration() || 1));
    }
  }, [currentTime, isReady]);

  // Check if the URL is properly formed and accessible
  useEffect(() => {
    if (!audioUrl) return;
    
    const checkUrl = async () => {
      // Create a new AbortController for this request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      try {
        setAttemptedFetch(true);
        
        // Set a timeout to abort the request after 5 seconds
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            console.log(`Aborting URL check for ${stemId} due to timeout`);
            abortControllerRef.current.abort();
          }
        }, 5000);
        
        const response = await fetch(audioUrl, { 
          method: 'HEAD',
          cache: 'force-cache',
          headers: { 'Range': 'bytes=0-0' }, // Request just the headers
          signal: abortControllerRef.current.signal
        });
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`Audio URL check failed for ${stemId}:`, response.status);
          setLoadError(true);
        }
      } catch (err) {
        // Handle abort errors gracefully
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.warn(`URL check for ${stemId} was aborted`);
        } else {
          console.error(`Failed to access audio URL for ${stemId}:`, err);
          setLoadError(true);
        }
      }
    };
    
    checkUrl();
    
    // Cleanup function to abort any in-progress fetches
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [audioUrl, stemId]);

  // Initialize WaveSurfer only once
  useEffect(() => {
    if (!waveformRef.current || !audioUrl || loadError || !attemptedFetch) return;
    
    // Cleanup any existing wavesurfer instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    
    try {
      // Reset error state
      setIsReady(false);
      
      console.log(`Initializing WaveSurfer for ${stemId} with URL: ${audioUrl}`);
      
      // Initialize WaveSurfer with more robust settings
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: color,
        progressColor: '#818cf8',
        cursorColor: '#c7d2fe',
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 1,
        height: 50, // Shorter height for better performance
        barGap: 2,
        normalize: true,
        backend: 'MediaElement', // More compatible with various formats
        autoCenter: true,
        minPxPerSec: 1, // Lower value for better performance
        hideScrollbar: true,
        interact: true,
        fillParent: true,
      });
      
      wavesurferRef.current = wavesurfer;
      
      // Set up event listeners
      wavesurfer.on('ready', () => {
        console.log(`Wavesurfer ready for ${stemId}!`);
        setIsReady(true);
        setLoadError(false);
      });
      
      wavesurfer.on('error' as any, (err) => {
        console.error(`Wavesurfer error for ${stemId}:`, err);
        
        // Try to recover with retry
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          // Retry with a short delay
          setTimeout(() => {
            console.log(`Retrying waveform for ${stemId}, attempt ${retryCount + 1}`);
            try {
              wavesurfer.load(audioUrl);
            } catch (e) {
              console.error('Error during retry:', e);
              setLoadError(true);
            }
          }, 1000);
        } else {
          setLoadError(true);
        }
      });
      
      // Click is for seeking only
      wavesurfer.on('click', () => {
        if (isReady) {
          const clickTime = wavesurfer.getCurrentTime();
          seekTo(clickTime);
          onTimeUpdate(clickTime);
        }
      });
      
      // Update seeking logic to properly sync with audio elements
      wavesurfer.on('seeking', () => {
        if (isReady) {
          const seekTime = wavesurfer.getCurrentTime();
          seekTo(seekTime);
          onTimeUpdate(seekTime);
        }
      });
      
      // Load the audio with error handling
      try {
        // Directly attempt to preload the audio file before initializing the waveform
        const preloadAudio = new Audio();
        
        // Add event listeners first
        preloadAudio.addEventListener('canplaythrough', () => {
          console.log(`Successfully preloaded audio for ${stemId}`);
          
          // Only after successful preload, try to load it into wavesurfer
          try {
            // Create fresh abort controller for this operation
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();
            
            console.log(`Loading audio into wavesurfer for ${stemId} from URL: ${audioUrl}`);
            wavesurfer.load(audioUrl);
          } catch (loadErr) {
            // Check for AbortError
            if (loadErr instanceof DOMException && loadErr.name === 'AbortError') {
              console.warn(`Wavesurfer load for ${stemId} was aborted`);
              // We don't set error state here since this is an intentional abort
            } else {
              console.error(`Wavesurfer load error for ${stemId}:`, loadErr);
              setLoadError(true);
            }
          }
        });
        
        preloadAudio.addEventListener('error', (e) => {
          console.error(`Error preloading audio for ${stemId}:`, e);
          setLoadError(true);
        });
        
        // Set source and begin loading
        preloadAudio.crossOrigin = 'anonymous';
        preloadAudio.src = audioUrl;
        preloadAudio.load();
        
        // Set a timeout for preloading
        const timeoutId = setTimeout(() => {
          // If we haven't loaded after 10 seconds and there's no error yet, 
          // try direct wavesurfer loading as a fallback
          if (!isReady && !loadError) {
            console.log(`Preload timeout for ${stemId}, trying direct wavesurfer load`);
            try {
              wavesurfer.load(audioUrl);
            } catch (err) {
              // Check for AbortError
              if (err instanceof DOMException && err.name === 'AbortError') {
                console.warn(`Fallback load for ${stemId} was aborted`);
              } else {
                console.error(`Fallback load error for ${stemId}:`, err);
                setLoadError(true);
              }
            }
          }
        }, 10000);
        
        // Clear timeout on cleanup
        return () => {
          clearTimeout(timeoutId);
        };
      } catch (err) {
        console.error(`Error with audio setup for ${stemId}:`, err);
        setLoadError(true);
      }
    } catch (err) {
      console.error(`Error creating WaveSurfer for ${stemId}:`, err);
      setLoadError(true);
      return () => {}; // Empty cleanup if initialization failed
    }
    
    // Cleanup
    return () => {
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (e) {
          console.error('Error destroying wavesurfer instance:', e);
        }
        wavesurferRef.current = null;
      }
      
      // Also abort any pending operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [audioUrl, color, stemId, retryCount, loadError, attemptedFetch]);

  // Function to retry loading if it failed
  const handleRetry = () => {
    if (loadError) {
      setLoadError(false);
      setRetryCount(0);
      setAttemptedFetch(false); // Reset fetch check to trigger URL validation again
      
      // Abort any existing operations before retry
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Abort any pending operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Fix mute and volume control
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isReady ? 1 : 0);
    }
  }, [isReady]);

  // Add volume control logic
  const handleVolumeChange = (volume: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(volume);
    }
  };

  // Fix mute button to only silence the stem
  const handleMuteToggle = () => {
    if (wavesurferRef.current) {
      const currentVolume = wavesurferRef.current.getVolume();
      wavesurferRef.current.setVolume(currentVolume > 0 ? 0 : 1);
    }
  };

  return (
    <div className="w-full bg-gray-900 rounded-lg p-2 relative">
      {/* If data is still loading or errored, show a placeholder */}
      {(!isReady || loadError) && (
        <div className="w-full h-[50px] bg-gray-800 rounded"></div>
      )}
      
      {/* Actual waveform container */}
      <div 
        ref={waveformRef} 
        className={`w-full cursor-pointer ${(!isReady || loadError) ? 'hidden' : 'block'}`}
      />
      
      {/* Loading indicator */}
      {!isReady && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      )}
      
      {/* Error display with retry button */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm">
          <span className="mb-1">Waveform unavailable</span>
          <button 
            onClick={handleRetry} 
            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
} 