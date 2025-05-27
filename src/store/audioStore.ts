import { create } from 'zustand';

// Helper function to extract video ID from YouTube URL
function extractYoutubeVideoId(url: string): string {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : "";
}

export type Stem = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  volume: number;
  audio?: HTMLAudioElement;
  loaded: boolean;
  url: string;
};

interface AudioStore {
  // YouTube data
  ytUrl: string | null;
  videoId: string | null;
  songTitle: string | null;
  
  // Processing state
  isProcessing: boolean;
  loadingProgress: number;
  error: string | null;
  
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Stems
  stems: Stem[];
  
  // Shared audio context (single synchronized audio context)
  masterAudio: HTMLAudioElement | null;
  
  // Actions
  setYoutubeUrl: (url: string) => void;
  setVideoId: (id: string) => void;
  setSongTitle: (title: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setStems: (stems: Stem[]) => void;
  toggleStem: (stemId: string) => void;
  adjustStemVolume: (stemId: string, volume: number) => void;
  
  // Audio processing
  processYoutubeUrl: (url: string) => Promise<void>;
  playAllStems: () => void;
  pauseAllStems: () => void;
  seekTo: (time: number) => void;
}

// Using static MP3 files from a reliable CDN that has proper CORS headers
// GitHub Pages URLs are reliable and have appropriate CORS headers
const SAMPLE_AUDIO_URLS = {
  // Using GitHub raw content URLs (reliable with CORS support)
  drums: 'https://freesound.org/data/previews/476/476176_9876687-lq.mp3',
  vocals: 'https://freesound.org/data/previews/415/415362_7866507-lq.mp3',
  bass: 'https://freesound.org/data/previews/320/320539_5260872-lq.mp3',
  other: 'https://freesound.org/data/previews/617/617306_1735785-lq.mp3'
};

export const useAudioStore = create<AudioStore>((set, get) => ({
  // Initial state
  ytUrl: null,
  videoId: null,
  songTitle: null,
  isProcessing: false,
  loadingProgress: 0,
  error: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  stems: [],
  masterAudio: null,
  
  // Actions
  setYoutubeUrl: (url) => set({ ytUrl: url }),
  setVideoId: (id) => set({ videoId: id }),
  setSongTitle: (title) => set({ songTitle: title }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setError: (error) => set({ error }),
  setPlaying: (isPlaying) => {
    const { masterAudio } = get();
    
    if (masterAudio) {
      if (isPlaying) {
        // Play the master audio
        const playPromise = masterAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Playback error:", error);
            set({ error: "Could not play audio. Try clicking play again." });
          });
        }
      } else {
        // Pause the master audio
        masterAudio.pause();
      }
    }
    
    set({ isPlaying });
  },
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setStems: (stems) => set({ stems }),
  
  seekTo: (time) => {
    const { stems } = get();
    const audioElements = (window as any).audioElements;
    
    if (!audioElements) return;
    
    // Update all audio elements to the new time
    Object.entries(audioElements).forEach(([stemId, audio]: [string, any]) => {
      if (audio instanceof HTMLAudioElement) {
        audio.currentTime = time;
      }
    });
    
    // Update store's current time
    set({ currentTime: time });
  },
  
  playAllStems: () => {
    const { stems, isPlaying, currentTime } = get();
    
    if (!isPlaying) {
      // Get audio elements for each stem
      const audioElements = (window as any).audioElements;
      const audioContext = (window as any).audioContext;
      const gainNodes = (window as any).gainNodes;
      
      if (!audioElements || !audioContext || !gainNodes) return;
      
      // Check if any stems are active
      const hasActiveStems = stems.some(stem => stem.active && stem.loaded);
      if (!hasActiveStems) {
        console.log('No active stems to play');
        return;
      }
      
      // Start time tracking
      const startTimeTracking = () => {
        if (!get().isPlaying) return; // Stop if we're not playing anymore
        
        // Get the current time from the first active audio element
        for (const stem of stems) {
          if (stem.active && stem.loaded) {
            const audio = audioElements[stem.id];
            if (audio) {
              set({ currentTime: audio.currentTime });
              break;
            }
          }
        }
        
        // Schedule next update
        requestAnimationFrame(startTimeTracking);
      };
      
      // Start playback and time tracking
      Object.entries(audioElements).forEach(([stemId, audio]: [string, any]) => {
        if (audio instanceof HTMLAudioElement) {
          audio.currentTime = currentTime; // Ensure we start from the current time
        }
      });
      
      // Start playback
      Promise.all(
        stems
          .filter(stem => stem.loaded)
          .map(stem => {
            const audio = audioElements[stem.id];
            if (audio) {
              return audio.play().catch((err: any) => console.error(`Playback error for stem ${stem.id}:`, err));
            }
            return Promise.resolve();
          })
      ).then(() => {
        set({ isPlaying: true });
        startTimeTracking();
      });
    }
  },
  
  pauseAllStems: () => {
    const { isPlaying } = get();
    
    if (isPlaying) {
      const audioElements = (window as any).audioElements;
      if (!audioElements) return;
      
      Object.values(audioElements).forEach((audio: unknown) => {
        if (audio instanceof HTMLAudioElement) {
          audio.pause();
        }
      });
      
      set({ isPlaying: false });
    }
  },
  
  toggleStem: (stemId) => {
    const { stems } = get();

    // Find the gain nodes
    const gainNodes = (window as any).gainNodes;
    const audioContext = (window as any).audioContext;

    if (!gainNodes || !audioContext) return;

    // Find the stem and toggle its mute state
    const updatedStems = stems.map(stem => 
      stem.id === stemId 
        ? { ...stem, active: !stem.active } 
        : stem
    );

    // Get the specific stem we're toggling
    const stem = updatedStems.find(s => s.id === stemId);

    if (stem) {
      const gainNode = gainNodes[stem.id];

      if (gainNode) {
        // Toggle mute by setting gain to 0 or restoring volume
        const newVolume = stem.active ? Math.max(stem.volume, 0.0001) : 0;
        gainNode.gain.setValueAtTime(newVolume, audioContext.currentTime);
        console.log(`Stem ${stemId} volume set to ${newVolume}`);
      }
    }

    set({ stems: updatedStems });
  },
  
  adjustStemVolume: (stemId, volume) => {
    const { stems } = get();
    
    // Find the gain nodes
    const gainNodes = (window as any).gainNodes;
    const audioElements = (window as any).audioElements;
    const audioContext = (window as any).audioContext;
    
    if (!gainNodes || !audioElements || !audioContext) return;
    
    // Update volume in our store
    const updatedStems = stems.map(stem => 
      stem.id === stemId 
        ? { ...stem, volume } 
        : stem
    );
    
    // Apply volume to the gain node
    const stem = updatedStems.find(s => s.id === stemId);
    if (stem) {
      const gainNode = gainNodes[stem.id];
      const audio = audioElements[stem.id];
      
      if (gainNode && audio instanceof HTMLAudioElement) {
        // Apply the volume change immediately
        const safeVolume = volume === 0 ? 0 : Math.max(volume, 0.0001);
        gainNode.gain.setValueAtTime(safeVolume, audioContext.currentTime);
        audio.volume = safeVolume;
        console.log(`Stem ${stemId} volume set to ${safeVolume}`);
      }
    }
    
    set({ stems: updatedStems });
  },
  
  processYoutubeUrl: async (url) => {
    const store = get();
    
    // Reset state and clear any previous audio
    const previousAudio = get().masterAudio;
    if (previousAudio) {
      previousAudio.pause();
      previousAudio.src = '';
    }
    
    // Clean up previous audio context if it exists
    if ((window as any).audioContext) {
      try {
        await (window as any).audioContext.close();
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
      (window as any).audioContext = null;
      (window as any).gainNodes = null;
      (window as any).audioElements = null;
      (window as any).mediaElementSources = null;
    }
    
    set({ 
      ytUrl: url,
      isProcessing: true,
      loadingProgress: 0,
      error: null,
      currentTime: 0,
      isPlaying: false,
      stems: [],
      masterAudio: null
    });
    
    try {
      // Extract video ID from URL for caching
      const videoIdFromUrl = extractYoutubeVideoId(url);
      
      // First check cache to avoid network requests
      const cachedStems = localStorage.getItem(`stems-${videoIdFromUrl}`);
      if (cachedStems) {
        try {
          const cachedData = JSON.parse(cachedStems);
          console.log('Using cached stems data:', cachedData);
          
          // Validate cached data
          if (cachedData && cachedData.videoId && cachedData.stems && 
              cachedData.stems.vocals && cachedData.stems.drums && 
              cachedData.stems.bass && cachedData.stems.other) {
                
            // Create initial stem objects from cache
            const initialStems: Stem[] = [
              { id: 'vocals', name: 'Vocals', color: '#ef4444', active: true, volume: 0.8, loaded: false, url: cachedData.stems.vocals },
              { id: 'drums', name: 'Drums', color: '#22c55e', active: true, volume: 0.8, loaded: false, url: cachedData.stems.drums },
              { id: 'bass', name: 'Bass', color: '#3b82f6', active: true, volume: 0.8, loaded: false, url: cachedData.stems.bass },
              { id: 'other', name: 'Other', color: '#6366f1', active: true, volume: 0.8, loaded: false, url: cachedData.stems.other },
            ];
            
            // Update store with data from cache
            set({ 
              videoId: cachedData.videoId,
              songTitle: cachedData.title || 'Unknown Song',
              loadingProgress: 95,
              stems: initialStems
            });
            
            // Setup audio processing
            await setupWebAudioForStems(cachedData.stems.vocals, initialStems);
            
            // Mark processing as done
            setTimeout(() => {
              set({ 
                isProcessing: false,
                loadingProgress: 100
              });
            }, 500);
            
            return;
          }
        } catch (err) {
          console.error('Error using cached stems:', err);
          // Continue with normal processing if cache fails
        }
      }
      
      // Simulate progress for UI feedback
      const progressInterval = setInterval(() => {
        set(state => ({ 
          loadingProgress: Math.min(state.loadingProgress + 3, 90) 
        }));
      }, 500);
      
      // Call our API endpoint with retry logic
      console.log(`Sending YouTube URL to API: ${url}`);
      
      let response;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          // Create an AbortController with a much longer timeout
          let timeoutId: NodeJS.Timeout | null = null;
          const controller = new AbortController();
          
          try {
            console.log(`Attempt ${retries + 1}/${maxRetries} to fetch YouTube data`);
            
            // Set the timeout but store the ID so we can clear it in all cases
            timeoutId = setTimeout(() => {
              console.log('Fetch timeout reached, aborting request');
              controller.abort('Timeout exceeded');
            }, 300000); // 5 minute timeout - increased for larger videos
            
            // Use the API endpoint with cache busting to avoid stale responses
            const cacheBuster = Date.now();
            const apiUrl = `/api/youtube?url=${encodeURIComponent(url)}&t=${cacheBuster}`;
            console.log(`Fetching from API: ${apiUrl}`);
            
            response = await fetch(apiUrl, {
              // Add cache headers
              headers: {
                'Cache-Control': 'no-cache', // Force fresh response
                'Pragma': 'no-cache'
              },
              // Use the abort controller for timeout
              signal: controller.signal,
            });
          } finally {
            // Always clear the timeout to prevent memory leaks
            if (timeoutId) clearTimeout(timeoutId);
          }
          
          if (response.ok) {
            console.log('YouTube API response successful');
            break;
          }
          
          console.error(`API request failed with status: ${response.status}`);
          const errorText = await response.text();
          console.error(`Error response: ${errorText}`);
          
          retries++;
          
          if (retries < maxRetries) {
            const waitTime = 2000 * retries; // Longer wait between retries
            console.log(`Retry ${retries}/${maxRetries} for YouTube processing in ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } catch (err) {
          // Clear any pending timeouts to be safe
          
          // Check if this is an abort error (which would happen when our own timeout triggers)
          if (err instanceof DOMException && err.name === 'AbortError') {
            console.warn('Request was aborted (likely due to timeout)');
          } else {
            console.error('Network error during fetch:', err);
          }
          
          retries++;
          
          if (retries < maxRetries) {
            const waitTime = 2000 * retries;
            console.log(`Retry ${retries}/${maxRetries} after error in ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // Maximum retries reached
            throw new Error(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }
      
      if (!response || !response.ok) {
        // Try to extract more detailed error information
        let errorDetails = '';
        
        if (response) {
          try {
            const errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            errorDetails = errorJson.error || '';
          } catch (e) {
            // Failed to parse the error, use status text
            errorDetails = response.statusText || 'Unknown error';
          }
        }
        
        throw new Error(`Failed to process YouTube URL after ${maxRetries} attempts. ${errorDetails}`);
      }
      
      const data = await response.json();
      clearInterval(progressInterval);
      
      console.log('API response:', data);
      
      // Extract data from response
      const { videoId, title, stems: stemUrls, usedFallback } = data;
      
      // Check that all stem URLs exist
      if (!stemUrls || !stemUrls.vocals || !stemUrls.drums || !stemUrls.bass || !stemUrls.other) {
        throw new Error('Incomplete stem data received from server. Please try again with a different video.');
      }
      
      // Cache the stems data
      try {
        localStorage.setItem(`stems-${videoIdFromUrl}`, JSON.stringify({
          videoId,
          title,
          stems: stemUrls
        }));
      } catch (err) {
        console.error('Error caching stems data:', err);
      }
      
      // Create initial stem objects with proper colors
      const initialStems: Stem[] = [
        { id: 'vocals', name: 'Vocals', color: '#ef4444', active: true, volume: 0.8, loaded: false, url: stemUrls.vocals },
        { id: 'drums', name: 'Drums', color: '#22c55e', active: true, volume: 0.8, loaded: false, url: stemUrls.drums },
        { id: 'bass', name: 'Bass', color: '#3b82f6', active: true, volume: 0.8, loaded: false, url: stemUrls.bass },
        { id: 'other', name: 'Other', color: '#6366f1', active: true, volume: 0.8, loaded: false, url: stemUrls.other },
      ];
      
      // Update store with videoId, title, and initial stems
      set({ 
        videoId,
        songTitle: title || 'Unknown Song',
        loadingProgress: 95, // Almost done
        stems: initialStems
      });
      
      // Check if fallback was used and show warning
      if (usedFallback === 'true') {
        console.warn('Using fallback mode: Demucs stem separation failed, using original audio for all stems');
        set({
          error: 'Stem separation failed. Using original audio for all stems. Volume controls may not work as expected.'
        });
      }
      
      // Set up Web Audio API for stem control
      await setupWebAudioForStems(stemUrls.vocals, initialStems);
      
      // Mark processing as done
      setTimeout(() => {
        set({ 
          isProcessing: false,
          loadingProgress: 100
        });
      }, 500);
      
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false
      });
    }
  }
}));

// Setup Web Audio API for stem control
async function setupWebAudioForStems(masterUrl: string, stems: Stem[]) {
  try {
    // Create audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Store the audio context globally so we can access it later
    (window as any).audioContext = audioContext;
    
    // Create separate audio elements and gain nodes for each stem
    const gainNodes: Record<string, GainNode> = {};
    const audioElements: Record<string, HTMLAudioElement> = {};
    const mediaElementSources: Record<string, MediaElementAudioSourceNode> = {};
    const filters: Record<string, BiquadFilterNode | null> = {};
    
    // Create a master audio element for global play/pause control
    const masterAudio = new Audio();
    masterAudio.crossOrigin = "anonymous";
    
    // Setup handler for user interaction
    const setupAudioContextResume = () => {
      // Resume audio context if it's suspended (modern browsers require user interaction)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
          console.error('Failed to resume audio context:', err);
        });
      }
      
      // Remove the event listeners after first interaction
      document.removeEventListener('click', setupAudioContextResume);
      document.removeEventListener('touchstart', setupAudioContextResume);
    };
    
    // Add event listeners for user interaction
    document.addEventListener('click', setupAudioContextResume);
    document.addEventListener('touchstart', setupAudioContextResume);
    
    // Check for potential fallback mode (all stems have the same file size)
    let potentialFallbackMode = false;
    
    try {
      // This will try to detect if we're using the fallback mechanism
      const uniqueUrls = new Set(stems.map(stem => stem.url));
      potentialFallbackMode = uniqueUrls.size < stems.length;
      
      console.log(`Potential fallback mode detected: ${potentialFallbackMode}`);
    } catch (e) {
      console.error('Error checking for fallback mode:', e);
    }
    
    // Load each stem with its own audio element and source
    const audioLoadPromises = stems.map(async (stem) => {
      try {
        // Create audio element for this stem
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto"; // Ensure audio is preloaded
        
        // Store the element before connecting to avoid duplicate connections
        audioElements[stem.id] = audio;
        
        // Add error handling
        audio.addEventListener('error', (e) => {
          console.error(`Error with ${stem.id} audio:`, e);
        });
        
        // Set the src last (after all event listeners are attached)
        audio.src = stem.url;
        
        // Create a media element source for this stem
        try {
          const source = audioContext.createMediaElementSource(audio);
          mediaElementSources[stem.id] = source;
          
          // Create a gain node for this stem with immediate mute if needed
          const gainNode = audioContext.createGain();
          
          // Critical: Set initial gain correctly - if stem is not active, should be 0
          // Use immediate value setting for initialization to avoid any initial audio bleed
          const initialGain = stem.active ? Math.max(stem.volume, 0.0001) : 0;
          
          // Always use setValueAtTime for initialization, never ramps
          gainNode.gain.setValueAtTime(initialGain, audioContext.currentTime);
          
          console.log(`Initialized gain node for ${stem.id} with value ${initialGain}, active: ${stem.active}`);

          // Store gain node
          gainNodes[stem.id] = gainNode;
          
          // Also set audio element volume directly as a fallback
          audio.volume = initialGain;
          
          // Special handling for fallback mode with more aggressive filters
          if (potentialFallbackMode) {
            console.log(`Applying enhanced fallback handling for stem: ${stem.id}`);
            
            let filter: BiquadFilterNode | null = null;
            
            // In fallback mode, we need intensive filtering and complete disconnection
            // of inactive stems to achieve proper isolation
            switch(stem.id) {
              case 'vocals':
                // For vocals, apply a bandpass filter focused on human voice range
                filter = audioContext.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1000; // Voice frequency range center
                filter.Q.value = 1.5; // Narrower Q for better isolation
                
                // Add a second filter in series for better isolation
                const vocalFilter2 = audioContext.createBiquadFilter();
                vocalFilter2.type = 'peaking';
                vocalFilter2.frequency.value = 3000; // Upper voice harmonics
                vocalFilter2.gain.value = 6; // Boost
                
                // Connect in series: source -> filter -> filter2 -> gain -> destination
                source.connect(filter);
                filter.connect(vocalFilter2);
                vocalFilter2.connect(gainNode);
                break;
                
              case 'drums':
                // For drums, create a more complex drum-focused filter
                filter = audioContext.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 200; // Low drum emphasis
                filter.Q.value = 0.8;
                
                // Add a second filter for high drum frequencies
                const drumFilter2 = audioContext.createBiquadFilter();
                drumFilter2.type = 'highshelf';
                drumFilter2.frequency.value = 4000;
                drumFilter2.gain.value = 6;
                
                // Connect in series
                source.connect(filter);
                filter.connect(drumFilter2);
                drumFilter2.connect(gainNode);
                break;
                
              case 'bass':
                // For bass, apply much stronger lowpass filter
                filter = audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 250;
                filter.Q.value = 1.2;
                
                // Add bass boost
                const bassBoost = audioContext.createBiquadFilter();
                bassBoost.type = 'peaking';
                bassBoost.frequency.value = 80;
                bassBoost.gain.value = 8;
                
                // Connect in series
                source.connect(filter);
                filter.connect(bassBoost);
                bassBoost.connect(gainNode);
                break;
                
              case 'other':
                // For other, apply a bandpass focusing on mid-range frequencies
                filter = audioContext.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 2000;
                filter.Q.value = 0.5;
                
                // Connect: source -> filter -> gain
                source.connect(filter);
                filter.connect(gainNode);
                break;
            }
            
            // Store filter for future reference
            filters[stem.id] = filter;
            
            // Only connect gain node to destination if stem is active
            if (stem.active) {
              gainNode.connect(audioContext.destination);
            }
          } else {
            // Standard mode: just connect source -> gain -> destination
            source.connect(gainNode);
            
            // Only connect gain node to destination if stem is active
            if (stem.active) {
              gainNode.connect(audioContext.destination);
            }
          }
          
        } catch (sourceErr) {
          console.error(`Error creating media source for ${stem.id}:`, sourceErr);
        }
        
        // Wait for audio to be ready
        return new Promise<void>((resolve) => {
          // Add timeout to prevent infinite waiting
          const timeout = setTimeout(() => {
            console.warn(`Loading timeout for stem ${stem.id}, marking as loaded anyway`);
            resolve();
          }, 10000); // 10 seconds timeout
          
          audio.addEventListener('canplaythrough', () => {
            clearTimeout(timeout);
            console.log(`Stem audio "${stem.id}" loaded and ready to play`);
            resolve();
          }, { once: true });
          
          // Also resolve if there's an error, but log it
          audio.addEventListener('error', (e) => {
            clearTimeout(timeout);
            console.error(`Error loading stem audio "${stem.id}":`, e);
            resolve();
          }, { once: true });
          
          // Start loading
          audio.load();
        });
      } catch (err) {
        console.error(`Failed to setup audio for stem ${stem.id}:`, err);
        // Still resolve so one bad stem doesn't block everything
        return Promise.resolve();
      }
    });
    
    // Store nodes globally
    (window as any).gainNodes = gainNodes;
    (window as any).audioElements = audioElements;
    (window as any).mediaElementSources = mediaElementSources;
    (window as any).filters = filters;
    (window as any).fallbackMode = potentialFallbackMode;
    
    // Mark all stems as loaded
    const updatedStems = stems.map(stem => ({
      ...stem,
      loaded: true
    }));
    
    // Store in zustand state
    useAudioStore.setState({
      masterAudio,
      stems: updatedStems
    });
    
    try {
      // Wait for all audio elements to load with a timeout
      const timeoutPromise = new Promise<void>(resolve => {
        setTimeout(() => {
          console.warn('Some stems took too long to load, continuing anyway');
          resolve();
        }, 15000); // 15 seconds timeout for all stems
      });
      
      await Promise.race([
        Promise.all(audioLoadPromises),
        timeoutPromise
      ]);
      
      console.log('All stem audio loaded and ready to play');
    } catch (err) {
      console.error('Error waiting for audio to load:', err);
      // Continue anyway - we've marked the stems as loaded
    }
    
  } catch (error) {
    console.error('Error setting up Web Audio:', error);
    useAudioStore.setState({ 
      error: 'Failed to set up audio playback. Please try again.'
    });
  }
} 