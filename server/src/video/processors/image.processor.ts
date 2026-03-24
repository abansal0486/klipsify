// src/video/processors/image.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed
} from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { VideoService } from '../video.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

const CONFIG = {
  TIMEOUT: 120000,
  CACHE_TTL: 3600,
  PROGRESS: {
    START: 10,
    IMAGE_GENERATED: 50,
    COMPLETE: 100
  }
} as const;

interface ImageJobData {
  userId: string;
  dto: any;
  forRegeneration?: boolean;
}

interface ImageResult {
  success: boolean;
  viewUrl?: string;
  downloadUrl?: string;
  gcsPath?: string;
  error?: string;
  savedImage?: any;
  galleryId?: string;
  totalImages?: number;
  savedAt?: string;
}

@Processor('video-image-generation')
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly videoService: VideoService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Process('generate-image')
  async handleImageGeneration(job: Job<ImageJobData>): Promise<ImageResult> {
    const { userId, dto, forRegeneration = false } = job.data;

    this.logger.log(`🎨 [${job.id}] Processing for user ${userId}`);

    try {
      await this.updateProgress(job, CONFIG.PROGRESS.START, userId, 'processing');

      const result = await this.generateWithTimeout(dto, forRegeneration);

      if (!result.success) {
        throw new Error(result.error || 'Image generation failed');
      }

      await this.updateProgress(job, CONFIG.PROGRESS.IMAGE_GENERATED, userId, 'processing');

      const galleryEntry = await this.saveToGallery(userId, result, dto, forRegeneration);

      const finalResult = this.buildFinalResult(result, galleryEntry);

      await this.updateProgress(job, CONFIG.PROGRESS.COMPLETE, userId, 'completed', finalResult);

      this.logger.log(`✅ [${job.id}] Completed | Gallery: ${galleryEntry._id}`);

      return finalResult;

    } catch (error: any) {
      this.logger.error(`❌ [${job.id}] Failed: ${error.message}`);

      await this.updateJobCache(String(job.id), userId, 'failed', 0, null, error.message);

      if (!forRegeneration) {
        await this.rollbackQuota(userId);
      }

      throw error;
    }
  }

  private async generateWithTimeout(dto: any, forRegeneration: boolean): Promise<ImageResult> {
    const generation = this.videoService.createImageWithGemini(dto, forRegeneration);

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Image generation timeout after ${CONFIG.TIMEOUT / 1000}s. Please try again.`
        ));
      }, CONFIG.TIMEOUT);
    });

    return Promise.race([generation, timeout]) as Promise<ImageResult>;
  }

  private async saveToGallery(
    userId: string, 
    result: ImageResult, 
    dto: any, 
    forRegeneration: boolean
  ) {
    this.logger.log(`💾 Saving to gallery...`);
    const startTime = Date.now();

    const gallery = await this.videoService.saveToGallery(
      userId,
      result.downloadUrl || '',
      result.gcsPath || '',
      forRegeneration,
      dto.brandName || 'image-generated',
      dto.storyboard || '',
      dto.source || 'Product'
    );

    const duration = Date.now() - startTime;
    this.logger.log(`✅ Gallery saved in ${duration}ms`);

    return gallery;
  }

  private buildFinalResult(result: ImageResult, galleryEntry: any): ImageResult {
    const savedImage = galleryEntry.imageUrls.find((img: any) =>
      img.gcsPath === result.gcsPath || img.url === result.downloadUrl
    );

    return {
      ...result,
      savedImage,
      galleryId: galleryEntry._id?.toString(),
      totalImages: galleryEntry.imageUrls?.length || 0,
      savedAt: new Date().toISOString()
    };
  }

  private async updateProgress(
    job: Job<ImageJobData>,
    progress: number,
    userId: string,
    status: 'processing' | 'completed',
    result: any = null
  ): Promise<void> {
      console.log(`⏳ [PROGRESS] Job ${job.id}: ${progress}% (${status})`); // ✅ ADD

    await job.progress(progress);
    await this.updateJobCache(String(job.id), userId, status, progress, result);
  }

  private async rollbackQuota(userId: string): Promise<void> {
    try {
      await this.videoService.rollbackImageLimit(userId);
    } catch (rollbackError: any) {
      this.logger.error(`❌ Rollback failed: ${rollbackError.message}`);
    }
  }

  private async updateJobCache(
  jobId: string,
  userId: string,
  status: 'processing' | 'completed' | 'failed',
  progress: number,
  result: any = null,
  error: string | null = null
): Promise<void> {
  const cacheData = {
    jobId,
    userId,
    type: 'image',
    status,
    progress,
    result,
    error,
    updatedAt: new Date().toISOString(),
  };

  // ✅ LOG 1: Before setting cache
  console.log(`💾 [BEFORE] Setting job:${jobId} = ${status} ${progress}%`);

  try {
    const success = await this.cacheManager.set(`job:${jobId}`, cacheData, CONFIG.CACHE_TTL);
    
    // ✅ LOG 2: After successful set
    console.log(`✅ [CACHE OK] job:${jobId} = ${status} ${progress}% (success: ${success})`);
    
  } catch (cacheError: any) {
    // ✅ LOG 3: Cache failure
    console.error(`❌ [CACHE FAIL] job:${jobId}: ${cacheError.message}`);
    console.error(`❌ Cache stack:`, cacheError.stack);
  }
}


  @OnQueueActive()
  onActive(job: Job<ImageJobData>) {
    this.logger.log(`🔄 [${job.id}] ACTIVE`);
  }

  @OnQueueCompleted()
  async onCompleted(job: Job<ImageJobData>, result: ImageResult) {
    this.logger.log(`✅ [${job.id}] COMPLETED | Images: ${result.totalImages || 0}`);
  }

  @OnQueueFailed()
  async onFailed(job: Job<ImageJobData>, error: Error) {
    this.logger.error(`❌ [${job.id}] FAILED: ${error.message}`);
    
    const { userId } = job.data;
    await this.updateJobCache(String(job.id), userId, 'failed', 0, null, error.message);
  }
}
