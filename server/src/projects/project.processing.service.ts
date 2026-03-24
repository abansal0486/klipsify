import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { promisify } from 'util';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import axios from 'axios';
import { createCanvas, registerFont } from 'canvas';
import { Storage } from '@google-cloud/storage'; 

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const unlinkAsync = promisify(fs.unlink);

export interface LogoOverlayOptions {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  scale?: number;
  padding?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface VideoOverlayOptions {
  slogan?: string;
  logoPath?: string;
  videoRatio?: string;
  brandName?: string;
}

@Injectable()
export class ProjectProcessingService {
  private readonly logger = new Logger(ProjectProcessingService.name);
  private readonly tempDir = path.join(os.tmpdir(), 'video-processing');
  private fontPath: string;
  private readonly storage: Storage;

  constructor() {
    this.ensureTempDirSync();  // ✅ FIX #1: Sync version
    this.initializeFont();
     this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  // ✅ FIX #1: Synchronous temp directory creation
  private ensureTempDirSync(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        this.logger.log(`📁 Created temp directory: ${this.tempDir}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to create temp directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✅ Initialize font on service startup
   */
  private initializeFont(): void {
    try {
      this.fontPath = this.getFont();
      this.logger.log(`✅ Font initialized: ${path.basename(this.fontPath)}`);
      this.logger.log(`   📍 Font path: ${this.fontPath}`);
    } catch (error) {
      this.logger.error(`❌ Font initialization failed: ${error.message}`);
      this.logger.warn('⚠️ Text rendering may use fallback fonts');
    }
  }

  /**
   * ✅ Get font that supports BOTH English and Hebrew
   */
  private getFont(): string {
    const fontPaths = [
      // Development
      path.join(process.cwd(), 'src', 'assets', 'fonts', 'NotoSansHebrew-Regular.ttf'),
      path.join(process.cwd(), 'src', 'assets', 'fonts', 'Rubik-Regular.ttf'),

      // Production build
      path.join(process.cwd(), 'dist', 'assets', 'fonts', 'NotoSansHebrew-Regular.ttf'),
      path.join(process.cwd(), 'dist', 'assets', 'fonts', 'Rubik-Regular.ttf'),

      // Relative to compiled file
      path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansHebrew-Regular.ttf'),
    ];

    this.logger.debug('🔍 Searching for font files...');

    for (const fontPath of fontPaths) {
      this.logger.debug(`   Checking: ${fontPath}`);
      if (fs.existsSync(fontPath)) {
        this.logger.log(`✅ Found font: ${fontPath}`);
        return fontPath;
      }
    }

    // Fallback to Windows system font
    if (os.platform() === 'win32') {
      const windowsFonts = [
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/arialuni.ttf',
        'C:/Windows/Fonts/segoeui.ttf',
      ];

      for (const fontPath of windowsFonts) {
        if (fs.existsSync(fontPath)) {
          this.logger.log(`✅ Found Windows font: ${path.basename(fontPath)}`);
          return fontPath;
        }
      }
    }

    throw new Error(
      'Font not found! Please ensure NotoSansHebrew-Regular.ttf exists in src/assets/fonts/'
    );
  }

  /**
   * ✅ Render text as PNG image using Canvas (works for ALL languages)
   */
  private async renderTextAsImage(
    text: string,
    fontSize: number,
    videoRatio: string
  ): Promise<string> {
    try {
      this.logger.log(`🎨 Rendering text as image: "${text}"`);

      // ✅ FIX #4: Register font with error handling
      let fontFamily = 'Arial, sans-serif';
      if (fs.existsSync(this.fontPath)) {
        try {
          registerFont(this.fontPath, { family: 'CustomFont' });
          fontFamily = 'CustomFont, Arial, sans-serif';
          this.logger.log(`✅ Registered font: ${path.basename(this.fontPath)}`);
        } catch (error) {
          this.logger.error(`❌ Font registration failed: ${error.message}`);
          this.logger.warn('⚠️ Using fallback font');
        }
      }

      // Canvas size based on video ratio
      let canvasWidth = 1920;
      let canvasHeight = 200;

      if (videoRatio === '9:16' || videoRatio === '3:4') {
        canvasWidth = 1080;
        canvasHeight = 150;
      } else if (videoRatio === '1:1') {
        canvasWidth = 1080;
        canvasHeight = 180;
      }

      // Create canvas
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // Background box with rounded corners
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Text styling (✅ FIX #3: Use validated font family)
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // ✅ Draw text (Canvas handles Hebrew RTL automatically!)
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      // Save as PNG
      const imagePath = path.join(this.tempDir, `text-image-${Date.now()}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(imagePath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(2);
      this.logger.log(`✅ Text rendered: ${sizeKB} KB → ${imagePath}`);

      return imagePath;

    } catch (error) {
      this.logger.error(`❌ Failed to render text as image: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✅ Add text and logo overlays to video (with ALL fixes)
   */
  async addOverlays(
    videoBuffer: Buffer,
    options: VideoOverlayOptions
  ): Promise<Buffer> {
    let { slogan, logoPath, videoRatio, brandName } = options;

    // ✅ FIX #2: Validate buffer size
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (videoBuffer.length > maxSize) {
      throw new Error(
        `Video buffer too large: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB (max: 500MB)`
      );
    }
    if (videoBuffer.length < 1000) {
      throw new Error('Invalid video buffer: too small');
    }

    // ✅ FIX #7: Validate video ratio
    const validRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
    if (videoRatio && !validRatios.includes(videoRatio)) {
      this.logger.warn(`⚠️ Invalid video ratio: ${videoRatio}, defaulting to 16:9`);
      videoRatio = '16:9';
    }

    // ✅ FIX #7: Validate slogan length
    if (slogan && slogan.length > 100) {
      this.logger.warn(`⚠️ Slogan too long (${slogan.length} chars), truncating to 100`);
      slogan = slogan.substring(0, 100) + '...';
    }

    this.logger.log(`🎨 Starting overlay processing...`);
    this.logger.log(`   • Slogan: ${slogan ? `"${slogan}"` : 'None'}`);
    this.logger.log(`   • Logo: ${logoPath ? 'Yes' : 'None'}`);
    this.logger.log(`   • Ratio: ${videoRatio || '16:9'}`);

    const inputPath = path.join(this.tempDir, `input-${Date.now()}.mp4`);
    fs.writeFileSync(inputPath, videoBuffer);
    this.logger.log(`💾 Saved input video to: ${inputPath}`);

    try {
      let processedPath = inputPath;

      // Step 1: Add text overlay (if slogan provided)
      if (slogan && slogan.trim()) {
        this.logger.log(`📝 Adding text overlay: "${slogan}"`);
        processedPath = await this.addTextOverlay(processedPath, slogan, videoRatio);
      }

      // Step 2: Add logo overlay (if logo provided)
      if (logoPath && logoPath.trim()) {
        this.logger.log(`🎨 Adding logo overlay from: ${logoPath}`);
        processedPath = await this.addLogoOverlay(processedPath, logoPath);
      }

      const finalBuffer = fs.readFileSync(processedPath);
      const sizeMB = (finalBuffer.length / 1024 / 1024).toFixed(2);
      this.logger.log(`✅ Processing complete! Final size: ${sizeMB} MB`);

      // ✅ Cleanup processed files (but not inputPath yet, done in finally)
      if (processedPath !== inputPath) {
        await this.cleanupFiles(processedPath);
      }

      return finalBuffer;

    } catch (error) {
      this.logger.error(`❌ Error adding overlays: ${error.message}`, error.stack);
      throw error;
    } finally {
      // ✅ FIX #8: Always cleanup input file
      await this.cleanupFiles(inputPath).catch(err => 
        this.logger.warn(`⚠️ Cleanup warning: ${err.message}`)
      );
    }
  }

  /**
   * ✅ Add text overlay using Canvas-rendered image (supports ALL languages)
   */
  private async addTextOverlay(
    inputPath: string,
    text: string,
    videoRatio?: string
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const outputPath = path.join(this.tempDir, `text-${Date.now()}.mp4`);

        // Adjust font size based on ratio
        let fontSize = 48;
        if (videoRatio === '9:16' || videoRatio === '3:4') {
          fontSize = 36;
        } else if (videoRatio === '1:1') {
          fontSize = 44;
        }

        // ✅ Render text as image using Canvas
        const textImagePath = await this.renderTextAsImage(text, fontSize, videoRatio || '16:9');

        this.logger.log(`🎬 Overlaying text image on video...`);

        // Overlay image on video
        ffmpeg(inputPath)
          .input(textImagePath)
          .complexFilter([
            '[1:v]format=rgba[text]',
            '[0:v][text]overlay=(W-w)/2:H-h-80:format=auto'
          ])
          .outputOptions([
            '-codec:v libx264',
            '-preset medium',
            '-crf 23',
            '-codec:a copy',
            '-movflags +faststart',
            '-pix_fmt yuv420p'
          ])
          .output(outputPath)
          .on('start', (cmd) => {
            this.logger.debug(`▶️ FFmpeg command: ${cmd.substring(0, 200)}...`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              this.logger.debug(`📊 Text overlay progress: ${progress.percent.toFixed(1)}%`);
            }
          })
          .on('end', async () => {
            this.logger.log('✅ Text overlay completed');

            // ✅ FIX #3: Proper async cleanup with await
            try {
              await this.cleanupFiles(textImagePath);
              if (inputPath.includes('text-') || inputPath.includes('input-')) {
                await this.cleanupFiles(inputPath);
              }
            } catch (cleanupError) {
              this.logger.warn(`⚠️ Cleanup warning: ${cleanupError.message}`);
            }

            resolve(outputPath);
          })
          .on('error', (err, stdout, stderr) => {
            this.logger.error(`❌ Text overlay error: ${err.message}`);
            this.logger.error(`FFmpeg stderr: ${stderr?.substring(0, 500)}`);
            this.cleanupFiles(textImagePath).catch(() => {});
            reject(err);
          })
          .run();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * ✅ Add logo overlay to video
   */
  private async addLogoOverlay(
    inputPath: string,
    logoUrl: string
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const logoPath = await this.downloadLogo(logoUrl);
        const outputPath = path.join(this.tempDir, `logo-${Date.now()}.mp4`);

        this.logger.log(`📥 Logo downloaded to: ${logoPath}`);

        ffmpeg(inputPath)
          .input(logoPath)
          .complexFilter([
            '[1:v]scale=iw*0.20:-1[scaled]',
            '[scaled]format=rgba,colorchannelmixer=aa=0.95[logo]',
            '[0:v][logo]overlay=40:40:format=auto'
          ])
          .outputOptions([
            '-codec:v libx264',
            '-preset medium',
            '-crf 23',
            '-codec:a copy',
            '-movflags +faststart',
            '-pix_fmt yuv420p'
          ])
          .output(outputPath)
          .on('start', (cmd) => {
            this.logger.debug(`▶️ FFmpeg logo command: ${cmd.substring(0, 200)}...`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              this.logger.debug(`📊 Logo overlay progress: ${progress.percent.toFixed(1)}%`);
            }
          })
          .on('end', async () => {
            this.logger.log('✅ Logo overlay completed (top-left, medium size)');

            // ✅ FIX #3: Proper async cleanup with await
            try {
              await this.cleanupFiles(logoPath);
              if (inputPath.includes('text-') || inputPath.includes('input-')) {
                await this.cleanupFiles(inputPath);
              }
            } catch (cleanupError) {
              this.logger.warn(`⚠️ Cleanup warning: ${cleanupError.message}`);
            }

            resolve(outputPath);
          })
          .on('error', (err, stdout, stderr) => {
            this.logger.error(`❌ Logo overlay error: ${err.message}`);
            this.logger.error(`FFmpeg stderr: ${stderr?.substring(0, 500)}`);
            this.cleanupFiles(logoPath).catch(() => {});
            reject(err);
          })
          .run();

      } catch (error) {
        this.logger.error(`❌ Logo processing failed: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * ✅ Download logo from URL
   */
 /**
 * ✅ Download logo from URL, GCS path, or local file
 */
private async downloadLogo(logoUrl: string): Promise<string> {
  try {
    const logoExt = logoUrl.split('.').pop()?.toLowerCase().split('?')[0] || 'png';
    const logoPath = path.join(this.tempDir, `logo-${Date.now()}.${logoExt}`);

    // ✅ FIX: Handle GCS relative paths (e.g., "project-logos/1770964128931-ferrarilogo.png")
    if (!logoUrl.startsWith('http://') && 
        !logoUrl.startsWith('https://') && 
        !logoUrl.startsWith('gs://') &&
        !path.isAbsolute(logoUrl) &&
        !fs.existsSync(logoUrl)) {
      
      this.logger.log(`📥 Downloading logo from GCS: ${logoUrl}`);
      
      const bucketName = process.env.GCP_BUCKET_NAME!;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(logoUrl);  // Use the path directly
      
      try {
        const [buffer] = await file.download();
        
        if (!buffer || buffer.length < 100) {
          throw new Error('Invalid logo data received from GCS');
        }
        
        fs.writeFileSync(logoPath, buffer);
        this.logger.log(`✅ Logo downloaded from GCS (${(buffer.length / 1024).toFixed(2)} KB)`);
        return logoPath;
        
      } catch (gcsError) {
        this.logger.error(`GCS download error: ${gcsError.message}`);
        throw new Error(`Failed to download logo from GCS: ${gcsError.message}`);
      }
    }

    // Handle full GCS URIs (gs://bucket/path)
    if (logoUrl.startsWith('gs://')) {
      this.logger.log(`📥 Downloading from GCS URI: ${logoUrl}`);
      
      const matches = logoUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!matches) {
        throw new Error(`Invalid GCS URI format: ${logoUrl}`);
      }
      
      const [, bucketName, filePath] = matches;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);
      
      const [buffer] = await file.download();
      
      if (!buffer || buffer.length < 100) {
        throw new Error('Invalid logo data received from GCS');
      }
      
      fs.writeFileSync(logoPath, buffer);
      this.logger.log(`✅ Logo downloaded from GCS URI (${(buffer.length / 1024).toFixed(2)} KB)`);
      return logoPath;
    }

    // Handle HTTP/HTTPS URLs
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      this.logger.log(`🌐 Downloading logo from URL...`);
      
      const response = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.data || response.data.length < 100) {
        throw new Error('Invalid logo data received from URL');
      }

      fs.writeFileSync(logoPath, Buffer.from(response.data));
      this.logger.log(`✅ Logo downloaded from URL (${(response.data.length / 1024).toFixed(2)} KB)`);
      return logoPath;
    }

    // Handle local file paths
    if (fs.existsSync(logoUrl)) {
      this.logger.log(`📂 Using local logo file: ${logoUrl}`);
      return logoUrl;
    }

    throw new Error(`Invalid logo URL or path: ${logoUrl}`);

  } catch (error) {
    this.logger.error(`Failed to download logo: ${error.message}`);
    throw new Error(`Logo download failed: ${error.message}`);
  }
}


  /**
   * Overlay logo on video using FFmpeg (original method)
   */
  async overlayLogo(
    videoPath: string,
    logoPath: string,
    options: LogoOverlayOptions = {}
  ): Promise<string> {
    const {
      position = 'bottom-right',
      scale = 0.15,
      padding = 20,
      fadeIn = 0,
      fadeOut = 0
    } = options;

    const outputPath = videoPath.replace(/(\.\w+)$/, '_with_logo$1');

    this.logger.log(`🎬 Starting logo overlay...`);
    this.logger.log(`   Video: ${path.basename(videoPath)}`);
    this.logger.log(`   Logo: ${path.basename(logoPath)}`);
    this.logger.log(`   Position: ${position}`);
    this.logger.log(`   Scale: ${(scale * 100).toFixed(0)}%`);

    return new Promise((resolve, reject) => {
      const positionMap = {
        'top-left': `${padding}:${padding}`,
        'top-right': `W-w-${padding}:${padding}`,
        'bottom-left': `${padding}:H-h-${padding}`,
        'bottom-right': `W-w-${padding}:H-h-${padding}`
      };

      const overlayPosition = positionMap[position];

      let filterComplex = `[1:v]scale=iw*${scale}:-1`;

      if (fadeIn > 0 || fadeOut > 0) {
        filterComplex += `,fade=t=in:st=0:d=${fadeIn}`;
        if (fadeOut > 0) {
          filterComplex += `,fade=t=out:st=${8 - fadeOut}:d=${fadeOut}`;
        }
      }

      filterComplex += `[logo];[0:v][logo]overlay=${overlayPosition}`;

      ffmpeg()
        .input(videoPath)
        .input(logoPath)
        .complexFilter([filterComplex])
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          '-c:a copy',
          '-movflags +faststart',
          '-pix_fmt yuv420p'
        ])
        .on('start', (cmd) => {
          this.logger.debug(`🔧 FFmpeg command: ${cmd}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            this.logger.log(`⏳ Processing: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          this.logger.log(`✅ Logo overlay complete: ${path.basename(outputPath)}`);
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          this.logger.error(`❌ FFmpeg error: ${err.message}`);
          this.logger.error(`❌ FFmpeg stderr: ${stderr}`);
          reject(new Error(`FFmpeg processing failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  async downloadToTemp(url: string, filename?: string): Promise<string> {
    const destPath = path.join(
      this.tempDir,
      filename || `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    this.logger.log(`⬇️ Downloading: ${url.substring(0, 100)}...`);

    const writer = fs.createWriteStream(destPath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 60000
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        this.logger.log(`✅ Downloaded to: ${destPath}`);
        resolve(destPath);
      });
      writer.on('error', (err) => {
        this.logger.error(`❌ Download failed: ${err.message}`);
        reject(err);
      });
    });
  }

  async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          this.logger.error(`❌ Failed to get metadata: ${err.message}`);
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  async cleanupFiles(...filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (filePath && fs.existsSync(filePath) && filePath.includes(this.tempDir)) {
          await unlinkAsync(filePath);
          this.logger.debug(`🗑️ Cleaned up: ${path.basename(filePath)}`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Could not delete ${path.basename(filePath)}: ${error.message}`);
      }
    }
  }

  async cleanupOldTempFiles(hoursOld: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = hoursOld * 60 * 60 * 1000;

      let cleaned = 0;
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await unlinkAsync(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.log(`🧹 Cleaned up ${cleaned} old temp file(s)`);
      }
    } catch (error) {
      this.logger.error(`❌ Error cleaning temp files: ${error.message}`);
    }
  }
}
