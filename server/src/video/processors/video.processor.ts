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
import {Subscription, SubscriptionDocument} from "src/subscriptions/schemas/subscription.schema";
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import mongoose from "mongoose";

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
    voiceGender?: string;
    videoDuration?: '8s' | '15s' | '30s';
    scriptPairs?: {
    script: string;
    voiceOver?: string;       // optional
    narrator?: string;        // ✅ add this
    narratorGender?: string;  // full string not just male/female
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
       private readonly subscriptionsService: SubscriptionsService,
        @InjectModel(Subscription.name) private subscription: Model<SubscriptionDocument>,
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
    console.log(user,"-----------------------------");
    const subscription = await this.subscription.findOne({
      userId: mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId,
    });
    console.log(subscription,"-----------------------------");
    if (!user) throw new Error('User not found');
    if (!subscription) throw new Error('Subscription not found--------');
    this.logger.log(`👤 [${job.id}] Plan: ${subscription.planName || 'free'}`);

    // Step 3: Generate video with Veo
    const { operationName, startTimestamp } = await this.generateVideoWithVeo(job, user, subscription);

    // Step 4: Poll for completion
    const pollResult = await this.pollVideoGeneration(job, operationName, startTimestamp);

    // Step 5: Process overlays (subtitle burn + logo)
    const finalResult = await this.processOverlays(job, pollResult);

    // ✅ Step 6: TTS audio merge — after overlays, only if narrator text exists
    const gcsPathAfterOverlays = finalResult.gcsPath || pollResult.gcsPath!;
    const finalGcsPath = await this.processTTSAudio(job, gcsPathAfterOverlays);

    // Update finalResult with TTS-merged path if it changed
    if (finalGcsPath !== gcsPathAfterOverlays) {
      finalResult.gcsPath = finalGcsPath;
      finalResult.downloadUrl = `/video/test-download?filename=${encodeURIComponent(finalGcsPath)}`;
      finalResult.viewUrl = `/video/view-file?filename=${encodeURIComponent(finalGcsPath)}`;
      this.logger.log(`[${job.id}] 🎵 Final video updated with audio: ${finalGcsPath}`);
    }

    // Step 7: Update gallery
    await this.updateGallery(job, pollResult, finalResult);

    await job.progress(100);
    await this.updateJobCache(
      String(job.id),
      job.data.userId,
      'completed',
      100,
      finalResult,
      null,
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
  user: UserDocument,
  subscription: SubscriptionDocument
): Promise<{ operationName: string; startTimestamp: number }> {
  const { videoDuration, scriptPairs, storyboard, videoRatio, referenceImage, logoUrl, useLogo, source } = job.data;
  const aspectRatio = videoRatio || '16:9';
  const durationSeconds = videoDuration === '30s' ? 30 : videoDuration === '15s' ? 15 : 8;

  // ✅ Freestyle: pair.script is already a clean Veo prompt from generateVideoScripts
  // ✅ Product/brand: still run through buildVeoPrompt
  const isFreestyle = source === 'freestyle' || !source;
  const scripts = await Promise.all(
    (scriptPairs ?? [{ script: storyboard }]).map(pair =>
      isFreestyle
        ? Promise.resolve(pair.script)           // ✅ use directly — already formatted
        : this.buildVeoPrompt(
            { ...job.data, storyboard: pair.script, scriptPairs: [pair] },
            user,
              subscription
          )
    )
  );

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

    if (longResult.isPartial) {
      this.logger.warn(`⚠️ [${job.id}] Partial video: ${longResult.actualDuration}s (requested ${longResult.requestedDuration}s)`);
    }

    const gcsPath = longResult.finalGcsPath || longResult.gcsPath;
    return {
      operationName: `__done__:${gcsPath}`,
      startTimestamp: Date.now(),
    };
  }

  // ── Single 8s video ───────────────────────────────────────────────────
  // Always pre-sanitize to reduce chance of RAI rejection
  let veoPrompt = this.sanitizeForVeo(scripts[0]);
  let referenceImages = referenceImage || [];
  let lastError: any = null;
  let policyViolationCount = 0;

  for (let attempt = 1; attempt <= CONFIG.VEO_MAX_RETRIES; attempt++) {
    try {
      this.logger.log(`📤 [${job.id}] Veo attempt ${attempt}/${CONFIG.VEO_MAX_RETRIES}`);
      await this.updateProgress(job, 10 + attempt * 3, `Generating video (${attempt}/${CONFIG.VEO_MAX_RETRIES})...`);

      const result = await this.videoService['generateVideoUsingVeo3'](
        veoPrompt,
        aspectRatio,
        undefined,
        referenceImages,
        job.data.userId,
      );

      this.logger.log(`✅ [${job.id}] Veo started: ${result.operationName}`);
      return result;

    } catch (error: any) {
      lastError = error;
      this.logger.error(`❌ [${job.id}] Attempt ${attempt}: ${error.message}`);

      // Content violation — don't give up, retry with a safer generic prompt
      if (error.code === 'POLICY_VIOLATION' || error.retryable === false) {
        policyViolationCount++;
        if (policyViolationCount === 1 && attempt < CONFIG.VEO_MAX_RETRIES) {
          // First violation: strip more aggressively and remove images
          veoPrompt = this.buildSafeGenericPrompt(job.data);
          referenceImages = [];
          this.logger.warn(`⚠️ [${job.id}] Content violation — retrying with safe generic prompt`);
          await this.delay(3000);
          continue;
        }
        break; // second violation — give up
      }

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

    const needsSubtitles = false;
    const needsText = !needsSubtitles && useSlogan && !!slogan?.trim()
    && slogan !== voiceOverText;
    const needsLogo      = useLogo && !!logoUrl?.trim();


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
  burnSubtitles: false,           // ✅ NEVER burn subtitles here
  voiceOverText: '',              // ✅ empty
  videoDuration: videoDuration || '8s',
  subtitlePairs: undefined,       // ✅ no pairs here
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
  private async updateGallery(job, pollResult, finalResult): Promise<void> {
  try {
    // ✅ Always prefer finalResult.gcsPath — it has TTS audio merged
    const gcsPath = finalResult.gcsPath || pollResult.gcsPath;

    if (!gcsPath) {
      this.logger.warn(`⚠️ [${job.id}] No GCS path to save`);
      return;
    }

    const downloadUrl = finalResult.downloadUrl
      || pollResult.downloadUrl
      || `/video/test-download?filename=${encodeURIComponent(gcsPath)}`;

    await this.videoService.saveGeneratedVideoURLInDB(
      job.data.userId,
      downloadUrl,
      gcsPath,
      job.data.generatedImageId ?? undefined,
      job.data.generatedImage,
      job.data.storyboard,
      job.data.brandName || 'video-generated',
      job.data.source || 'freestyle',
      job.data.voiceOverText || '',
      job.data.burnSubtitles ?? false,
      job.data.videoDuration || '',
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

  private async buildVeoPrompt(data: VideoJobData, user: UserDocument, subscription: SubscriptionDocument): Promise<string> {
    const isHebrew = this.containsHebrew(data.storyboard) || this.containsHebrew(data.voiceOverText);
    const sanitized = this.sanitizeForVeo(this.sanitizeBrandNames(data.storyboard?.trim() || ''));

    const firstPair = data.scriptPairs?.[0];
    const narratorGender = firstPair?.narratorGender || 'Sarah, a female narrator, warm friendly voice';
    const subtitleStart  = firstPair?.subtitleStart;
    const subtitleEnd    = firstPair?.subtitleEnd;
    const voiceText      = firstPair?.voiceOver?.trim() || data.voiceOverText?.trim() || '';
    const narratorText   = firstPair?.narrator?.trim() || '';

    let prompt = '';

    if (isHebrew) {
      prompt += 'שפה: עברית בלבד.\n\n';
      prompt += `**תיאור:**\n${sanitized}\n\n`;
      if (data.style) prompt += `**סגנון:** ${data.style}\n\n`;

      if (narratorText) {
        // ✅ narrator — dialogue, no timing
        prompt += `**דיאלוג:** "${this.sanitizeText(narratorText)}"\n\n`;
      } else if (voiceText) {
        // ✅ voiceover — with timing
        prompt += `**קריינות:** "${this.sanitizeText(voiceText)}"\n`;
        prompt += `**קריין:** ${narratorGender}\n`;
        if (subtitleStart !== undefined && subtitleEnd !== undefined) {
          prompt += `**תזמון:** ${subtitleStart}s עד ${subtitleEnd}s\n\n`;
        } else {
          prompt += '\n';
        }
      }

      if (data.cameraAngle) prompt += `**מצלמה:** ${data.cameraAngle}\n\n`;
      if (subscription.planName === 'free') prompt += `**סימן מים SAMBA**\n\n`;
      prompt += `**איכות קולנועית גבוהה**`;

    } else {
      prompt += 'Language: English only.\n\n';
      prompt += `**SCENE:**\n${sanitized}\n\n`;
      if (data.style) prompt += `**STYLE:** ${data.style}\n\n`;
      if (data.cameraAngle) prompt += `**CAMERA:** ${data.cameraAngle}\n\n`;
      if (subscription.planName === 'free') prompt += `**SAMBA watermark bottom-right**\n\n`;
      // prompt += `**Cinematic quality**`;
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

    // ── Sanitize prompt before sending to Veo to avoid content violations ──
    private sanitizeForVeo(prompt: string): string {
      // Known brand names that trigger Veo's RAI filter
      const brandReplacements: Array<[RegExp, string]> = [
        [/\bCoca[-\s]?Cola\b/gi,     'cola beverage'],
        [/\bPepsi\b/gi,               'cola drink'],
        [/\bMcDonald['']?s?\b/gi,     'fast food restaurant'],
        [/\bKFC\b/gi,                 'fried chicken restaurant'],
        [/\bBurger\s?King\b/gi,       'burger restaurant'],
        [/\bStarbucks\b/gi,           'coffee shop'],
        [/\bApple\s+Inc\b/gi,         'tech company'],
        [/\biPhone\b/gi,              'smartphone'],
        [/\biPad\b/gi,                'tablet device'],
        [/\bSamsung\b/gi,             'electronics brand'],
        [/\bGoogle\b/gi,              'tech company'],
        [/\bMeta\b/gi,                'social media company'],
        [/\bFacebook\b/gi,            'social media platform'],
        [/\bInstagram\b/gi,           'social media app'],
        [/\bNike\b/gi,                'athletic brand'],
        [/\bAdidas\b/gi,              'sportswear brand'],
        [/\bLouis\s?Vuitton\b/gi,     'luxury fashion brand'],
        [/\bGucci\b/gi,               'luxury fashion brand'],
        [/\bAmazon\b/gi,              'e-commerce brand'],
        [/\bNetflix\b/gi,             'streaming service'],
        [/\bFerrari\b/gi,             'luxury sports car'],
        [/\bLamborghini\b/gi,         'high-performance car'],
        [/\bPorsche\b/gi,             'luxury car'],
        [/\bBMW\b/gi,                 'luxury car'],
        [/\bMercedes[-\s]?Benz\b/gi,  'luxury car'],
        [/\bTesla\b/gi,               'electric vehicle'],
        [/\bRolex\b/gi,               'luxury watch'],
        [/\bDisney\b/gi,              'entertainment brand'],
        [/\bMarvel\b/gi,              'entertainment franchise'],
      ];

      // Words/phrases Veo flags regardless of context
      const sensitiveReplacements: Array<[RegExp, string]> = [
        // Violence / weapons
        [/\bgun(s|fire|shot|man|men)?\b/gi,         'object'],
        [/\bweapon(s|ry)?\b/gi,                      'item'],
        [/\bknife\b|\bknives\b/gi,                   'utensil'],
        [/\bbullet(s|proof)?\b/gi,                   'item'],
        [/\bexplosi(on|ve)(s)?\b/gi,                 'effect'],
        [/\bbomb(s|ing)?\b/gi,                        'device'],
        [/\bblood(y|shed|bath)?\b/gi,                'stain'],
        [/\bdead\s+body\b|\bcorpse\b|\bcadaver\b/gi, 'scene'],
        [/\bkill(ing|ed|er)?\b/gi,                   'affect'],
        [/\bmurder(ing|ed|er)?\b/gi,                 'event'],
        // Adult / inappropriate
        [/\bnude\b|\bnaked\b|\bnudity\b/gi,           'unclothed'],
        [/\bsex(ual|y|ually)?\b/gi,                  'romantic'],
        [/\bporn(ography|ographic)?\b/gi,             'content'],
        // Drugs / alcohol
        [/\bcocaine\b|\bheroin\b|\bmeth\b|\bcrack\b/gi, 'substance'],
        [/\bdrug\s+(dealer|deal|use|abuse)\b/gi,       'activity'],
        [/\bwhiskey\b|\bvodka\b|\bweed\b|\bmarijuana\b/gi, 'beverage'],
        // Celebrity / real people (common triggers)
        [/\bElon\s?Musk\b/gi,    'entrepreneur'],
        [/\bJeff\s?Bezos\b/gi,   'businessman'],
        [/\bObama\b/gi,          'political figure'],
        [/\bTrump\b/gi,          'political figure'],
        [/\bBiden\b/gi,          'political figure'],
        [/\bPutin\b/gi,          'political figure'],
        [/\bTaylor\s?Swift\b/gi, 'pop artist'],
        [/\bBeyonc[eé]\b/gi,     'music artist'],
      ];

      let result = prompt;
      for (const [pattern, replacement] of [...brandReplacements, ...sensitiveReplacements]) {
        result = result.replace(pattern, replacement);
      }
      return result;
    }

    private sanitizeText(text: string): string {
      return text.replace(/[<>]/g, '').replace(/script/gi, '').substring(0, 1000);
    }

    // ── Last-resort safe prompt when content violation fires ──────────────
    private buildSafeGenericPrompt(data: VideoJobData): string {
      // Keep only the brand/product name (first ~5 words), drop all descriptors
      const rawBrand = data.brandName?.trim() || '';
      const safeBrand = this.sanitizeForVeo(rawBrand).split(/\s+/).slice(0, 5).join(' ');
      const style     = data.style?.trim() ? `${data.style} style. ` : '';
      const ratio     = data.videoRatio === '9:16' ? 'Vertical portrait framing. ' : 'Widescreen cinematic framing. ';

      return [
        'Language: English only.',
        '',
        `**SCENE:**`,
        `${ratio}${style}A clean, professional product showcase.`,
        safeBrand ? `Brand: ${safeBrand}.` : '',
        'Smooth camera movement. Neutral background. Studio lighting.',
        'No people, no text, no logos. Cinematic quality.',
      ].filter(Boolean).join('\n').trim();
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


    // ============================================
// TTS AUDIO MERGE
// ============================================
private async processTTSAudio(
  job: Job<VideoJobData>,
  currentGcsPath: string,
): Promise<string> {
  const { scriptPairs } = job.data;

  this.logger.log(`[${job.id}] scriptPairs count: ${scriptPairs?.length}`);

  const validPairs = (scriptPairs ?? []).filter(
    p => (p.narrator || p.voiceOver || '').trim()
  );
this.logger.log(`[${job.id}] validPairs: ${validPairs.length} | pairs data: ${JSON.stringify(scriptPairs?.map(p => ({ vo: p.voiceOver, nar: p.narrator })))}`);

  if (!validPairs.length) {
    this.logger.log(`[${job.id}] ⏭️ TTS skipped — no narrator text`);
    return currentGcsPath;
  }

  const lockedVoice = validPairs[0]?.narratorGender 
  ?? job.data.voiceGender      
  ?? 'female';                   
  const audioDelay  = 2; // 2s silence before voice starts

  this.logger.log(`[${job.id}] 🎙️ TTS starting | voice: ${lockedVoice.substring(0, 30)}...`);
  await this.updateProgress(job, 88, 'Generating voiceover audio...');

  // ─── Step 1: Generate TTS per segment + measure real durations ──────
  let cursor = audioDelay; // starts after 2s silence
  const segmentAudioPaths: string[] = [];
  const realSubtitlePairs: Array<{
    voiceOver: string;
    subtitleStart: number;
    subtitleEnd: number;
  }> = [];

  for (const pair of validPairs) {
    const text = (pair.narrator || pair.voiceOver || '').trim();
    if (!text) continue;

    const segAudioPath = await this.videoProcessingService.generateTTSAudio(
      text,
      lockedVoice,
      `${job.id}-seg${segmentAudioPaths.length}`,
      this.videoService.getOpenAIClient(),
    );

    if (!segAudioPath) {
      this.logger.warn(`[${job.id}] ⚠️ TTS failed for segment — skipping`);
      continue;
    }

    // ✅ Measure REAL duration of this TTS segment
    const segDuration = await this.videoProcessingService.getAudioDuration(segAudioPath);

    // ✅ Real subtitle timing based on actual speech
    realSubtitlePairs.push({
      voiceOver: text,
      subtitleStart: parseFloat(cursor.toFixed(2)),
      subtitleEnd:   parseFloat((cursor + segDuration).toFixed(2)),
    });

    this.logger.log(
      `[${job.id}] 📝 Seg ${segmentAudioPaths.length}: "${text.substring(0, 30)}..." ` +
      `| duration=${segDuration.toFixed(2)}s | start=${cursor.toFixed(2)}s`
    );

    segmentAudioPaths.push(segAudioPath);
    cursor += segDuration + 0.3; // 0.3s gap between segments
  }

  if (!segmentAudioPaths.length) {
    this.logger.warn(`[${job.id}] ⚠️ No TTS segments generated`);
    return currentGcsPath;
  }

  // ─── Step 2: Re-burn subtitles with REAL timings ─────────────────────
  this.logger.log(`[${job.id}] 🔄 Re-burning subtitles with real timings...`);
  await this.updateProgress(job, 90, 'Re-burning subtitles with real timings...');

  try {

    // Re-burn with real timings
   if (job.data.burnSubtitles === true && realSubtitlePairs.length > 0) {
  this.logger.log(`[${job.id}] 📝 burnSubtitles=true → burning subtitles`);

  const videoBufferForSub = await this.downloadVideoSafely(job, currentGcsPath);

  const reSubbedBuffer = await this.videoProcessingService.addOverlays(videoBufferForSub, {
    videoRatio:    job.data.videoRatio || '16:9',
    brandName:     job.data.brandName || 'video',
    burnSubtitles: true,
    voiceOverText: '',
    videoDuration: job.data.videoDuration || '8s',
    subtitlePairs: realSubtitlePairs,
  });

  const reSubFile = this.createMulterFile(reSubbedBuffer, job.data.brandName || 'video');  // ✅ INSIDE if block
  currentGcsPath  = await this.videoService.uploadToGCS(reSubFile, 'generated-videos');
  this.logger.log(`[${job.id}] ✅ Subtitles burned: ${currentGcsPath}`);

} else {
  this.logger.log(`[${job.id}] ⏭️ burnSubtitles=false → voice only, no subtitles`);
}

  } catch (err: any) {
    this.logger.error(`[${job.id}] ❌ Re-subtitle failed: ${err.message} — continuing with old subs`);
  }

  // ─── Step 3: Concatenate silence + all TTS segments ──────────────────
  await this.updateProgress(job, 93, 'Merging audio segments...');

  const totalDuration = job.data.videoDuration === '30s' ? 30
                    : job.data.videoDuration === '15s' ? 15 : 8;

const segmentStartTimes = realSubtitlePairs.map(p => p.subtitleStart);

const mergedAudioPath = await this.videoProcessingService.buildVoiceTrack(
  segmentAudioPaths,
  segmentStartTimes,
  totalDuration,
  job.id,
);


  if (!mergedAudioPath) {
    this.logger.warn(`[${job.id}] ⚠️ Audio concat failed`);
    return currentGcsPath;
  }

  // ─── Step 4: Download video + merge audio ────────────────────────────
  await this.updateProgress(job, 95, 'Merging audio onto video...');

  const videoBuffer = await this.downloadVideoSafely(job, currentGcsPath);
  const fs   = require('fs');
  const path = require('path');
  const os   = require('os');

  const videoLocalPath = path.join(
    os.tmpdir(), 'video-processing', `veo-${job.id}-${Date.now()}.mp4`
  );
  fs.writeFileSync(videoLocalPath, videoBuffer);

  const mergedLocalPath = await this.videoProcessingService.mergeAudioOntoVideo(
    videoLocalPath,
    mergedAudioPath,
    job.id,
    0,  // ✅ no adelay — silence already baked in
  );

  if (!mergedLocalPath) {
    this.logger.warn(`[${job.id}] ⚠️ Audio merge failed — returning video without audio`);
    return currentGcsPath;
  }

  // ─── Step 5: Upload final video ──────────────────────────────────────
  await this.updateProgress(job, 97, 'Uploading final video with audio...');

  const mergedBuffer = fs.readFileSync(mergedLocalPath);
  const mergedFile   = this.createMulterFile(mergedBuffer, job.data.brandName || 'video');
  const finalGcsPath = await this.videoService.uploadToGCS(mergedFile, 'generated-videos');

  try { fs.unlinkSync(mergedLocalPath); } catch {}

  this.logger.log(`[${job.id}] ✅ TTS audio merged: ${finalGcsPath}`);
  return finalGcsPath;
}


  }
