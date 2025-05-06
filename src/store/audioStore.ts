import { create } from 'zustand';

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
  
  playAllStems: () => {
    const { stems, isPlaying } = get();
    
    if (!isPlaying) {
      // Get audio elements for each stem
      const audioElements = (window as any).audioElements;
      
      if (!audioElements) return;
      
      // Play each active stem
      stems.forEach(stem => {
        if (stem.active && stem.loaded) {
          const audio = audioElements[stem.id];
          if (audio) {
            // Ensure all audio elements start at the same time
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise) {
              playPromise.catch((error: Error) => {
                console.error(`Playback error for stem ${stem.id}:`, error);
              });
            }
          }
        }
      });
      
      set({ isPlaying: true });
    }
  },
  
  pauseAllStems: () => {
    const { isPlaying } = get();
    
    if (isPlaying) {
      // Get audio elements for each stem
      const audioElements = (window as any).audioElements;
      
      if (!audioElements) return;
      
      // Pause all audio elements
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
    const audioElements = (window as any).audioElements;
    
    if (!gainNodes) return;
    
    // Update active state in our store
    const updatedStems = stems.map(stem => 
      stem.id === stemId 
        ? { ...stem, active: !stem.active } 
        : stem
    );
    
    // Apply mute or unmute to the gain node
    const stem = updatedStems.find(s => s.id === stemId);
    if (stem) {
      const gainNode = gainNodes[stem.id];
      const audio = audioElements?.[stem.id];
      
      if (gainNode) {
        // Access audio context time for precise scheduling
        const ctx = (window as any).audioContext;
        const now = ctx?.currentTime || 0;
        
        if (stem.active) {
          // Activate: Smoothly ramp up gain from 0 to the desired volume
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(stem.volume, now + 0.05);
        } else {
          // Deactivate: Immediately set gain to 0 for this stem
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
        }
        
        // If we're using individual audio elements and playing, manage playback
        if (audio && get().isPlaying && stem.loaded) {
          if (stem.active) {
            // Start playing this stem if it was just activated
            audio.play().catch((error: Error) => {
              console.error(`Playback error for stem ${stem.id}:`, error);
            });
          } else {
            // Keep playing but with volume at 0
            // audio.pause();
          }
        }
      }
    }
    
    set({ stems: updatedStems });
  },
  
  adjustStemVolume: (stemId, volume) => {
    const { stems } = get();
    
    // Find the gain nodes
    const gainNodes = (window as any).gainNodes;
    
    if (!gainNodes) return;
    
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
      if (gainNode) {
        // Access audio context time for precise scheduling
        const ctx = (window as any).audioContext;
        const now = ctx?.currentTime || 0;
        
        // Only apply volume if stem is active, otherwise keep it at 0
        if (stem.active) {
          // Smooth volume change with exponential ramp
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
        }
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
      // Simulate progress for UI feedback
      const progressInterval = setInterval(() => {
        set(state => ({ 
          loadingProgress: Math.min(state.loadingProgress + 3, 90) // Keep under 90% until we get real data
        }));
      }, 500);
      
      // Call our API endpoint that handles YouTube download and stem separation
      console.log(`Sending YouTube URL to API: ${url}`);
      const response = await fetch(`/api/youtube?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      clearInterval(progressInterval);
      
      // Check for API errors
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process YouTube URL');
      }
      
      console.log('API response:', data);
      
      // Extract data from response
      const { videoId, title, stems: stemUrls } = data;
      
      // Create initial stem objects
      const initialStems: Stem[] = [
        { id: 'vocals', name: 'Vocals', color: '#6366f1', active: true, volume: 0.8, loaded: false, url: stemUrls.vocals },
        { id: 'drums', name: 'Drums', color: '#ec4899', active: true, volume: 0.8, loaded: false, url: stemUrls.drums },
        { id: 'bass', name: 'Bass', color: '#f59e0b', active: true, volume: 0.8, loaded: false, url: stemUrls.bass },
        { id: 'other', name: 'Other', color: '#10b981', active: true, volume: 0.8, loaded: false, url: stemUrls.other },
      ];
      
      // Update store with videoId, title, and initial stems
      set({ 
        videoId,
        songTitle: title,
        loadingProgress: 95, // Almost done
        stems: initialStems
      });
      
      // For simplicity, we'll use a single audio element as the master source
      // and use the Web Audio API for stem isolation and volume control
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
    
    // Create a master audio element for global play/pause control
    const masterAudio = new Audio();
    masterAudio.crossOrigin = "anonymous";
    
    // Load each stem with its own audio element and source
    const audioLoadPromises = stems.map(async (stem) => {
      // Create audio element for this stem
      const audio = new Audio(stem.url);
      audio.loop = true;
      audio.crossOrigin = "anonymous";
      audioElements[stem.id] = audio;
      
      // Create a media element source for this stem
      const source = audioContext.createMediaElementSource(audio);
      
      // Create a gain node for this stem with immediate mute if needed
      const gainNode = audioContext.createGain();
      
      // Critical: Set initial gain correctly - if stem is not active, should be 0
      gainNode.gain.value = stem.active ? stem.volume : 0;

      // Use exponential ramping for smoother volume changes
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
      
      // Connect the source to the gain node, and the gain node to the destination
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Store gain node
      gainNodes[stem.id] = gainNode;
      
      // Wait for audio to be ready
      return new Promise<void>((resolve) => {
        audio.addEventListener('canplaythrough', () => {
          console.log(`Stem audio "${stem.id}" loaded and ready to play`);
          resolve();
        }, { once: true });
        
        // Also resolve if there's an error, but log it
        audio.addEventListener('error', (e) => {
          console.error(`Error loading stem audio "${stem.id}":`, e);
          resolve();
        }, { once: true });
        
        // Start loading
        audio.load();
      });
    });
    
    // Store gain nodes globally
    (window as any).gainNodes = gainNodes;
    (window as any).audioElements = audioElements;
    
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
    
    // Wait for all audio elements to load
    await Promise.all(audioLoadPromises);
    console.log('All stem audio loaded and ready to play');
    
  } catch (error) {
    console.error('Error setting up Web Audio:', error);
    useAudioStore.setState({ 
      error: 'Failed to set up audio playback. Please try again.'
    });
  }
} 