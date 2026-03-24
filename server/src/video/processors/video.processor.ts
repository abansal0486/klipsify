// src/video/processors/video.processor.ts
import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { VideoService } from '../video.service';
import { VideoProcessingService } from '../video-processing.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { Express } from 'express';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  VEO_MAX_RETRIES: 3,
  VEO_BACKOFF_BASE: 5000,
  VEO_MAX_BACKOFF: 30000,
  POLL_INTERVAL: 10000,
  POLL_MAX_ATTEMPTS: 60,
  URL_RETRY_ATTEMPTS: 3,
  URL_RETRY_DELAY: 5000,
  MAX_VIDEO_SIZE_MB: 500,
  CACHE_TTL: 7200,
} as const;

// ============================================
// TYPE DEFINITIONS
// ============================================
interface VideoJobData {
  userId: string;
  brandName?: string;
  storyboard: string;
  useLogo?: boolean;
  logoUrl?: string;
  useSlogan?: boolean;
  slogan?: string;
  language?: string;
  videoRatio?: string;
  referenceImage?: string[];
  generatedImage?: string;
  generatedImageId?: string;
  source?: string;
  voiceOverText?: string;
  cameraAngle?: string;
  style?: string;
  burnSubtitles?: boolean;
  videoDuration?: '8s' | '15s' | '30s';
  // ✅ Updated — includes timing fields
  scriptPairs?: {
    script: string;
    voiceOver: string;
    narratorGender?: 'male' | 'female';
    subtitleStart?: number;
    subtitleEnd?: number;
  }[];
}


interface PollResult {
  success: boolean;
  isPending: boolean;
  gcsPath?: string;
  error?: string;
  message?: string;
  userFriendlyMessage?: string;
  downloadUrl?: string;
  viewUrl?: string;
  isRateLimited?: boolean;
  isRetry?: boolean;
}

interface FinalResult extends PollResult {
  overlaysAdded: boolean;
  originalGcsPath?: string;
  overlayDetails?: {
    textAdded: boolean;
    text?: string;
    logoAdded: boolean;
    logoUrl?: string;
  };
  overlayError?: string;
  note?: string;
}

@Processor('video-video-generation')
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly videoProcessingService: VideoProcessingService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  @Process({ name: 'generate-video', concurrency: 3 })
  async handleVideoGeneration(job: Job<VideoJobData>): Promise<FinalResult> {
    const startTime = Date.now();
    const { userId, brandName } = job.data;

    this.logger.log(`🎬 [${job.id}] Starting for user: ${userId} | Brand: ${brandName || 'N/A'}`);

    try {
      // Step 1: Validate
      this.validateJobData(job.data);
      await this.updateProgress(job, 10, 'Initializing...');

      // Step 2: Fetch user
      const user = await this.userModel.findById(userId).lean();
      if (!user) throw new Error('User not found');

      // this.logger.log(`👤 [${job.id}] Plan: ${user.currentPlanName || 'free'}`);

      // Step 3: Generate video with Veo (with retries)
      const { operationName, startTimestamp } = await this.generateVideoWithVeo(job, user);

      // Step 4: Poll for completion
      const pollResult = await this.pollVideoGeneration(job, operationName, startTimestamp);

      // Step 5: Process overlays
      const finalResult = await this.processOverlays(job, pollResult);

      // Step 6: Update gallery
      await this.updateGallery(job, pollResult, finalResult);

      await job.progress(100);
await this.updateJobCache(
  String(job.id),
  job.data.userId,
  'completed',  // ✅ Set to 'completed' not 'processing'
  100,
  finalResult,  // ✅ Include the result
  null
);

const duration = ((Date.now() - startTime) / 1000).toFixed(1);
this.logger.log(`✅ [${job.id}] Done in ${duration}s | Overlays: ${finalResult.overlaysAdded ? 'Yes' : 'No'}`);

return finalResult;


    } catch (error) {
      await this.handleJobFailure(job, error);
      throw error;
    }
  }

  // ============================================
  // VALIDATION
  // ============================================
  private validateJobData(data: VideoJobData): void {
    if (!data.userId || !data.storyboard) {
      throw new Error('Missing required: userId, storyboard');
    }

    if (data.storyboard.length > 5000) {
      throw new Error('Storyboard too long (max 5000 chars)');
    }

    if (data.brandName) {
      const sanitized = data.brandName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
      if (sanitized !== data.brandName) {
        this.logger.warn(`Brand sanitized: "${data.brandName}" → "${sanitized}"`);
        data.brandName = sanitized;
      }
    }

    if (data.logoUrl && !this.isValidUrl(data.logoUrl)) {
      throw new Error('Invalid logo URL');
    }

    const validRatios = ['16:9', '9:16', '1:1', '4:3'];
    if (data.videoRatio && !validRatios.includes(data.videoRatio)) {
      data.videoRatio = '16:9';
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'gs:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // ============================================
  // VIDEO GENERATION WITH RETRIES
  // ============================================
  private async generateVideoWithVeo(
  job: Job<VideoJobData>,
  user: UserDocument
): Promise<{ operationName: string; startTimestamp: number }> {
  const { videoDuration, scriptPairs, storyboard, videoRatio, referenceImage, logoUrl, useLogo } = job.data;
  const aspectRatio = videoRatio || '16:9';
  const durationSeconds = videoDuration === '30s' ? 30 : videoDuration === '15s' ? 15 : 8;
  // build scripts with VO + gender + per-segment timing hints
const scripts = scriptPairs?.map((p, index) => {
  const vo = p.voiceOver?.trim();
  const gender = p.narratorGender || 'female';

  // segment 0 → base (0–8), segment 1 → extension (8–15), etc.
  const segmentOffset = index === 0 ? 0 : 8; // you can generalize if 30s later
  const localStart = (p.subtitleStart ?? 0) - segmentOffset;
  const localEnd   = (p.subtitleEnd   ?? 0) - segmentOffset;

  let s = p.script;

  if (vo) {
    s += `\n\n**VOICEOVER:** "${vo}"`;
    s += `\n**NARRATOR GENDER:** ${gender}`;
    if (!Number.isNaN(localStart) && !Number.isNaN(localEnd)) {
      s += `\n**NARRATION TIMING:** starts at ${Math.max(localStart, 0).toFixed(1)}s, ends at ${Math.max(localEnd, 0).toFixed(1)}s`;
    }
  }

  return s;
}) || [storyboard];


  // ── Multi-segment flow for 15s / 30s ─────────────────────────────────
  if (durationSeconds > 8) {
    this.logger.log(`🎬 [${job.id}] Multi-segment flow: ${videoDuration}`);
    await this.updateProgress(job, 12, `Generating ${videoDuration} video...`);

    const longResult = await this.videoService.testLongVideoFlow(
      scripts,
      aspectRatio,
      durationSeconds,
      useLogo ? logoUrl : undefined,
      referenceImage || [],
    );

    if (!longResult.success) {
      if (longResult.baseVideoCreated === false) {
        await this.videoService.rollbackVideoLimit(job.data.userId);
      }
      throw new Error(longResult.error || 'Multi-segment video generation failed');
    }

    // ✅ Partial success — log and continue with what we have
    if (longResult.isPartial) {
      this.logger.warn(`⚠️ [${job.id}] Partial video: ${longResult.actualDuration}s (requested ${longResult.requestedDuration}s)`);
    }

    const gcsPath = longResult.finalGcsPath || longResult.gcsPath;
    return {
      // ✅ Wrap as a fake "already done" operation to reuse PollResult shape
      operationName: `__done__:${gcsPath}`,
      startTimestamp: Date.now(),
    };
  }

  const scriptText = scriptPairs?.[0]?.script || storyboard;
const vo = scriptPairs?.[0]?.voiceOver?.trim() || '';

// ✅ Do NOT append **VOICEOVER:** here; let buildVeoPrompt handle it
const veoPrompt = await this.buildVeoPrompt(
  {
    ...job.data,
    storyboard: scriptText,   // just the scene text
    voiceOverText: vo,        // VO passed separately
    scriptPairs,              // for gender + timing
  },
  user,
);



  let referenceImages = referenceImage || [];
  let lastError: any = null;

  for (let attempt = 1; attempt <= CONFIG.VEO_MAX_RETRIES; attempt++) {
    try {
      this.logger.log(`📤 [${job.id}] Veo attempt ${attempt}/${CONFIG.VEO_MAX_RETRIES}`);
      await this.updateProgress(job, 10 + attempt * 3, `Generating video (${attempt}/${CONFIG.VEO_MAX_RETRIES})...`);

      const result = await this.videoService['generateVideoUsingVeo3'](
        veoPrompt,
        aspectRatio,
        undefined,         // logo applied in overlays
        referenceImages,
        job.data.userId,
      );

      this.logger.log(`✅ [${job.id}] Veo started: ${result.operationName}`);
      return result;

    } catch (error: any) {
      lastError = error;
      this.logger.error(`❌ [${job.id}] Attempt ${attempt}: ${error.message}`);

      if (error.retryable === false) break;

      if (error.retryWithoutImages === true && attempt < CONFIG.VEO_MAX_RETRIES) {
        this.logger.warn(`⚠️ [${job.id}] Retrying WITHOUT images`);
        referenceImages = [];
      }

      if (attempt < CONFIG.VEO_MAX_RETRIES) {
        const delay = Math.min(CONFIG.VEO_BACKOFF_BASE * 2 ** (attempt - 1), CONFIG.VEO_MAX_BACKOFF);
        await this.updateProgress(job, 10 + attempt * 3, `Retry in ${delay / 1000}s...`);
        await this.delay(delay);
      }
    }
  }

  await this.videoService.rollbackVideoLimit(job.data.userId);
  throw new Error(this.getUserFriendlyError(lastError));
}

  // ============================================
  // POLLING
  // ============================================
  private async pollVideoGeneration(
  job: Job<VideoJobData>,
  operationName: string,
  startTimestamp: number,
): Promise<PollResult> {

  // ── Multi-segment flow already resolved — skip polling ───────────────
  if (operationName.startsWith('__done__:')) {
    const gcsPath = operationName.replace('__done__:', '');
    return {
      success: true,
      isPending: false,
      gcsPath,
      downloadUrl: `/video/test-download?filename=${encodeURIComponent(gcsPath)}`,
      viewUrl: `/video/view-file?filename=${encodeURIComponent(gcsPath)}`,
    };
  }

  const paramDataObj = {
    brandName: job.data.brandName,
    generatedImage: job.data.generatedImage,
    userId: job.data.userId,
    generatedImageId: job.data.generatedImageId,
    script: job.data.storyboard,
    source: job.data.source,
  };

  for (let attempt = 0; attempt < CONFIG.POLL_MAX_ATTEMPTS; attempt++) {
    await this.delay(CONFIG.POLL_INTERVAL);

    const pollResult: PollResult = await this.videoService.pollingStatusForVideoGenerated(
      operationName, startTimestamp, paramDataObj,
    );

    if (pollResult.success && !pollResult.isPending) {
      if (!pollResult.gcsPath) {
        const retried = await this.retryUrlFetch(job, operationName, startTimestamp, paramDataObj);
        if (!retried.gcsPath) {
          await this.videoService.rollbackVideoLimit(job.data.userId);
          throw new Error('Video generated but URL not accessible');
        }
        return retried;
      }
      return pollResult;
    }

    if (!pollResult.success && !pollResult.isPending) {
      await this.videoService.rollbackVideoLimit(job.data.userId);
      throw new Error(pollResult.userFriendlyMessage || pollResult.message || 'Video generation failed');
    }

    const statusMsg = pollResult.isRateLimited
      ? 'Rate limited...'
      : pollResult.isRetry
      ? 'Server error, retrying...'
      : 'Processing...';

    await this.updateProgress(job, Math.min(70, 20 + attempt), statusMsg);
  }

  await this.videoService.rollbackVideoLimit(job.data.userId);
  throw new Error(`Timeout after ${CONFIG.POLL_MAX_ATTEMPTS * 10}s`);
}


  private async retryUrlFetch(
    job: Job<VideoJobData>,
    operationName: string,
    startTimestamp: number,
    paramDataObj: any
  ): Promise<PollResult> {
    this.logger.warn(`⚠️ [${job.id}] URL missing, retrying...`);

    for (let retry = 0; retry < CONFIG.URL_RETRY_ATTEMPTS; retry++) {
      await this.delay(CONFIG.URL_RETRY_DELAY);

      const retryPoll: PollResult = await this.videoService.pollingStatusForVideoGenerated(
        operationName,
        startTimestamp,
        paramDataObj
      );

      if (retryPoll.success && !retryPoll.isPending && retryPoll.gcsPath) {
        this.logger.log(`✅ [${job.id}] URL found on retry ${retry + 1}`);
        return retryPoll;
      }
    }

    return { success: false, isPending: false };
  }

  // ============================================
  // OVERLAYS
  // ============================================
  private async processOverlays(
  job: Job<VideoJobData>,
  pollResult: PollResult,
): Promise<FinalResult> {
  const {
    useSlogan, slogan, useLogo, logoUrl,
    brandName, videoRatio,
    burnSubtitles, voiceOverText, videoDuration,
  } = job.data;

  const needsSubtitles = burnSubtitles && !!voiceOverText?.trim();
  const needsText = !needsSubtitles && useSlogan && !!slogan?.trim()
  && slogan !== voiceOverText;
  const needsLogo      = useLogo && !!logoUrl?.trim();

  // ✅ Skip only if truly nothing to do
  if (!needsSubtitles && !needsText && !needsLogo) {
    return {
      ...pollResult,
      overlaysAdded: false,
      overlayDetails: { textAdded: false, logoAdded: false },
    };
  }

  this.logger.log(
    `🎨 [${job.id}] Overlays → subtitles=${needsSubtitles}, text=${needsText}, logo=${needsLogo}`,
  );

  try {
    await this.updateProgress(job, 72, 'Downloading video...');
    const videoBuffer = await this.downloadVideoSafely(job, pollResult.gcsPath!);

    await this.updateProgress(job, 75, 'Adding overlays...');
    // In processOverlays method — inside video.processor.ts
const processed = await this.videoProcessingService.addOverlays(videoBuffer, {
  slogan: needsText ? slogan : undefined,
  logoPath: needsLogo ? logoUrl : undefined,
  videoRatio: videoRatio || '16:9',
  brandName: brandName || 'video',
  burnSubtitles: needsSubtitles,
  voiceOverText: needsSubtitles ? voiceOverText!.trim() : '',
  videoDuration: videoDuration || '8s',
  // ✅ ADD — pass timed pairs so SRT uses exact start/end per segment
  subtitlePairs: needsSubtitles
    ? job.data.scriptPairs
        ?.filter(p => p.voiceOver?.trim())
        .map(p => ({
          voiceOver: p.voiceOver,
          subtitleStart: p.subtitleStart ?? 0,
          subtitleEnd: p.subtitleEnd ?? 8,
        }))
    : undefined,
});


    await this.updateProgress(job, 85, 'Uploading...');
    const processedFile = this.createMulterFile(processed, brandName || 'video');
    const newGcsPath = await this.videoService.uploadToGCS(processedFile, 'generated-videos');

    this.logger.log(`✅ [${job.id}] Overlays done: ${newGcsPath}`);

    return {
      ...pollResult,
      gcsPath: newGcsPath,
      downloadUrl: `/video/test-download?filename=${encodeURIComponent(newGcsPath)}`,
      viewUrl: `/video/view-file?filename=${encodeURIComponent(newGcsPath)}`,
      originalGcsPath: pollResult.gcsPath,
      overlaysAdded: true,
      overlayDetails: {
  textAdded: !!(needsText || needsSubtitles),   // ✅ coerce to boolean
  text: needsSubtitles ? voiceOverText : slogan,
  logoAdded: !!needsLogo,                        // ✅ coerce to boolean
  logoUrl: needsLogo ? logoUrl : undefined,
},

    };

  } catch (overlayError: any) {
    this.logger.error(`❌ [${job.id}] Overlay failed: ${overlayError.message}`);
    return {
      ...pollResult,
      overlaysAdded: false,
      overlayError: overlayError.message,
      note: 'Returning original video',
    };
  }
}
 

  private async downloadVideoSafely(job: Job<VideoJobData>, gcsPath: string): Promise<Buffer> {
    const stream = await this.videoService.getFileStream(gcsPath);
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const maxBytes = CONFIG.MAX_VIDEO_SIZE_MB * 1024 * 1024;

    for await (const chunk of stream) {
      const buffer = Buffer.from(chunk);
      totalSize += buffer.length;

      if (totalSize > maxBytes) {
        stream.destroy();
        throw new Error(`Video exceeds ${CONFIG.MAX_VIDEO_SIZE_MB}MB limit`);
      }

      chunks.push(buffer);
    }

    const videoBuffer = Buffer.concat(chunks);
    const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(1);
    this.logger.log(`✅ [${job.id}] Downloaded ${sizeMB}MB`);

    return videoBuffer;
  }

  private createMulterFile(buffer: Buffer, brandName: string): Express.Multer.File {
    return {
      buffer,
      originalname: `${brandName}-${Date.now()}.mp4`,
      mimetype: 'video/mp4',
      fieldname: 'video',
      encoding: '7bit',
      size: buffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };
  }

  // ============================================
  // GALLERY UPDATE
  // ============================================
private async updateGallery(
  job: Job<VideoJobData>,
  pollResult: PollResult,
  finalResult: FinalResult
): Promise<void> {
  try {
    // Use final processed path if overlays added, otherwise original
    const gcsPath = (finalResult.overlaysAdded ? finalResult.gcsPath : null)
      || pollResult.gcsPath;

    if (!gcsPath) {
      this.logger.warn(`⚠️ [${job.id}] No GCS path to save`);
      return;
    }

    const downloadUrl = finalResult.overlaysAdded
      ? finalResult.downloadUrl
      : pollResult.downloadUrl
        || `/video/test-download?filename=${encodeURIComponent(gcsPath)}`;

    // ✅ Direct save — no find/update, works for both 8s and 15s/30s
    await this.videoService.saveGeneratedVideoURLInDB(
      job.data.userId,
      downloadUrl!,
      gcsPath,
      job.data.generatedImageId ?? undefined,
      job.data.generatedImage,
      job.data.storyboard,
      job.data.brandName || 'video-generated',
      job.data.source || 'freestyle',
    );

    this.logger.log(`✅ [${job.id}] Saved to DB: ${gcsPath}`);
  } catch (error: any) {
    this.logger.error(`❌ [${job.id}] Gallery save failed: ${error.message}`);
  }
}



  private sanitizeBrandName(brandName?: string): string {
    if (!brandName) return 'untitled';
    return brandName
      .replace(/-freestyle$/i, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase() || 'untitled';
  }

  // ============================================
  // PROMPT BUILDING
  // ============================================
  // private async buildVeoPrompt(data: VideoJobData, user: UserDocument): Promise<string> {
  //   const isHebrew = this.containsHebrew(data.storyboard) || this.containsHebrew(data.voiceOverText);
  //   const sanitized = this.sanitizeBrandNames(data.storyboard?.trim() || '');

  //   let prompt = '';


    // if (isHebrew) {
    //   prompt += 'שפה: עברית בלבד.\n\n';
    //   prompt += `**תיאור:**\n${sanitized}\n\n`;
    //   if (data.style) prompt += `**סגנון:** ${data.style}\n\n`;
    //   if (data.voiceOverText) prompt += `**קריינות:** "${this.sanitizeText(data.voiceOverText)}"\n\n`;
    //   if (data.cameraAngle) prompt += `**מצלמה:** ${data.cameraAngle}\n\n`;
    //   if (user.currentPlanName === 'free') prompt += `**סימן מים CLIPSYFY**\n\n`;
    //   prompt += `**איכות קולנועית גבוהה**`;
    // } else {
    //   prompt += 'Language: English only.\n\n';
    //   prompt += `**SCENE:**\n${sanitized}\n\n`;
    //   if (data.style) prompt += `**STYLE:** ${data.style}\n\n`;
    //   if (data.voiceOverText) prompt += `**VOICEOVER:** "${this.sanitizeText(data.voiceOverText)}"\n\n`;
    //   if (data.cameraAngle) prompt += `**CAMERA:** ${data.cameraAngle}\n\n`;
    //   if (user.currentPlanName === 'free') prompt += `**CLIPSYFY watermark bottom-right**\n\n`;
    //   prompt += `**Cinematic quality**`;

  //   if (isHebrew) {
  //     prompt += 'שפה: עברית בלבד.\n\n';
  //     prompt += `**תיאור:**\n${sanitized}\n\n`;
  //     if (data.style) prompt += `**סגנון:** ${data.style}\n\n`;
  //     // if (data.voiceOverText) prompt += `**קריינות:** "${this.sanitizeText(data.voiceOverText)}"\n\n`;
  //     if (data.cameraAngle) prompt += `**מצלמה:** ${data.cameraAngle}\n\n`;
  //     if (user.currentPlanName === 'free') prompt += `**סימן מים SAMBA**\n\n`;
  //     prompt += `**איכות קולנועית גבוהה**`;
  //   } else {
  //     prompt += 'Language: English only.\n\n';
  //     prompt += `**SCENE:**\n${sanitized}\n\n`;
  //     if (data.style) prompt += `**STYLE:** ${data.style}\n\n`;
  //     // if (data.voiceOverText) prompt += `**VOICEOVER:** "${this.sanitizeText(data.voiceOverText)}"\n\n`;
  //     if (data.cameraAngle) prompt += `**CAMERA:** ${data.cameraAngle}\n\n`;
  //     if (user.currentPlanName === 'free') prompt += `**SAMBA watermark bottom-right**\n\n`;
  //     prompt += `**Cinematic quality**`;
  //   }

  //   return prompt.trim();
  // }

 private async buildVeoPrompt(data: VideoJobData, user: UserDocument): Promise<string> {
  const isHebrew = this.containsHebrew(data.storyboard) || this.containsHebrew(data.voiceOverText);
  const sanitized = this.sanitizeBrandNames(data.storyboard?.trim() || '');

  // ✅ Take timing and gender from first scriptPair
  const firstPair = data.scriptPairs?.[0];
  const narratorGender = firstPair?.narratorGender || 'female';
  const subtitleStart  = firstPair?.subtitleStart;
  const subtitleEnd    = firstPair?.subtitleEnd;

  let prompt = '';

  if (isHebrew) {
    prompt += 'שפה: עברית בלבד.\n\n';
    prompt += `**תיאור:**\n${sanitized}\n\n`;
    if (data.style) prompt += `**סגנון:** ${data.style}\n\n`;

    if (data.voiceOverText?.trim()) {
      prompt += `**קריינות:** "${this.sanitizeText(data.voiceOverText)}"\n`;
      prompt += `**מגדר קריין:** ${narratorGender === 'male' ? 'זכר' : 'נקבה'}\n`;
      if (subtitleStart !== undefined && subtitleEnd !== undefined) {
        prompt += `**תזמון קריינות:** ${subtitleStart}s עד ${subtitleEnd}s\n\n`;
      } else {
        prompt += '\n';
      }
    }

    if (data.cameraAngle) prompt += `**מצלמה:** ${data.cameraAngle}\n\n`;
    // if (user.currentPlanName === 'free') prompt += `**סימן מים SAMBA**\n\n`;
    prompt += `**איכות קולנועית גבוהה**`;

  } else {
    prompt += 'Language: English only.\n\n';
    prompt += `**SCENE:**\n${sanitized}\n\n`;
    if (data.style) prompt += `**STYLE:** ${data.style}\n\n`;

    if (data.voiceOverText?.trim()) {
      prompt += `**VOICEOVER:** "${this.sanitizeText(data.voiceOverText)}"\n`;
      prompt += `**NARRATOR GENDER:** ${narratorGender}\n`;
      if (subtitleStart !== undefined && subtitleEnd !== undefined) {
        prompt += `**NARRATION TIMING:** starts at ${subtitleStart}s, ends at ${subtitleEnd}s\n\n`;
      } else {
        prompt += '\n';
      }
    }

    if (data.cameraAngle) prompt += `**CAMERA:** ${data.cameraAngle}\n\n`;
    // if (user.currentPlanName === 'free') prompt += `**SAMBA watermark bottom-right**\n\n`;
    prompt += `**Cinematic quality**`;
  }

  return prompt.trim();
}



  private containsHebrew(text?: string): boolean {
    return text ? /[\u0590-\u05FF]/.test(text) : false;
  }

  private sanitizeBrandNames(text: string): string {
    const filters = [
      { original: /Ferrari/gi, replacement: 'luxury sports car' },
      { original: /Lamborghini/gi, replacement: 'performance car' },
      { original: /Tesla/gi, replacement: 'electric vehicle' },
      { original: /Coca-Cola/gi, replacement: 'cola drink' },
      { original: /Nike/gi, replacement: 'athletic brand' },
      { original: /Apple/gi, replacement: 'tech brand' },
    ];

    let result = text;
    filters.forEach(f => result = result.replace(f.original, f.replacement));
    return result;
  }

  private sanitizeText(text: string): string {
    return text.replace(/[<>]/g, '').replace(/script/gi, '').substring(0, 1000);
  }

  // ============================================
  // ERROR HANDLING
  // ============================================
  private getUserFriendlyError(error: any): string {
    if (!error) return '❌ Unable to generate video';

    const msg = (error.message || '').toLowerCase();

    if (msg.includes('policy') || msg.includes('prohibited')) {
      return '🚫 Content violates guidelines. Please rephrase.';
    }
    if (msg.includes('auth')) return '⚠️ Authentication issue';
    if (msg.includes('rate limit') || msg.includes('429')) return '⏳ Rate limited. Try again soon.';
    if (msg.includes('timeout')) return '⏱️ Timeout. Try shorter description.';
    if (msg.includes('image')) return '🖼️ Image issue. Try without images.';
    if (msg.includes('503')) return '⚠️ Service unavailable';
    if (msg.includes('size')) return '📦 File too large';

    const safe = error.message?.substring(0, 100) || 'Unknown error';
    return `❌ Generation failed: ${safe}`;
  }

  private async handleJobFailure(job: Job<VideoJobData>, error: any): Promise<void> {
    this.logger.error(`❌ [${job.id}] FAILED: ${error.message}`);

    const userMsg = this.getUserFriendlyError(error);
    const cached: any = await this.cacheManager.get(`job:${job.id}`);

    if (!cached || cached.status !== 'failed') {
      await this.updateJobCache(String(job.id), job.data.userId, 'failed', 0, null, userMsg);
    }
  }

  // ============================================
  // PROGRESS & CACHE
  // ============================================
  private async updateProgress(job: Job<VideoJobData>, progress: number, message?: string): Promise<void> {
    await job.progress(progress);
    await this.updateJobCache(String(job.id), job.data.userId, 'processing', progress, null, message);
  }

  private async updateJobCache(
    jobId: string,
    userId: string,
    status: 'processing' | 'completed' | 'failed',
    progress: number,
    result: any = null,
    error: string | null = null
  ): Promise<void> {
    await this.cacheManager.set(
      `job:${jobId}`,
      {
        jobId,
        userId,
        type: 'video',
        status,
        progress,
        result,
        error,
        updatedAt: new Date().toISOString(),
      },
      CONFIG.CACHE_TTL
    );
  }

  // ============================================
  // QUEUE HOOKS
  // ============================================
  @OnQueueActive()
  onActive(job: Job<VideoJobData>) {
    this.logger.log(`🔄 [${job.id}] ACTIVE`);
  }

  @OnQueueCompleted()
  async onCompleted(job: Job<VideoJobData>, result: any) {
    this.logger.log(`✅ [${job.id}] COMPLETED`);
    await this.updateJobCache(String(job.id), job.data.userId, 'completed', 100, result);
  }

  @OnQueueFailed()
  async onFailed(job: Job<VideoJobData>, error: Error) {
    this.logger.error(`❌ [${job.id}] FAILED: ${error.message}`);
    await this.updateJobCache(String(job.id), job.data.userId, 'failed', 0, null, error.message);
  }

  // ============================================
  // UTILITY
  // ============================================
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
