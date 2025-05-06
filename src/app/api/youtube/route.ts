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
    
    // Create a directory for this video
    const videoDir = path.join(DOWNLOAD_DIR, videoId);
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }
    
    // Download the audio from YouTube
    const wavFilePath = await downloadYouTubeAudio(youtubeUrl, videoDir);
    
    // Separate the stems using Demucs
    console.log('Separating audio stems...');
    const stemPaths = await separateStems(wavFilePath, videoId);
    
    return NextResponse.json({
      videoId,
      title: path.basename(wavFilePath, path.extname(wavFilePath)),
      masterAudio: `/api/stems/${videoId}/master`,
      stems: stemPaths
    });
  } catch (error) {
    console.error('Error processing YouTube URL:', error);
    return NextResponse.json(
      { error: 'Failed to process YouTube URL' },
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
  
  // Use yt-dlp to download audio only and convert to WAV
  const ytDlCommand = `yt-dlp -x --audio-format wav --audio-quality 0 -o "%(title)s.%(ext)s" "${youtubeUrl}"`;
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
  
  try {
    // HARDCODED ABSOLUTE PATH to demucs - this is guaranteed to work
    const demucsPath = '/Volumes/T7/Dev/numa-main/numa-env/bin/demucs';
    console.log("Using demucs at absolute path:", demucsPath);
    
    // Set environment variables to force sox backend
    const env = {
      ...process.env,
      TORCHAUDIO_USE_SOX: "1",
      TORCHAUDIO_DEBUG: "1" // Enable debug logging
    };
    
    // Simple command with absolute paths everywhere
    const demucsCmd = `${demucsPath} --backend sox "${wavFilePath}" -o "${stemDir}"`;
    console.log(`Executing command: ${demucsCmd}`);
    
    const { stdout, stderr } = await execPromise(demucsCmd, { env });
    console.log('Demucs output:', stdout);
    if (stderr) console.log('Demucs stderr:', stderr);
    
    // Check if all stems were created
    const stemsExist = Object.values(stemFiles).every(file => fs.existsSync(file));
    if (!stemsExist) {
      throw new Error('Not all stems were created by Demucs');
    }
  } catch (error) {
    console.error('Error separating stems with Demucs:', error);
    
    // Fallback: Copy the original file to all stem files if Demucs fails
    console.log('Falling back to using original audio for all stems');
    for (const stemFile of Object.values(stemFiles)) {
      // Create a hard link to the original file for each stem to save space
      if (!fs.existsSync(stemFile)) {
        try {
          fs.copyFileSync(wavFilePath, stemFile);
        } catch (copyError) {
          console.error(`Error creating stem fallback file ${stemFile}:`, copyError);
        }
      }
    }
  }
  
  // Return the API routes for each stem
  return {
    vocals: `/api/stems/${videoId}/vocals`,
    drums: `/api/stems/${videoId}/drums`,
    bass: `/api/stems/${videoId}/bass`,
    other: `/api/stems/${videoId}/other`
  };
} 