  import { Injectable, Logger } from '@nestjs/common';
  import * as ffmpeg from 'fluent-ffmpeg';
  import * as path from 'path';
  import * as fs from 'fs';
  import * as os from 'os';
  import { promisify } from 'util';
  import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
  import axios from 'axios';
  import { createCanvas, registerFont } from 'canvas';

  // Set FFmpeg path
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);

  const unlinkAsync = promisify(fs.unlink);
  const mkdirAsync = promisify(fs.mkdir);

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
  burnSubtitles?: boolean;
  voiceOverText?: string;
  videoDuration?: string;
  // ✅ ADD — timed subtitle pairs from scriptPairs
  subtitlePairs?: Array<{
    voiceOver: string;
    subtitleStart: number;
    subtitleEnd: number;
  }>;
}


  @Injectable()
  export class VideoProcessingService {
    private readonly logger = new Logger(VideoProcessingService.name);
    private readonly tempDir = path.join(os.tmpdir(), 'video-processing');
    private fontPath: string;

    constructor() {
      this.ensureTempDir();
      this.initializeFont();
    }

    private async ensureTempDir(): Promise<void> {
      if (!fs.existsSync(this.tempDir)) {
        await mkdirAsync(this.tempDir, { recursive: true });
        this.logger.log(`📁 Created temp directory: ${this.tempDir}`);
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

      if (fs.existsSync(this.fontPath)) {
        registerFont(this.fontPath, { family: 'CustomFont' });
      }

      // Canvas width based on ratio
      let canvasWidth = 1920;
      if (videoRatio === '9:16' || videoRatio === '3:4') {
        canvasWidth = 1080;
      } else if (videoRatio === '1:1') {
        canvasWidth = 1080;
      }

      const maxTextWidth = canvasWidth - 80; // padding left+right
      const lineHeight = fontSize + 16;

      // ── Step 1: Measure and wrap text into lines ──
      const tempCanvas = createCanvas(canvasWidth, 100);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.font = `bold ${fontSize}px CustomFont, Arial, sans-serif`;

      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = tempCtx.measureText(testLine);

        if (metrics.width > maxTextWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // ── Step 2: Canvas height based on line count ──
      const paddingY = 28;
      const canvasHeight = lines.length * lineHeight + paddingY * 2;

      // ── Step 3: Draw on real canvas ──
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // Semi-transparent background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Text style
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fontSize}px CustomFont, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // ── Step 4: Draw each line centered ──
      lines.forEach((line, index) => {
        const y = paddingY + index * lineHeight;
        ctx.fillText(line, canvasWidth / 2, y);
      });

      // Save PNG
      const imagePath = path.join(this.tempDir, `text-image-${Date.now()}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(imagePath, buffer);

      this.logger.log(`✅ Text rendered: ${lines.length} line(s) → ${imagePath}`);
      return imagePath;

    } catch (error) {
      this.logger.error(`❌ Failed to render text: ${error.message}`);
      throw error;
    }
  }

 private async generateSrtFile(
  text: string,
  durationSeconds: number,
  subtitlePairs?: Array<{ voiceOver: string; subtitleStart: number; subtitleEnd: number }>
): Promise<string> {
  const srtPath = path.join(this.tempDir, `subtitle-${Date.now()}.srt`);

  let srtContent = '';

  // ✅ Use exact timings from scriptPairs if available
  if (subtitlePairs?.length) {
    subtitlePairs.forEach((pair, index) => {
      if (!pair.voiceOver?.trim()) return;
      srtContent += `${index + 1}\n`;
      srtContent += `${this.formatSrtTime(pair.subtitleStart)} --> ${this.formatSrtTime(pair.subtitleEnd)}\n`;
      srtContent += `${pair.voiceOver.trim()}\n\n`;
    });
  } else {
    // ✅ Fallback — split text evenly across duration
    const words = text.trim().split(/\s+/);
    const chunkSize = Math.max(6, Math.ceil(words.length / Math.ceil(durationSeconds / 3)));
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    const timePerChunk = durationSeconds / chunks.length;

    chunks.forEach((chunk, i) => {
      const start = i * timePerChunk;
      const end = Math.min((i + 1) * timePerChunk - 0.1, durationSeconds);
      srtContent += `${i + 1}\n${this.formatSrtTime(start)} --> ${this.formatSrtTime(end)}\n${chunk}\n\n`;
    });
  }

  fs.writeFileSync(srtPath, srtContent.trim(), 'utf8');
  this.logger.log(`📝 SRT generated → ${srtPath}`);
  return srtPath;
}

// ✅ ADD this helper (replaces the inline formatSrtTime inside old generateSrtFile)
private formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}



private async burnSrtSubtitles(
  inputPath: string,
  srtPath: string,
  videoRatio: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(this.tempDir, `subtitled-${Date.now()}.mp4`);

    // Escape path for FFmpeg subtitles filter (handles Windows backslashes + colons)
    const escapedSrt = srtPath
      .replace(/\\/g, '/')
      .replace(/:/g, '\\:');

    ffmpeg(inputPath)
      .videoFilters(
        `subtitles='${escapedSrt}':force_style='` +
        `Fontsize=22,` +
        `Alignment=2,` +       // bottom-center
        `MarginV=40,` +        // margin from bottom
        `Bold=1,` +
        `PrimaryColour=&H00FFFFFF,` +   // white text
        `OutlineColour=&H00000000,` +   // black outline
        `Outline=2,` +
        `BackColour=&H80000000,` +      // semi-transparent background
        `BorderStyle=4'`                // box background style
      )
      .outputOptions([
        '-codec:v libx264',
        '-preset medium',
        '-crf 23',
        '-codec:a copy',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        this.logger.debug(`▶️ SRT burn command: ${cmd.substring(0, 200)}...`);
      })
      .on('end', () => {
        this.logger.log(`✅ Subtitles burned successfully`);
        this.cleanupFiles(inputPath);
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        this.logger.error(`❌ SRT burn error: ${err.message}`);
        this.logger.error(`FFmpeg stderr: ${stderr?.substring(0, 500)}`);
        reject(err);
      })
      .run();
  });
}

    /**
     * Add text and logo overlays to video
     */
    async addOverlays(
  videoBuffer: Buffer,
  options: VideoOverlayOptions
): Promise<Buffer> {
  const {
    slogan, logoPath, videoRatio, brandName,
    burnSubtitles, voiceOverText, videoDuration,
    subtitlePairs,  // ✅ NEW
  } = options;

  this.logger.log(`🎨 Starting overlay processing...`);
  this.logger.log(`   • Slogan: ${slogan ? `"${slogan}"` : 'None'}`);
  this.logger.log(`   • Logo: ${logoPath ? 'Yes' : 'None'}`);
  this.logger.log(`   • Ratio: ${videoRatio || '16:9'}`);
  this.logger.log(`   • Subtitles: ${burnSubtitles ? 'Yes' : 'No'}`);
  this.logger.log(`   • Subtitle pairs: ${subtitlePairs?.length || 0}`);

  const inputPath = path.join(this.tempDir, `input-${Date.now()}.mp4`);
  fs.writeFileSync(inputPath, videoBuffer);

  try {
    let processedPath = inputPath;

    // Step 1: Burn subtitles
    if (burnSubtitles && (subtitlePairs?.length || voiceOverText?.trim())) {
      const durationSeconds = videoDuration === '30s' ? 30 : videoDuration === '15s' ? 15 : 8;

      this.logger.log(`📝 Burning subtitles... pairs=${subtitlePairs?.length || 0}`);

      // ✅ Pass subtitlePairs for exact timing, falls back to text split
      const srtPath = await this.generateSrtFile(
        voiceOverText?.trim() || '',
        durationSeconds,
        subtitlePairs,   // ✅ exact timings used here
      );

      processedPath = await this.burnSrtSubtitles(processedPath, srtPath, videoRatio || '16:9');
      await this.cleanupFiles(srtPath);

    } else if (slogan?.trim()) {
      // Step 1b: Fallback slogan overlay
      this.logger.log(`📝 Adding text overlay: "${slogan}"`);
      processedPath = await this.addTextOverlay(processedPath, slogan, videoRatio);
    }

    // Step 2: Logo overlay
    if (logoPath?.trim()) {
      this.logger.log(`🎨 Adding logo overlay from: ${logoPath}`);
      processedPath = await this.addLogoOverlay(processedPath, logoPath);
    }

    const finalBuffer = fs.readFileSync(processedPath);
    this.logger.log(`✅ Processing complete! Final size: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    await this.cleanupFiles(inputPath, processedPath);
    return finalBuffer;

  } catch (error) {
    this.logger.error(`❌ Error adding overlays: ${error.message}`, error.stack);
    await this.cleanupFiles(inputPath);
    throw error;
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
          const fontSize = 36;

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
            .on('end', () => {
              this.logger.log('✅ Text overlay completed');
              this.cleanupFiles(textImagePath);
              if (inputPath.includes('text-') || inputPath.includes('input-')) {
                this.cleanupFiles(inputPath);
              }
              resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
              this.logger.error(`❌ Text overlay error: ${err.message}`);
              this.logger.error(`FFmpeg stderr: ${stderr?.substring(0, 500)}`);
              this.cleanupFiles(textImagePath);
              reject(err);
            })
            .run();

        } catch (error) {
          reject(error);
        }
      });
    }

    /**
     * Add logo overlay to video
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
            .on('end', () => {
              this.logger.log('✅ Logo overlay completed (top-left, medium size)');
              this.cleanupFiles(logoPath, inputPath);
              resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
              this.logger.error(`❌ Logo overlay error: ${err.message}`);
              this.logger.error(`FFmpeg stderr: ${stderr?.substring(0, 500)}`);
              this.cleanupFiles(logoPath);
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
     * Download logo from URL
     */
    private async downloadLogo(logoUrl: string): Promise<string> {
      try {
        const logoExt = logoUrl.split('.').pop()?.toLowerCase().split('?')[0] || 'png';
        const logoPath = path.join(this.tempDir, `logo-${Date.now()}.${logoExt}`);

        if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
          this.logger.log(`🌐 Downloading logo from URL...`);
          
          const response = await axios.get(logoUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxRedirects: 5,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          if (!response.data || response.data.length < 100) {
            throw new Error('Invalid logo data received');
          }

          fs.writeFileSync(logoPath, Buffer.from(response.data));
          this.logger.log(`✅ Logo downloaded (${(response.data.length / 1024).toFixed(2)} KB)`);
          return logoPath;
        }

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
