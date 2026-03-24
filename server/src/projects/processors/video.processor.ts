// src/projects/processors/video.processor.ts
import { 
  Process, 
  Processor, 
  OnQueueActive, 
  OnQueueCompleted, 
  OnQueueFailed 
} from '@nestjs/bull';
import { Logger, BadRequestException } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from '../schemas/project.schema';
import { ProjectGallery } from '../schemas/project-gallery.schema';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { Readable } from 'stream';
import { User } from '../../users/schemas/user.schema';
import { ProjectProcessingService } from '../project.processing.service';

@Processor('video-generation')
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);
  private readonly vertexAI: VertexAI;
  private readonly storage: Storage;

  // ✅ FIX #2: Configuration constants (no more magic numbers!)
  private readonly POLL_INTERVAL_MS = 10000;
  private readonly POLL_MAX_ATTEMPTS = 60;
  private readonly RETRY_BACKOFF_BASE_MS = 5000;
  private readonly URL_RETRY_DELAY_MS = 5000;
  private readonly MAX_VIDEO_SIZE_MB = 500;
  private readonly MAX_URL_RETRIES = 3;
  private readonly MAX_GENERATION_RETRIES = 3;
  private readonly RATE_LIMIT_BACKOFF_MS = 5000;
  private readonly SERVER_ERROR_BACKOFF_MS = 3000;

  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(ProjectGallery.name) private projectGalleryModel: Model<any>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly projectProcessingService: ProjectProcessingService
  ) {
    this.vertexAI = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: 'us-central1',
    });

    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  @Process({
    name: 'generate-video',
    concurrency: 5,
  })
  async handleVideoGeneration(job: Job) {
    const startTime = Date.now();
    const { userId, projectId, project, options, pendingId } = job.data;

    // ✅ FIX #1: Input validation
    if (!userId || !projectId || !project || !options) {
      throw new Error('Invalid job data: missing required fields');
    }

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(projectId)) {
      throw new Error('Invalid userId or projectId format');
    }

    if (!pendingId) {
      this.logger.warn(`⚠️ [Job ${job.id}] Missing pendingId`);
    }

    this.logger.log(`🎬 [Job ${job.id}] Starting video generation for project: ${projectId}`);
    this.logger.log(`📋 [Job ${job.id}] PendingId: ${pendingId}`);

    try {
      // ============================================
      // STEP 0: CHECK LIMITS
      // ============================================
      await job.progress(10);

      const limitCheck = await this.checkVideoLimit(userId);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message || 'Video generation limit exceeded');
      }

      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // this.logger.log(`👤 [Job ${job.id}] User Plan: ${user.currentPlanName || 'free'}`);

      // ============================================
      // STEP 1: BUILD VIDEO PROMPT
      // ============================================
      const videoPrompt = this.buildVideoPrompt(project, options, user);

      await job.progress(20);

      // ============================================
      // STEP 2: PREPARE REFERENCES (LOGO + IMAGES)
      // ============================================
      let logoGcsUri: string | null = null;
      if (options.useLogo && project.logoGcsPath) {
        logoGcsUri = project.logoGcsPath;
      }

      let referenceImages: string[] = [];
      if (project.mediaFiles?.length) {
        referenceImages = project.mediaFiles
          .filter((m: any) => m.type === 'image')
          .map((m: any) => `gs://${process.env.GCP_BUCKET_NAME}/${m.gcsPath}`);
      }

      if (options.referenceImages?.length) {
        referenceImages.push(...options.referenceImages);
      }

      referenceImages = [...new Set(referenceImages)];
      this.logger.log(`📷 [Job ${job.id}] Reference images: ${referenceImages.length}`);

      await job.progress(30);

      // ============================================
      // STEP 3: GENERATE VIDEO WITH VEO (WITH RETRIES)
      // ============================================
      let videoResult: any = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= this.MAX_GENERATION_RETRIES; attempt++) {
        try {
          this.logger.log(`🎬 [Job ${job.id}] Generation attempt ${attempt}/${this.MAX_GENERATION_RETRIES}`);

          const { operationName, startTimestamp } = await this.generateVideoUsingVeo3(
            videoPrompt,
            options.videoRatio || '16:9',
            logoGcsUri,
            referenceImages,
            job
          );

          videoResult = await this.pollVideoCompletion(
            operationName,
            startTimestamp,
            project.brandName,
            job,
          );

          this.logger.log(`✅ [Job ${job.id}] Video generated successfully`);
          break;

        } catch (err) {
          lastError = err;
          this.logger.error(`❌ [Job ${job.id}] Attempt ${attempt} failed: ${err.message}`);

          if (attempt === this.MAX_GENERATION_RETRIES) {
            this.logger.error(`🔥 [Job ${job.id}] All retry attempts exhausted`);
            break;
          }

          // Exponential backoff: 5s, 10s, 20s
          const backoffMs = Math.min(
            this.RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1), 
            30000
          );
          this.logger.warn(`⏳ [Job ${job.id}] Retrying in ${backoffMs / 1000}s...`);
          await job.progress(30 + (attempt * 5));
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }

      if (!videoResult) {
        throw lastError || new Error('Video generation failed after retries');
      }

      await job.progress(70);

      // ============================================
      // STEP 4: ADD OVERLAYS (IF NEEDED)
      // ============================================
      let overlayWarning: string | undefined;  // ✅ FIX #3: Track overlay status

      if (options.useLogo || options.useSlogan) {
        try {
          this.logger.log(`🎨 [Job ${job.id}] Adding overlays...`);

          const videoBuffer = await this.downloadVideoBuffer(videoResult.gcsPath);

          const processedBuffer = await this.projectProcessingService.addOverlays(videoBuffer, {
            slogan: options.useSlogan ? project.slogan : undefined,
            logoPath: options.useLogo ? project.logoGcsPath : undefined,
            videoRatio: options.videoRatio || '16:9',
            brandName: project.brandName,
          });

          const file: Express.Multer.File = {
            buffer: processedBuffer,
            originalname: `${project.brandName}-processed.mp4`,
            mimetype: 'video/mp4',
            fieldname: '',
            encoding: '',
            size: processedBuffer.length,
            stream: Readable.from(processedBuffer),
            destination: '',
            filename: '',
            path: '',
          };

          const newGcsPath = await this.uploadToGCS(file, 'generated-videos');

          videoResult.gcsPath = newGcsPath;
          videoResult.downloadUrl = `projects/files/download?filename=${encodeURIComponent(newGcsPath)}`;
          videoResult.viewUrl = `projects/files/view?filename=${encodeURIComponent(newGcsPath)}`;

          this.logger.log(`✅ [Job ${job.id}] Overlays added successfully`);
        } catch (overlayError) {
          this.logger.error(`❌ [Job ${job.id}] Overlay failed: ${overlayError.message}`);
          this.logger.warn(`⚠️ [Job ${job.id}] Continuing with original video`);

          // ✅ FIX #3: Inform user about overlay failure
          overlayWarning = 'Video generated successfully, but logo/slogan overlay failed. Using original video.';
        }
      }

      await job.progress(90);

      // ============================================
      // STEP 5: SAVE TO GALLERY
      // ============================================
      await this.addToProjectGallery(userId, projectId, 'video', {
        url: videoResult.gcsPath,
        viewUrl: videoResult.viewUrl,
        downloadUrl: videoResult.downloadUrl,
      });

      await job.progress(95);

      // ============================================
      // STEP 6: INCREMENT USAGE
      // ============================================
      await this.incrementVideoUsage(userId, projectId, project.brandName, {
        gcsPath: videoResult.gcsPath,
        viewUrl: videoResult.viewUrl,
        downloadUrl: videoResult.downloadUrl,
        filename: videoResult.filename,
      });

      // ============================================
      // STEP 7: UPDATE PROJECT CONVERSATION
      // ============================================
      await this.updateProjectWithVideoCompletion(
        projectId,
        pendingId,
        videoResult,
        project.brandName,
        overlayWarning,  // ✅ FIX #3: Pass overlay warning
      );

      await job.progress(100);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`🎉 [Job ${job.id}] Completed in ${duration}s`);

      // ✅ FIX #3: Include overlay warning in response
      return {
        success: true,
        isPending: false,
        contentType: 'video',
        videoUrl: videoResult.downloadUrl,
        viewUrl: videoResult.viewUrl,
        gcsPath: videoResult.gcsPath,
        downloadUrl: videoResult.downloadUrl,
        filename: videoResult.filename,
        message: `Your video is ready! Watch your video now.${overlayWarning ? ' Note: ' + overlayWarning : ''}`,
        pendingId,
        ...(overlayWarning && { warning: overlayWarning }),
      };

    } catch (error) {
      this.logger.error(`❌ [Job ${job.id}] Video generation failed:`, error.stack);

      // Rollback video limit
      await this.rollbackVideoLimit(userId);

      // Update project with error message
      try {
        await this.updateProjectWithError(projectId, pendingId, this.formatUserError(error));
      } catch (updateError) {
        this.logger.error(`Failed to update project with error:`, updateError);
      }

      throw error;
    }
  }

  private async generateVideoUsingVeo3(
    prompt: string,
    aspectRatio: string,
    logoGcsUri: string | null,
    referenceImages: string[],
    job: Job
  ): Promise<{ operationName: string; startTimestamp: string }> {
    const projectId = process.env.GCP_PROJECT_ID!;
    const location = process.env.GCP_LOCATION || 'us-central1';
    const modelId = 'veo-3.1-fast-generate-001';
    const storageUri = process.env.OUTPUT_STORAGE_URI;

    const chosenReference = referenceImages?.length > 0 ? referenceImages[0] : null;

    const instance: any = { prompt };

    if (chosenReference) {
      instance.image = {
        gcsUri: chosenReference,
        mimeType: 'image/png',
      };
    }

    const payload = {
      instances: [instance],
      parameters: {
        durationSeconds: 8,
        sampleCount: 1,
        aspectRatio,
        ...(storageUri ? { storageUri } : {}),
      },
    };

    this.logger.log(`📤 [Job ${job.id}] Sending Veo API request...`);
    this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const base = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`;
    const token = await this.getGcpAccessToken();

    const https = require('https');
    const httpsAgent = new https.Agent({ keepAlive: true });

    try {
      const startRes = await axios.post(`${base}:predictLongRunning`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        httpsAgent,
        timeout: 60000,
      });

      const operationName: string = startRes.data?.name;

      if (!operationName) {
        throw new Error('Failed to start video generation - no operation name returned');
      }

      this.logger.log(`✅ [Job ${job.id}] Veo operation started: ${operationName}`);

      return {
        operationName,
        startTimestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      this.logger.error(`❌ Veo start error:`, error?.response?.data || error.message);
      throw new Error(this.formatUserError(error));
    } finally {
      httpsAgent.destroy();  // ✅ FIX #4: Cleanup agent
    }
  }

 private async pollVideoCompletion(
    operationName: string,
    startTimestamp: string,
    brandName: string,
    job: Job,
  ): Promise<any> {
    const https = require('https');
    const projectId = process.env.GCP_PROJECT_ID!;
    const location = process.env.GCP_LOCATION || 'us-central1';
    const modelId = 'veo-3.1-fast-generate-001';

    const base = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`;
    const token = await this.getGcpAccessToken();

    const httpsAgent = new https.Agent({ keepAlive: true });

    try {
      let attempts = 0;

      while (attempts < this.POLL_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));

        this.logger.log(`📦 [Job ${job.id}] Polling ${attempts + 1}/${this.POLL_MAX_ATTEMPTS}`);

        const pollRes = await axios.post(
          `${base}:fetchPredictOperation`,
          { operationName },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            httpsAgent,
            timeout: 60000,
          },
        );

        const op = pollRes.data;

        // ============================================
        // CHECK FOR OPERATION ERRORS
        // ============================================
        if (op?.error) {
          const msg = op.error.message || '';
          const code = op.error.code;

          this.logger.error(`🚨 [Job ${job.id}] Veo error [${code}]: ${msg}`);

          // Permanent errors - throw immediately
          const permanentErrors = [
            'INVALID_ARGUMENT',
            'PERMISSION_DENIED',
            'POLICY_VIOLATION',
            'UNAUTHENTICATED'
          ];

          if (permanentErrors.includes(code)) {
            throw new Error(msg);
          }

          // Temporary errors - continue polling
          this.logger.warn(`⏳ [Job ${job.id}] Temporary error, continuing to poll...`);
          attempts++;
          continue;
        }

        // ============================================
        // VIDEO READY - CHECK COMPLETION
        // ============================================
        if (op?.done) {
          this.logger.log(`✅ [Job ${job.id}] Veo generation completed!`);

          // ============================================
          // ✅ NEW: CHECK FOR RAI CONTENT FILTERING
          // ============================================
          if (op?.response?.raiMediaFilteredCount > 0 || op?.response?.raiMediaFilteredReasons) {
            const filterReason = op?.response?.raiMediaFilteredReasons?.[0] || 
              'Content was filtered by Responsible AI guidelines';
            
            let supportCode = null;
            if (filterReason) {
              const match = filterReason.match(/Support codes?:?\s*([\d]+)/i);
              supportCode = match ? match[1] : null;
            }
            
            this.logger.error(`🚫 [Job ${job.id}] Content filtered by RAI (Responsible AI)`);
            this.logger.error(`📋 [Job ${job.id}] Filter reason: ${filterReason}`);
            this.logger.error(`🔢 [Job ${job.id}] Support code: ${supportCode || 'N/A'}`);
            this.logger.error(`📊 [Job ${job.id}] Filter count: ${op?.response?.raiMediaFilteredCount || 1}`);
            
            // ✅ Throw error with user-friendly message
            const errorMsg = 
              `Content Policy Violation: Your video was blocked by AI safety filters. ` +
              `The content may contain words or concepts that violate usage guidelines. ` +
              `Please rephrase your prompt with family-friendly language and try again.` +
              (supportCode ? ` (Support Code: ${supportCode})` : '');
            
            throw new Error(errorMsg);
          }

          // ============================================
          // CHECK FOR VIDEO DATA
          // ============================================
          const videos = op?.response?.videos;
          const first = videos?.[0];

          if (!first) {
            this.logger.error(`❌ [Job ${job.id}] No video in response!`);
            this.logger.error(`📦 [Job ${job.id}] Full response: ${JSON.stringify(op?.response, null, 2)}`);
            throw new Error('Video generation completed but no videos were returned');
          }

          // ============================================
          // HANDLE GCS URI RESPONSE
          // ============================================
          if (first.gcsUri) {
            try {
              const result = await this.downloadAndUploadVideoFromGcs(first.gcsUri, brandName);

              if (!result.gcsPath) {
                this.logger.warn(`⚠️ [Job ${job.id}] GCS path missing, retrying...`);
                return await this.retryUrlFetch(job, operationName, startTimestamp, brandName);
              }

              return result;
            } catch (downloadError) {
              this.logger.warn(`⚠️ [Job ${job.id}] Download failed, retrying URL fetch...`);
              return await this.retryUrlFetch(job, operationName, startTimestamp, brandName);
            }
          }

          // ============================================
          // HANDLE BASE64 RESPONSE
          // ============================================
          if (first.bytesBase64Encoded && first.mimeType) {
            const buffer = Buffer.from(first.bytesBase64Encoded, 'base64');
            const extension = first.mimeType.split('/')[1] || 'mp4';

            const file: Express.Multer.File = {
              buffer,
              originalname: `${brandName}-video-${Date.now()}.${extension}`,
              mimetype: first.mimeType,
              fieldname: '',
              encoding: '',
              size: buffer.length,
              stream: Readable.from(buffer),
              destination: '',
              filename: '',
              path: '',
            };

            const gcsPath = await this.uploadToGCS(file, 'generated-videos');
            const downloadUrl = `projects/files/download?filename=${encodeURIComponent(gcsPath)}`;
            const viewUrl = `projects/files/view?filename=${encodeURIComponent(gcsPath)}`;

            return {
              gcsPath,
              downloadUrl,
              viewUrl,
              filename: `${brandName}.mp4`,
            };
          }

          throw new Error('Video generation completed but video data is not accessible');
        }

        // ============================================
        // STILL PROCESSING - UPDATE PROGRESS
        // ============================================
        const progress = 40 + (attempts / this.POLL_MAX_ATTEMPTS) * 55;
        await job.progress(Math.min(progress, 95));

        this.logger.log(`⏳ [Job ${job.id}] Video still processing...`);
        attempts++;
      }

      throw new Error(`Video generation timeout after ${this.POLL_MAX_ATTEMPTS * this.POLL_INTERVAL_MS / 1000} seconds`);

    } catch (error: any) {
      // Handle rate limits
      if (error?.response?.status === 429) {
        this.logger.warn(`⚠️ [Job ${job.id}] Rate limited, waiting longer...`);
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_BACKOFF_MS));
        throw error; // Re-throw to trigger retry
      }

      // Handle server errors
      if (error?.response?.status >= 500) {
        this.logger.warn(`⚠️ [Job ${job.id}] Server error ${error.response.status}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, this.SERVER_ERROR_BACKOFF_MS));
        throw error; // Re-throw to trigger retry
      }

      throw error;

    } finally {
      httpsAgent.destroy();
    }
  }


  private async retryUrlFetch(
    job: Job,
    operationName: string,
    startTimestamp: string,
    brandName: string
  ): Promise<any> {
    this.logger.warn(`⚠️ [Job ${job.id}] Video URL missing, retrying...`);

    for (let retry = 0; retry < this.MAX_URL_RETRIES; retry++) {
      this.logger.log(`🔄 [Job ${job.id}] URL retry ${retry + 1}/${this.MAX_URL_RETRIES}`);

      await new Promise(resolve => setTimeout(resolve, this.URL_RETRY_DELAY_MS));  // ✅ FIX #2: Use constant

      try {
        const retryResult = await this.pollVideoCompletion(
          operationName,
          startTimestamp,
          brandName,
          job
        );

        if (retryResult.gcsPath) {
          this.logger.log(`✅ [Job ${job.id}] Video URL found on retry ${retry + 1}`);
          return retryResult;
        }
      } catch (error) {
        this.logger.warn(`⚠️ [Job ${job.id}] Retry ${retry + 1} failed: ${error.message}`);
      }
    }

    throw new Error('Video URL not found after all retries');
  }

  /**
 * ✅ Build video prompt (minimal & clean structure, simple watermark)
 */
private buildVideoPrompt(project: any, options: any, user: any): string {
  // ✅ Detect language
  const isHebrew = 
    this.containsHebrew(options.storyboard) || 
    this.containsHebrew(options.voiceOverText) ||
    this.containsHebrew(project.slogan);

  let prompt = '';

  if (isHebrew) {
    // ============================================
    // HEBREW PROMPT
    // ============================================
    prompt += 'שפה: עברית בלבד. אין להשתמש באנגלית. כל הפלט חייב להיות בעברית.\n\n';
    prompt += `**תיאור הסצנה:**\n${options.storyboard?.trim() || ''}\n\n`;

    // Voice-over (if exists)
    if (options.voiceOverText?.trim()) {
      prompt += `**אודיו וקריינות:**\n`;
      prompt += `- קריין מקצועי דובר עברית כשפת אם\n`;
      prompt += `- טקסט: "${options.voiceOverText.trim()}"\n\n`;
    }

    // Aesthetics & Style
    if (project.style?.trim() || project.brandName || project.niche) {
      prompt += `**סגנון חזותי ואווירה:**\n`;
      if (project.brandName) {
        prompt += `- מותג: ${project.brandName}\n`;
      }
      if (project.niche) {
        prompt += `- נישה: ${project.niche}\n`;
      }
      if (project.style?.trim()) {
        prompt += `- סגנון: ${project.style.trim()}\n`;
      }
      prompt += `- צבעים, תאורה ומצב רוח תואמים לנושא\n\n`;
    }

    // Background (if exists)
    if (options.backgroundReference?.trim()) {
      prompt += `- רקע/סביבה: ${options.backgroundReference.trim()}\n\n`;
    }

    // Camera angle (if exists)
    if (options.cameraAngle?.trim()) {
      prompt += `**הנחיות מצלמה:** ${options.cameraAngle.trim()}\n\n`;
    }

    // Free user watermark (simple)
    if (user.currentPlanName === 'free') {
      prompt += `**סימן מים:**\n- הצב סימן מים "CLIPSYFY" בפינה הימנית התחתונה\n\n`;
    }

    // Logo & Slogan (if exists)
    if (options.useLogo || options.useSlogan) {
      prompt += `**הערות הפקה:**\n`;
      prompt += `- צור סרטון מקצועי וקולנועי עם תנועות מצלמה חלקות\n`;
      
      if (options.useLogo && project.brandName) {
        prompt += `- **לוגו:** הצג לוגו "${project.brandName}" בצורה בולטת לאורך הסרטון\n`;
      }
      if (options.useSlogan && project.slogan) {
        prompt += `- **כיתוב טקסט:** הצג "${project.slogan}" בבירור בסוף הסרטון\n`;
      }
      prompt += '\n';
    }

    // Final checks
    prompt += `**חובה — ללא טקסט נוסף:**\n- רק סימן המים CLIPSYFY מותר\n\n`;
    prompt += `**בדיקה סופית:** תאורה קולנועית, תנועה חלקה, איכות מקצועית גבוהה.`;

  } else {
    // ============================================
    // ENGLISH PROMPT
    // ============================================
    prompt += 'Language: English only. All output must remain in English.\n\n';
    prompt += `**SCENE DESCRIPTION:**\n${options.storyboard?.trim() || ''}\n\n`;

    // Voice-over (if exists)
    if (options.voiceOverText?.trim()) {
      prompt += `**AUDIO & NARRATION:**\n`;
      prompt += `- Native English professional voiceover\n`;
      prompt += `- Script: "${options.voiceOverText.trim()}"\n\n`;
    }

    // Aesthetics & Style
    if (project.style?.trim() || project.brandName || project.niche) {
      prompt += `**VISUAL STYLE & THEME:**\n`;
      if (project.brandName) {
        prompt += `- Brand: ${project.brandName}\n`;
      }
      if (project.niche) {
        prompt += `- Niche: ${project.niche}\n`;
      }
      if (project.style?.trim()) {
        prompt += `- Style: ${project.style.trim()}\n`;
      }
      prompt += `- Apply matching colors, lighting, and mood\n\n`;
    }

    // Background (if exists)
    if (options.backgroundReference?.trim()) {
      prompt += `- Setting/Background: ${options.backgroundReference.trim()}\n\n`;
    }

    // Camera angle (if exists)
    if (options.cameraAngle?.trim()) {
      prompt += `**CAMERA DIRECTION:** ${options.cameraAngle.trim()}\n\n`;
    }

    // Free user watermark (simple)
    if (user.currentPlanName === 'free') {
      prompt += `**WATERMARK OVERLAY:**\n- Place "CLIPSYFY" watermark bottom-right\n\n`;
    }

    // Logo & Slogan (if exists)
    if (options.useLogo || options.useSlogan) {
      prompt += `**PRODUCTION NOTES:**\n`;
      prompt += `- Create a professional, highly cinematic video with dynamic, smooth camera movements\n`;
      
      if (options.useLogo && project.brandName) {
        prompt += `- **LOGO:** Display the brand logo "${project.brandName}" prominently and consistently throughout the video\n`;
      }
      if (options.useSlogan && project.slogan) {
        prompt += `- **TEXT OVERLAY:** Display the text "${project.slogan}" clearly on screen at the end of the video\n`;
      }
      prompt += '\n';
    }

    // Final checks
    prompt += `**MANDATORY - NO OTHER TEXT:**\n- Only CLIPSYFY watermark allowed\n\n`;
    prompt += `**FINAL VISUAL CHECK:** Cinematic lighting, professional quality.`;
  }

  return prompt.trim();
}

/**
 * ✅ Check if text contains Hebrew characters
 */
private containsHebrew(text?: string): boolean {
  if (!text) return false;
  return /[\u0590-\u05FF]/.test(text);
}


  private async downloadVideoBuffer(gcsPath: string): Promise<Buffer> {
    const bucket = this.storage.bucket(process.env.GCP_BUCKET_NAME!);
    const file = bucket.file(gcsPath);

    const [buffer] = await file.download();

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    this.logger.log(`📥 Downloaded video: ${sizeMB}MB`);

    // ✅ FIX #2: Use constant for max size
    const maxBytes = this.MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(`Video size (${sizeMB}MB) exceeds maximum (${this.MAX_VIDEO_SIZE_MB}MB)`);
    }

    return buffer;
  }

  private async getGcpAccessToken(): Promise<string> {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('Failed to obtain GCP access token');
    return token;
  }

  private async uploadToGCS(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    const bucketName = process.env.GCP_BUCKET_NAME!;
    const bucket = this.storage.bucket(bucketName);

    const timestamp = Date.now();
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${folder}/${timestamp}-${cleanOriginalName}`;
    const blob = bucket.file(filename);

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    this.logger.log(`✅ Uploaded to GCS: ${filename}`);
    return filename;
  }

  private async downloadAndUploadVideoFromGcs(gcsUri: string, brandName: string): Promise<any> {
    const matches = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);

    if (!matches) {
      throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }

    const [, sourceBucketName, sourceFilePath] = matches;

    this.logger.log(`📥 Downloading from GCS: ${sourceBucketName}/${sourceFilePath}`);

    const sourceBucket = this.storage.bucket(sourceBucketName);
    const sourceFile = sourceBucket.file(sourceFilePath);
    const [buffer] = await sourceFile.download();

    const targetBucketName = process.env.GCP_BUCKET_NAME!;
    const targetBucket = this.storage.bucket(targetBucketName);
    const timestamp = Date.now();
    const filename = `generated-videos/${timestamp}-${brandName.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    const targetBlob = targetBucket.file(filename);

    await targetBlob.save(buffer, {
      contentType: 'video/mp4',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    this.logger.log(`✅ Video uploaded to: ${filename}`);

    const gcsPath = filename;
    const downloadUrl = `projects/files/download?filename=${encodeURIComponent(gcsPath)}`;
    const viewUrl = `projects/files/view?filename=${encodeURIComponent(gcsPath)}`;

    return {
      gcsPath,
      downloadUrl,
      viewUrl,
      filename: `${brandName}-video.mp4`,
    };
  }

  private async addToProjectGallery(
    userId: string,
    projectId: string,
    type: 'video',
    media: { url: string; viewUrl?: string; downloadUrl?: string },
  ) {
    const baseIds = {
      userId: new Types.ObjectId(userId),
      projectId: new Types.ObjectId(projectId),
    };

    const mediaItem = {
      url: media.url,
      viewUrl: media.viewUrl ?? media.url,
      downloadUrl: media.downloadUrl ?? media.url,
      createdAt: new Date(),
    };

    return await this.projectGalleryModel.findOneAndUpdate(
      baseIds,
      {
        $setOnInsert: baseIds,
        $push: { videoUrls: mediaItem },
      },
      {
        new: true,
        upsert: true,
      },
    );
  }

  private async checkVideoLimit(userId: string): Promise<{ allowed: boolean; remaining: number; message?: string }> {
    try {
      const user = await this.userModel.findById(userId);

      if (!user) {
        return { allowed: false, remaining: 0, message: 'User not found' };
      }

      // const videoLimit = user.currentLimits?.videoLimit || 4;
      // const videosUsed = user.monthlyUsage?.videos || 0;

      const videoLimit =  4;
      const videosUsed = 0;

      this.logger.log(`📊 Video Limit Check: ${videosUsed}/${videoLimit} used`);

      if (videosUsed >= videoLimit) {
        return {
          allowed: false,
          remaining: 0,
          message: `Video generation limit reached. You've used ${videosUsed}/${videoLimit} videos this month. Please upgrade your plan.`
        };
      }

      return {
        allowed: true,
        remaining: videoLimit - videosUsed
      };
    } catch (error) {
      this.logger.error('Error checking video limit:', error);
      return { allowed: false, remaining: 0, message: 'Error checking limits' };
    }
  }

  private async incrementVideoUsage(
    userId: string,
    projectId: string,
    brandName: string,
    videoData: { gcsPath: string; viewUrl: string; downloadUrl: string; filename: string }
  ) {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'monthlyUsage.videos': 1 }
      });

      this.logger.log(`✅ Video usage tracked for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to track video usage:', error);
    }
  }

  private async rollbackVideoLimit(userId: string): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'monthlyUsage.videos': -1 },
      });
      this.logger.log(`✅ Rolled back video limit for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to rollback video limit: ${error.message}`);
    }
  }

  private async updateProjectWithVideoCompletion(
    projectId: string,
    pendingId: string,
    videoResult: any,
    brandName: string,
    overlayWarning?: string,  // ✅ FIX #3: Add overlay warning parameter
  ) {
    try {
      this.logger.log(`📝 Updating conversation for video pendingId: ${pendingId}`);

      const project = await this.projectModel.findById(projectId);

      if (!project) {
        this.logger.warn(`⚠️ Project ${projectId} not found for completion update`);
        return;
      }

      if (!project.aiConversationLog) {
        project.aiConversationLog = [];
      }

      const pendingMsgIndex = project.aiConversationLog.findIndex(
        (msg: any) => msg.metadata?.pendingId === pendingId
      );

      // ✅ FIX #3: Include overlay warning in message
      let completionContent = 
        `✅ **Your video is ready!**\n\n` +
        `[▶️ Watch your video](${videoResult.viewUrl})\n\n` +
        `**Video Details:**\n` +
        `- Brand: ${brandName}\n` +
        `- Duration: 8 seconds\n` +
        `- Format: MP4\n\n` +
        `[📥 Download Video](${videoResult.downloadUrl})`;

      if (overlayWarning) {
        completionContent += `\n\n⚠️ **Note:** ${overlayWarning}`;
      }

      if (pendingMsgIndex !== -1) {
        this.logger.log(`✅ Found pending video message at index ${pendingMsgIndex}, updating...`);

        project.aiConversationLog[pendingMsgIndex].metadata.status = 'completed';
        project.aiConversationLog[pendingMsgIndex].content = completionContent;
        project.aiConversationLog[pendingMsgIndex].metadata.videoUrl = videoResult.downloadUrl;
        project.aiConversationLog[pendingMsgIndex].metadata.viewUrl = videoResult.viewUrl;
        project.aiConversationLog[pendingMsgIndex].metadata.gcsPath = videoResult.gcsPath;
        project.aiConversationLog[pendingMsgIndex].metadata.mediaPreview = {
          type: 'video',
          url: videoResult.viewUrl,
          downloadUrl: videoResult.downloadUrl,
          thumbnail: videoResult.viewUrl,
        };

        if (overlayWarning) {
          project.aiConversationLog[pendingMsgIndex].metadata.overlayWarning = overlayWarning;
        }

        this.logger.log(`✅ Updated existing pending video message to completed`);
      } else {
        this.logger.warn(`⚠️ Pending video message not found for pendingId: ${pendingId}, adding new message`);

        const completionMessage = {
          role: 'assistant' as const,
          content: completionContent,
          timestamp: new Date(),
          metadata: {
            type: 'video_completed',
            status: 'completed',
            contentType: 'video',
            pendingId: pendingId,
            videoUrl: videoResult.downloadUrl,
            viewUrl: videoResult.viewUrl,
            gcsPath: videoResult.gcsPath,
            ...(overlayWarning && { overlayWarning }),
            mediaPreview: {
              type: 'video',
              url: videoResult.viewUrl,
              downloadUrl: videoResult.downloadUrl,
              thumbnail: videoResult.viewUrl,
            },
          },
        };

        project.aiConversationLog.push(completionMessage);
      }

      project.markModified('aiConversationLog');
      await project.save();

      this.logger.log(`✅ Video completion saved to conversation log for ${brandName}`);
    } catch (error) {
      this.logger.error('❌ Failed to update project with video completion:', error);
    }
  }

  private async updateProjectWithError(projectId: string, pendingId: string, errorMessage: string) {
    try {
      this.logger.log(`📝 Updating conversation with error for pendingId: ${pendingId}`);

      const project = await this.projectModel.findById(projectId);

      if (!project) {
        return;
      }

      if (!project.aiConversationLog) {
        project.aiConversationLog = [];
      }

      const pendingMsgIndex = project.aiConversationLog.findIndex(
        (msg: any) => msg.metadata?.pendingId === pendingId
      );

      if (pendingMsgIndex !== -1) {
        project.aiConversationLog[pendingMsgIndex].metadata.status = 'failed';
        project.aiConversationLog[pendingMsgIndex].content =
          `❌ **Video generation failed**\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.`;
      } else {
        const errorMsg = {
          role: 'assistant' as const,
          content: `❌ **Video generation failed**\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
          timestamp: new Date(),
          metadata: {
            type: 'video-error',
            status: 'failed',
            contentType: 'video',
            pendingId: pendingId,
            error: errorMessage,
          },
        };

        project.aiConversationLog.push(errorMsg);
      }

      project.markModified('aiConversationLog');
      await project.save();

      this.logger.log(`✅ Error message saved to conversation`);
    } catch (error) {
      this.logger.error('Failed to update project with error:', error);
    }
  }

  private formatUserError(err: any): string {
    const msg = (err?.message || '').toLowerCase();

    if (msg.includes('policy')) {
      return '🚫 Your video violates safety rules. Please change the script.';
    }

    if (msg.includes('timeout')) {
      return '⏱ Video generation timed out. Please try again.';
    }

    if (msg.includes('limit')) {
      return err.message;
    }

    return '❌ Video generation failed. Please try again.';
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`🎬 Processing video job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`✅ Video job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Video job ${job.id} failed: ${error.message}`);
  }
}
