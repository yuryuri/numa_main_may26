import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// The directory where stems are stored
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'numa-downloads');

export async function GET(
  request: NextRequest,
  context: { params: { videoId: string; stem: string } }
) {
  try {
    // In Next.js 15.3+, we need to await params
    const { videoId, stem } = await context.params;
    
    // Validate stem name
    const validStems = ['vocals', 'drums', 'bass', 'other', 'master'];
    if (!validStems.includes(stem)) {
      return NextResponse.json(
        { error: 'Invalid stem type' },
        { status: 400 }
      );
    }
    
    // Get the video directory
    const videoDir = path.join(DOWNLOAD_DIR, videoId);
    if (!fs.existsSync(videoDir)) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    let stemPath;
    
    // If requesting the master audio, return the original WAV file
    if (stem === 'master') {
      // Find the WAV file in the video directory
      const files = fs.readdirSync(videoDir);
      const wavFile = files.find(file => file.endsWith('.wav'));
      
      if (!wavFile) {
        return NextResponse.json(
          { error: 'Master audio not found' },
          { status: 404 }
        );
      }
      
      stemPath = path.join(videoDir, wavFile);
    } else {
      // Find the stem file in the demucs output directory
      const stemsDir = path.join(videoDir, 'stems');
      
      // Try finding in the expected demucs output structure
      // The structure is: videoDir/stems/htdemucs/songname/stem.wav
      const modelDirs = fs.existsSync(stemsDir) ? 
        fs.readdirSync(stemsDir).filter(dir => 
          fs.existsSync(path.join(stemsDir, dir)) &&
          fs.statSync(path.join(stemsDir, dir)).isDirectory()
        ) : [];
      
      if (modelDirs.length > 0) {
        const modelDir = path.join(stemsDir, modelDirs[0]);
        const songDirs = fs.readdirSync(modelDir).filter(dir =>
          fs.existsSync(path.join(modelDir, dir)) &&
          fs.statSync(path.join(modelDir, dir)).isDirectory()
        );
        
        if (songDirs.length > 0) {
          const songDir = path.join(modelDir, songDirs[0]);
          stemPath = path.join(songDir, `${stem}.wav`);
        }
      }
      
      // If stem file doesn't exist in the expected location, look for it directly in stems dir
      if (!stemPath || !fs.existsSync(stemPath)) {
        const directStemPath = path.join(stemsDir, `${stem}.wav`);
        if (fs.existsSync(directStemPath)) {
          stemPath = directStemPath;
        } else {
          return NextResponse.json(
            { error: `Stem ${stem} not found` },
            { status: 404 }
          );
        }
      }
    }
    
    // Check if the file exists
    if (!fs.existsSync(stemPath)) {
      return NextResponse.json(
        { error: `Stem ${stem} not found` },
        { status: 404 }
      );
    }
    
    // Read the file
    const fileBuffer = fs.readFileSync(stemPath);
    
    // Return the WAV file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `inline; filename="${stem}.wav"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      }
    });
  } catch (error) {
    console.error(`Error serving stem:`, error);
    return NextResponse.json(
      { error: 'Failed to serve stem' },
      { status: 500 }
    );
  }
} 