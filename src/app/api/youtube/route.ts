import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';

// Use promisified exec for cleaner async code
const execPromise = util.promisify(exec);

// Define the temporary directory for downloads
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'numa-downloads');

// Make sure the download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Add cache to prevent re-processing the same URL
const processedVideos = new Map<string, any>();

export async function GET(request: NextRequest) {
  // Get YouTube URL from query params
  const searchParams = request.nextUrl.searchParams;
  const youtubeUrl = searchParams.get('url');
  
  if (!youtubeUrl) {
    return NextResponse.json(
      { error: 'No YouTube URL provided' },
      { status: 400 }
    );
  }
  
  try {
    console.log('Processing YouTube URL:', youtubeUrl);
    
    // Extract video ID from the URL
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }
    
    // Check if we already processed this video
    if (processedVideos.has(videoId)) {
      console.log(`Using cached result for video ID: ${videoId}`);
      return NextResponse.json(processedVideos.get(videoId));
    }
    
    // Create a directory for this video
    const videoDir = path.join(DOWNLOAD_DIR, videoId);
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }
    
    // Check if stems already exist for this video
    const stemDir = path.join(videoDir, 'stems', 'htdemucs');
    if (fs.existsSync(stemDir)) {
      const folders = fs.readdirSync(stemDir);
      if (folders.length > 0) {
        const trackFolder = path.join(stemDir, folders[0]);
        const stemFiles = ['vocals.wav', 'drums.wav', 'bass.wav', 'other.wav'];
        
        if (stemFiles.every(file => fs.existsSync(path.join(trackFolder, file)))) {
          console.log(`Found existing stems for video ${videoId}, using them`);
          
          const result = {
            videoId,
            title: folders[0],
            masterAudio: `/api/stems/${videoId}/master`,
            stems: {
              vocals: `/api/stems/${videoId}/vocals`,
              drums: `/api/stems/${videoId}/drums`,
              bass: `/api/stems/${videoId}/bass`,
              other: `/api/stems/${videoId}/other`,
              usedFallback: 'false'
            }
          };
          
          // Store in cache
          processedVideos.set(videoId, result);
          
          return NextResponse.json(result);
        }
      }
    }
    
    // Download the audio from YouTube with timeout
    const wavFilePath = await Promise.race([
      downloadYouTubeAudio(youtubeUrl, videoDir),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('YouTube download timed out after 180 seconds')), 180000);
      }) as Promise<string>
    ]);
    
    // Separate the stems using Demucs with timeout
    console.log('Separating audio stems...');
    
    const stemPaths = await Promise.race([
      separateStems(wavFilePath, videoId),
      new Promise<Record<string, string>>((_, reject) => {
        setTimeout(() => reject(new Error('Stem separation timed out after 180 seconds')), 180000);
      }) as Promise<Record<string, string>>
    ]);
    
    const result = {
      videoId,
      title: path.basename(wavFilePath, path.extname(wavFilePath)),
      masterAudio: `/api/stems/${videoId}/master`,
      stems: stemPaths
    };
    
    // Store in cache
    processedVideos.set(videoId, result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing YouTube URL:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: `Failed to process YouTube URL: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  // Regular expression to extract YouTube video ID
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  
  return match ? match[1] : null;
}

// Download YouTube audio in WAV format
async function downloadYouTubeAudio(youtubeUrl: string, outputDir: string): Promise<string> {
  console.log('Starting YouTube download...');
  
  // Use yt-dlp to download audio only and convert to WAV with improved networking options
  const ytDlCommand = `yt-dlp -x --audio-format wav --audio-quality 0 --retries 5 --fragment-retries 5 --force-ipv4 --extract-audio --no-check-certificate -o "%(title)s.%(ext)s" "${youtubeUrl}"`;
  console.log(`Executing: ${ytDlCommand}`);
  
  try {
    const { stdout, stderr } = await execPromise(ytDlCommand, { cwd: outputDir });
    console.log('Download output:', stdout);
    if (stderr) console.log('Download errors:', stderr);
    
    // Find the downloaded WAV file (the newest one)
    const files = fs.readdirSync(outputDir);
    const wavFiles = files.filter(file => file.endsWith('.wav'));
    
    if (wavFiles.length === 0) {
      throw new Error('No WAV file was downloaded');
    }
    
    const wavFile = wavFiles[0];
    const wavFilePath = path.join(outputDir, wavFile);
    console.log('Downloaded WAV file:', wavFilePath);
    
    return wavFilePath;
  } catch (error) {
    console.error('Error downloading YouTube audio:', error);
    throw error;
  }
}

// Separate stems using Demucs and fallback to copying if it fails
async function separateStems(wavFilePath: string, videoId: string): Promise<Record<string, string>> {
  // Path to store separated stems
  const stemDir = path.join(DOWNLOAD_DIR, videoId, 'stems');
  
  if (!fs.existsSync(stemDir)) {
    fs.mkdirSync(stemDir, { recursive: true });
  }
  
  // Create stem directory structure even if Demucs fails
  const finalStemDir = path.join(stemDir, 'htdemucs', path.basename(wavFilePath, '.wav'));
  if (!fs.existsSync(finalStemDir)) {
    fs.mkdirSync(finalStemDir, { recursive: true });
  }
  
  // Define all stem paths we'll create
  const stemFiles = {
    vocals: path.join(finalStemDir, 'vocals.wav'),
    drums: path.join(finalStemDir, 'drums.wav'), 
    bass: path.join(finalStemDir, 'bass.wav'),
    other: path.join(finalStemDir, 'other.wav')
  };
  
  let usedFallback = false;
  
  try {
    // Use the correct path to demucs that we just verified
    const demucsPath = '/Volumes/T7/Dev/numa-main/numa-env/bin/demucs';
    
    // Check if demucs exists
    if (!fs.existsSync(demucsPath)) {
      console.error(`Demucs not found at path: ${demucsPath}`);
      throw new Error('Demucs executable not found');
    }
    
    console.log("Using demucs at path:", demucsPath);
    
    // Set environment variables to force sox backend
    const env = {
      ...process.env,
      TORCHAUDIO_USE_SOX: "1",
      TORCHAUDIO_DEBUG: "1" // Enable debug logging
    };
    
    // Use correct Demucs command format (without --backend flag)
    const demucsCmd = `${demucsPath} "${wavFilePath}" -o "${stemDir}"`;
    console.log(`Executing command: ${demucsCmd}`);
    
    const { stdout, stderr } = await execPromise(demucsCmd, { env });
    console.log('Demucs output:', stdout);
    if (stderr) console.log('Demucs stderr:', stderr);
    
    // Check if all stems were created
    const stemsExist = Object.values(stemFiles).every(file => fs.existsSync(file));
    if (!stemsExist) {
      throw new Error('Not all stems were created by Demucs');
    }
    
    console.log('✅ Demucs separation succeeded!');
  } catch (error) {
    console.error('Error separating stems with Demucs:', error);
    
    // Enable fallback: Copy the original file to all stem files if Demucs fails
    console.log('Falling back to using original audio for all stems');
    usedFallback = true;
    
    // Create each stem file by copying the original audio
    for (const stemFile of Object.values(stemFiles)) {
      // Create a copy of the original file for each stem to ensure separate playback
      if (!fs.existsSync(stemFile)) {
        try {
          fs.copyFileSync(wavFilePath, stemFile);
          console.log(`Created fallback stem file: ${stemFile}`);
        } catch (copyError) {
          console.error(`Error creating stem fallback file ${stemFile}:`, copyError);
        }
      }
    }
  }
  
  // Return the API routes for each stem and indicate if fallback was used
  return {
    vocals: `/api/stems/${videoId}/vocals`,
    drums: `/api/stems/${videoId}/drums`,
    bass: `/api/stems/${videoId}/bass`,
    other: `/api/stems/${videoId}/other`,
    usedFallback: usedFallback ? 'true' : 'false'
  };
} 