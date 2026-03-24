// src/video/video.service.ts
import { Inject, Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as os from 'os';
import * as fs from "fs";
import * as path from "path";
import * as https from 'https';
import OpenAI from "openai";
import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { Storage } from "@google-cloud/storage";
import { GoogleGenAI, FinishReason } from '@google/genai';
import puppeteer from 'puppeteer';
import * as ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { Readable } from "stream";
import * as dotenv from "dotenv";
const sharp = require('sharp');
import mongoose from "mongoose";

import { CreateVideoDto } from "./dto/video.dto";
import { Gallery } from "./schema/gallery.schema";
import { User, UserDocument } from "src/users/schemas/user.schema";
import {Subscription, SubscriptionDocument} from "src/subscriptions/schemas/subscription.schema";

ffmpeg.setFfmpegPath(ffmpegPath);
dotenv.config();

const CONFIG = {
  GCP: {
    PROJECT_ID: process.env.GCP_PROJECT_ID!,
    LOCATION: process.env.GCP_LOCATION || "us-central1",
    BUCKET: process.env.GCP_BUCKET_NAME!,
    OUTPUT_URI: process.env.OUTPUT_STORAGE_URI,
  },
  MODELS: {
    VEO: "veo-3.1-fast-generate-001",
    GEMINI_IMAGE: "gemini-2.5-flash-image",
  },
  TIMEOUTS: {
    IMAGE_GENERATION: 120000,
    VIDEO_GENERATION: 600000,
    GCS_OPERATION: 60000,
    SCRAPING: 30000,
    ASSISTANT_POLL_MAX: 30,
  },
  CACHE_TTL: {
    JOB_STATUS: 3600,
    VIDEO_JOB: 7200,
  },
  QUEUE: {
    IMAGE_ATTEMPTS: 3,
    VIDEO_ATTEMPTS: 1,
    BACKOFF_DELAY: 3000,
  },
  MEDIA: {
    MAX_RETRIES: 3,
    VALID_IMAGE_EXTS: ['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif'],
    VALID_IMAGE_MIMES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    UNSUPPORTED_FORMATS: ['image/svg+xml', 'image/avif', 'image/x-icon'],
    MAX_IMAGES: 5,
  },
  VIDEO: {
    DURATION: 8,
    SAMPLE_COUNT: 1,
    MAX_POLL_TIME: 180000,
    POLL_INTERVAL: 5000,
  },
  ASPECT_RATIOS: {
    VALID: ['21:9', '16:9', '4:3', '3:2', '1:1', '9:16', '3:4', '2:3', '9:21'],
    MAPPINGS: {
      'landscape': '16:9',
      'portrait': '9:16',
      'square': '1:1',
      'widescreen': '21:9',
      'standard': '4:3'
    }
  }
} as const;

export interface DomainInfo {
  brandName: string;
  slogan: string;
  products: string;
  logoUrl: string;
  imageUrls: string[];
}

interface LimitCheck {
  allowed: boolean;
  remaining: number;
  message?: string;
}

export interface ScriptVoPair {
  script: string;
  voiceOver: string;
  narratorGender?: 'male' | 'female';
  subtitleStart?: number;   // ✅ when this segment's subtitle starts (seconds)
  subtitleEnd?: number;     // ✅ when it ends (seconds)
}


@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private readonly geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  private storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: CONFIG.GCP.PROJECT_ID,
  });

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Gallery.name) private readonly galleryModel: Model<Gallery>,
    @InjectModel(Subscription.name) private subscription: Model<SubscriptionDocument>,
    @InjectQueue('video-image-generation') private imageQueue: Queue,
    @InjectQueue('video-video-generation') private videoQueue: Queue,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

 async checkAndDecrementVideoLimit(userId: string): Promise<LimitCheck> {
  try {
    const user = await this.subscription.findOne({
  userId: mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId,
});
    if (!user) return { allowed: false, remaining: 0, message: 'User not found' };
 
    const videoLimit =   user.currentLimits?.videoLimit || 0;
    const videosUsed =  user.monthlyUsage?.videos || 0;
    

    if (videosUsed >= videoLimit) {
      return {
        allowed: false,
        remaining: 0,
        message: `Video limit reached: ${videosUsed}/${videoLimit}. Upgrade your plan.`
      };
    }

    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { 'monthlyUsage.videos': 1 }
    });

    return { allowed: true, remaining: videoLimit - videosUsed - 1 };
  } catch (error: any) {
    this.logger.error(`Video limit check failed: ${error.message}`);
    return { allowed: false, remaining: 0, message: 'Error checking limits' };
  }
}

async checkAndDecrementImageLimit(userId: string): Promise<LimitCheck> {
  try {
    const user = await this.subscription.findOne({
  userId: mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId,
});
    if (!user) return { allowed: false, remaining: 0, message: 'User not found' };

    const imageLimit = user.currentLimits?.imageLimit || 0;
    const imagesUsed = user.monthlyUsage?.images || 0;

      // const imageLimit =  0;
      // const imagesUsed =  0;

    if (imagesUsed >= imageLimit) {
      return {
        allowed: false,
        remaining: 0,
        message: `Image limit reached: ${imagesUsed}/${imageLimit}. Upgrade your plan.`
      };
    }

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { 'monthlyUsage.images': 1 } },
      { new: true }
    );

    if (!updated) {
      return { allowed: false, remaining: 0, message: 'Failed to update usage' };
    }

    return { 
      allowed: true, 
      remaining: imageLimit - 0 // (updated.monthlyUsage?.images || 0)
    };
  } catch (error: any) {
    this.logger.error(`Image limit check failed: ${error.message}`);
    return { allowed: false, remaining: 0, message: 'Error checking limits' };
  }
}


  async rollbackImageLimit(userId: string): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'monthlyUsage.images': -1 },
      });
    } catch (error: any) {
      this.logger.error(`Rollback image limit failed: ${error.message}`);
    }
  }

  async rollbackVideoLimit(userId: string): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'monthlyUsage.videos': -1 },
      });
    } catch (error: any) {
      this.logger.error(`Rollback video limit failed: ${error.message}`);
    }
  }

  async queueImageGeneration(userId: string, dto: any) {
    try {
      let remaining: number | undefined;

      if (!dto.forRegeneration) {
        const limitCheck = await this.checkAndDecrementImageLimit(userId);
        if (!limitCheck.allowed) {
          throw new Error(limitCheck.message || 'Image limit exceeded');
        }
        remaining = limitCheck.remaining;
      }

      const job = await this.imageQueue.add(
        'generate-image',
        { userId, dto, forRegeneration: dto.forRegeneration || false },
        {
          attempts: CONFIG.QUEUE.IMAGE_ATTEMPTS,
          backoff: { type: 'exponential', delay: CONFIG.QUEUE.BACKOFF_DELAY },
          timeout: CONFIG.TIMEOUTS.IMAGE_GENERATION,
        },
      );

      await this.cacheManager.set(
        `job:${job.id}`,
        {
          userId,
          type: 'image',
          status: 'queued',
          createdAt: new Date().toISOString(),
          brandName: dto.brandName,
          source: dto.source,
        },
        CONFIG.CACHE_TTL.JOB_STATUS,
      );

      this.logger.log(`✅ Image job queued: ${job.id}`);

      return { jobId: job.id, status: 'queued', remaining };
    } catch (error: any) {
      this.logger.error(`Queue image failed: ${error.message}`);
      throw error;
    }
  }

  async queueVideoGeneration(userId: string, videoData: any) {
    try {
      const limitCheck = await this.checkAndDecrementVideoLimit(userId);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message || 'Video limit exceeded');
      }

      const job = await this.videoQueue.add(
        'generate-video',
        { userId, ...videoData },
        {
          attempts: CONFIG.QUEUE.VIDEO_ATTEMPTS,
          backoff: { type: 'exponential', delay: 5000 },
          timeout: CONFIG.TIMEOUTS.VIDEO_GENERATION,
        },
      );

      await this.cacheManager.set(
        `job:${job.id}`,
        {
          userId,
          type: 'video',
          status: 'queued',
          createdAt: new Date().toISOString(),
          filename: videoData.filename,
          script: videoData.storyboard,
        },
        CONFIG.CACHE_TTL.VIDEO_JOB,
      );

      this.logger.log(`✅ Video job queued: ${job.id}`);

      return { jobId: job.id, status: 'queued', remaining: limitCheck.remaining };
    } catch (error: any) {
      this.logger.error(`Queue video failed: ${error.message}`);
      throw error;
    }
  }

//   async getJobStatus(userId: string, jobId: string) {
//     try {
//       const cached: any = await this.cacheManager.get(`job:${jobId}`);
    
//     if (cached) {
//       // ✅ If job is processing, cache for LONGER to reduce checks
//       if (cached.status === 'processing' && cached.progress < 100) {
//         const cacheAge = Date.now() - new Date(cached.updatedAt).getTime();
        
//         // If cache is fresh (< 5 seconds), return it immediately
//         if (cacheAge < 5000) {
//           return {
//             success: true,
//             jobId,
//             ...cached,
//             message: 'Processing... (cached)'
//           };
//         }
//       }
      
//       return {
//         success: true,
//         jobId,
//         userId: cached.userId || userId,
//         type: cached.type || 'image',
//         status: cached.status,
//         progress: cached.progress || 0,
//         result: cached.result || null,
//         error: cached.error || null,
//         updatedAt: cached.updatedAt || new Date().toISOString(),
//       };
//     }

//       let job;
//       let type: string = 'image';
      
//       job = await this.imageQueue.getJob(jobId);
//       if (job) {
//         type = 'image';
//       } else {
//         job = await this.videoQueue.getJob(jobId);
//         if (job) type = 'video';
//       }
      
//       if (!job) {
//         throw new Error(`Job ${jobId} not found`);
//       }

//       const state = await job.getState();
//       const progress = (job.progress() as number) || 0;

//       // ✅ FIXED: Don't override completed state
// if (state === 'completed' && progress < 100) {
//   console.log(`⚠️ [COMPLETED] Job ${jobId} has progress ${progress}% - waiting for cache`);
//   await new Promise(resolve => setTimeout(resolve, 1000)); // Wait longer
  
//   const cacheData: any = await this.cacheManager.get(`job:${jobId}`);
//   if (cacheData && cacheData.status === 'completed') {
//     return {
//       success: true,
//       jobId,
//       ...cacheData
//     };
//   }
  
//   // ✅ If cache still not updated, force completed
//   return {
//     success: true,
//     jobId,
//     userId,
//     type,
//     status: 'completed',  // ✅ FIXED!
//     progress: 100,        // ✅ FIXED!
//     result: null,
//     error: null,
//     updatedAt: new Date().toISOString(),
//   };
// }


//       if (state === 'failed') {
//         const error = job.failedReason || 'Job failed';
        
//         await this.cacheManager.set(`job:${jobId}`, {
//           userId,
//           type,
//           status: 'failed',
//           progress: 0,
//           result: null,
//           error: error,
//           updatedAt: new Date().toISOString(),
//         }, 300);
        
//         return {
//           success: true,
//           jobId,
//           userId,
//           type,
//           status: 'failed',
//           progress: 0,
//           result: null,
//           error: error,
//           updatedAt: new Date().toISOString(),
//         };
//       }

//       const processingStates = ['waiting', 'active', 'delayed'];
//       if (processingStates.includes(state)) {
//         const response = {
//           success: true,
//           jobId,
//           userId,
//           type,
//           status: 'processing',
//           progress,
//           result: null,
//           error: null,
//           updatedAt: new Date().toISOString(),
//         };
        
//         await this.cacheManager.set(`job:${jobId}`, response, 30);
//         return response;
//       }

//       // ✅ FIXED: Return completed if Bull Queue says completed
// if (state === 'completed') {
//   console.log(`✅ [COMPLETED] Job ${jobId} - checking cache`);
//   await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
//   const cacheAfterWait: any = await this.cacheManager.get(`job:${jobId}`);
  
//   if (cacheAfterWait) {
//     console.log(`✅ [CACHE FOUND] Job ${jobId}:`, cacheAfterWait.status);
//     return {
//       success: true,
//       jobId,
//       ...cacheAfterWait
//     };
//   }
  
//   // ✅ If no cache, return completed anyway (Bull says it's done)
//   console.log(`⚠️ [NO CACHE] Job ${jobId} - returning completed anyway`);
//   return {
//     success: true,
//     jobId,
//     userId,
//     type,
//     status: 'completed',  // ✅ FIXED!
//     progress: 100,        // ✅ FIXED!
//     result: null,
//     error: null,
//     updatedAt: new Date().toISOString(),
//   };
// }


//       return {
//         success: true,
//         jobId,
//         userId,
//         type,
//         status: 'failed',
//         progress: 0,
//         result: null,
//         error: `Unknown state: ${state}`,
//         updatedAt: new Date().toISOString(),
//       };

//     } catch (error: any) {
//       this.logger.error(`Get job status failed: ${error.message}`);
//       throw error;
//     }
//   }
async getJobStatus(userId: string, jobId: string) {
  try {
    const cached: any = await this.cacheManager.get(`job:${jobId}`);

    // ✅ Cache hit — return immediately (avoid queue lookup)
    if (cached) {
      // For actively processing jobs, skip stale cache < 5s old
      if (cached.status === 'processing' && cached.progress < 100) {
        const cacheAge = Date.now() - new Date(cached.updatedAt).getTime();
        if (cacheAge < 5000) {
          return { success: true, jobId, ...cached, message: 'Processing... (cached)' };
        }
      }
      return {
        success: true,
        jobId,
        userId: cached.userId || userId,
        type: cached.type || 'image',
        status: cached.status,
        progress: cached.progress || 0,
        result: cached.result || null,
        error: cached.error || null,
        updatedAt: cached.updatedAt || new Date().toISOString(),
      };
    }

    // ✅ Cache miss — check Bull queue directly
    let job: any;
    let type = 'image';

    job = await this.imageQueue.getJob(jobId);
    if (!job) {
      job = await this.videoQueue.getJob(jobId);
      if (job) type = 'video';
    }

    if (!job) throw new Error(`Job ${jobId} not found`);

    const state = await job.getState();
    const progress = (job.progress() as number) || 0;

    // ✅ Completed — check cache once (processor writes it), then force-complete
    if (state === 'completed') {
      const cacheData: any = await this.cacheManager.get(`job:${jobId}`);
      if (cacheData?.status === 'completed') {
        return { success: true, jobId, ...cacheData };
      }
      // Processor hasn't written cache yet — return completed anyway
      return {
        success: true, jobId, userId, type,
        status: 'completed', progress: 100,
        result: null, error: null,
        updatedAt: new Date().toISOString(),
      };
    }

    if (state === 'failed') {
      const error = job.failedReason || 'Job failed';
      const failedResponse = {
        userId, type, status: 'failed',
        progress: 0, result: null, error,
        updatedAt: new Date().toISOString(),
      };
      await this.cacheManager.set(`job:${jobId}`, failedResponse, 300);
      return { success: true, jobId, ...failedResponse };
    }

    if (['waiting', 'active', 'delayed'].includes(state)) {
      const processingResponse = {
        success: true, jobId, userId, type,
        status: 'processing', progress,
        result: null, error: null,
        updatedAt: new Date().toISOString(),
      };
      await this.cacheManager.set(`job:${jobId}`, processingResponse, 30);
      return processingResponse;
    }

    return {
      success: true, jobId, userId, type,
      status: 'failed', progress: 0,
      result: null, error: `Unknown state: ${state}`,
      updatedAt: new Date().toISOString(),
    };

  } catch (error: any) {
    this.logger.error(`Get job status failed: ${error.message}`);
    throw error;
  }
}


  private async getGcpAccessToken(): Promise<string> {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Failed to obtain GCP access token");
    return token;
  }

  async uploadToGCS(file: Express.Multer.File, folder = "uploads"): Promise<string> {
    const bucket = this.storage.bucket(CONFIG.GCP.BUCKET);
    const filename = `${folder}/${Date.now()}-${file.originalname}`;
    const blob = bucket.file(filename);

    const stream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    return new Promise((resolve, reject) => {
      stream.on("error", reject);
      stream.on("finish", () => resolve(filename));
      stream.end(file.buffer);
    });
  }

  async getFileStream(filename: string): Promise<Readable> {
    const bucket = this.storage.bucket(CONFIG.GCP.BUCKET);
    const file = bucket.file(filename);

    const [exists] = await file.exists();
    if (!exists) throw new Error(`File ${filename} not found`);

    return file.createReadStream();
  }

  async getFileMetadata(filename: string) {
    const bucket = this.storage.bucket(CONFIG.GCP.BUCKET);
    const file = bucket.file(filename);

    try {
      const [metadata] = await file.getMetadata();
      return {
        size: metadata.size,
        contentType: metadata.contentType,
      };
    } catch {
      return {
        size: 0,
        contentType: 'application/octet-stream',
      };
    }
  }

  async getSignedUrlForAI(filename: string): Promise<string> {
    const bucket = this.storage.bucket(CONFIG.GCP.BUCKET);
    const file = bucket.file(filename);

    const [exists] = await file.exists();
    if (!exists) throw new Error(`File not found: ${filename}`);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 2 * 60 * 60 * 1000,
    });

    return signedUrl;
  }

  private convertToGsUri(url: string): string | null {
    try {
      const match = url.match(/https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+?)(?:\?|$)/);
      if (match) return `gs://${match[1]}/${match[2]}`;

      if (url.startsWith('gs://')) return url;

      if (!url.startsWith('http') && !url.startsWith('gs://')) {
        return `gs://${CONFIG.GCP.BUCKET}/${url}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  async convertToGsUris(images: string[]): Promise<string[]> {
    if (!images?.length) return [];

    const gsUris: string[] = [];

    for (const image of images) {
      try {
        if (!image?.trim()) continue;

        if (image.startsWith('data:image/')) {
          gsUris.push(image);
          continue;
        }

        if (image.startsWith('gs://')) {
          gsUris.push(image);
          continue;
        }

        if (image.includes('localhost') && image.includes('/video/view-file')) {
          const url = new URL(image);
          const filename = url.searchParams.get('filename');
          if (filename) {
            gsUris.push(`gs://${CONFIG.GCP.BUCKET}/${filename}`);
            continue;
          }
        }

        if (image.includes('storage.googleapis.com')) {
          const match = image.match(/storage\.googleapis\.com\/([^\/]+)\/(.+?)(?:\?|$)/);
          if (match) {
            gsUris.push(`gs://${match[1]}/${match[2]}`);
            continue;
          }
        }

        if (image.startsWith('uploads/') || 
            image.startsWith('generated-images/') || 
            image.startsWith('generated-videos/')) {
          gsUris.push(`gs://${CONFIG.GCP.BUCKET}/${image}`);
          continue;
        }

        if (image.startsWith('http')) {
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 10000);

          try {
            const response = await axios.get(image, {
              responseType: 'arraybuffer',
              timeout: 10000,
              maxRedirects: 5,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SambaAI/1.0)' },
              signal: abortController.signal,
            });

            clearTimeout(timeoutId);

            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || 'image/png';

            if (!contentType.startsWith('image')) continue;

            const urlPath = new URL(image);
            let ext = urlPath.pathname.split('.').pop()?.toLowerCase() || 'png';
            let finalBuffer = buffer;

            if (ext === 'avif') {
              try {
                finalBuffer = await sharp(buffer).png({ quality: 100 }).toBuffer();
                ext = 'png';
              } catch {
                this.logger.warn('AVIF conversion failed');
              }
            }

            const simpleFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

            const file: Express.Multer.File = {
              buffer: finalBuffer,
              originalname: simpleFilename,
              mimetype: ext === 'png' ? 'image/png' : contentType,
              fieldname: 'file',
              encoding: '7bit',
              size: finalBuffer.length,
              stream: new Readable(),
              destination: '',
              filename: '',
              path: '',
            };

            const gcsPath = await this.uploadToGCS(file, 'external-logos');
            gsUris.push(`gs://${CONFIG.GCP.BUCKET}/${gcsPath}`);
            continue;
          } catch (downloadError: any) {
            if (downloadError.name === 'AbortError') {
              this.logger.error(`Download timeout: ${image.substring(0, 100)}`);
            }
            continue;
          }
        }

        gsUris.push(`gs://${CONFIG.GCP.BUCKET}/${image}`);
      } catch (error: any) {
        this.logger.warn(`Skipping invalid image: ${error.message}`);
      }
    }

    return gsUris;
  }

  async convertToSignedUrls(images: string[]): Promise<string[]> {
    if (!images?.length) return [];

    const signedUrls: string[] = [];

    for (const image of images) {
      try {
        if (!image?.trim()) continue;

        if (image.includes('storage.googleapis.com') && image.includes('X-Goog-Algorithm')) {
          signedUrls.push(image);
          continue;
        }

        if (image.startsWith('data:image/')) {
          signedUrls.push(image);
          continue;
        }

        if (image.includes('localhost') && image.includes('/video/view-file')) {
          const url = new URL(image);
          const filename = url.searchParams.get('filename');
          if (filename) {
            const signedUrl = await this.getSignedUrlForAI(filename);
            signedUrls.push(signedUrl);
            continue;
          }
        }

        if (image.startsWith('uploads/') || 
            image.startsWith('generated-images/') || 
            image.startsWith('generated-videos/')) {
          const signedUrl = await this.getSignedUrlForAI(image);
          signedUrls.push(signedUrl);
          continue;
        }

        if (image.startsWith('http')) {
          signedUrls.push(image);
          continue;
        }

        const signedUrl = await this.getSignedUrlForAI(image);
        signedUrls.push(signedUrl);
      } catch (error: any) {
        this.logger.warn(`Skipping invalid image: ${error.message}`);
      }
    }

    return signedUrls;
  }

  async checkUserFileAccessByFilename(
    userId: string,
    filename: string,
    fileType: 'image' | 'video'
  ): Promise<boolean> {
    try {
      const gallery = await this.galleryModel.findOne({ userId });
      if (!gallery) return false;

      const cleanFilename = filename
        .replace(/^generated-images\//, '')
        .replace(/^generated-videos\//, '')
        .replace(/^uploads\//, '')
        .replace(/^external-logos\//, '');

      if (fileType === 'image') {
        return gallery.imageUrls?.some(img => 
          img.url?.includes(cleanFilename) || img.filename === cleanFilename
        ) || false;
      } else {
        return gallery.videoUrls?.some(vid => 
          vid.url?.includes(cleanFilename) || vid.filename === cleanFilename
        ) || false;
      }
    } catch (error: any) {
      this.logger.error(`File access check failed: ${error.message}`);
      return false;
    }
  }

  async checkUserFileAccess(
    userId: string,
    itemId: string,
    type: 'image' | 'video'
  ): Promise<boolean> {
    try {
      const gallery = await this.galleryModel.findOne({ userId });
      if (!gallery) return false;

      if (type === 'image') {
        return gallery.imageUrls?.some(img => img._id?.toString() === itemId) || false;
      } else {
        return gallery.videoUrls?.some(vid => vid._id?.toString() === itemId) || false;
      }
    } catch {
      return false;
    }
  }

  private async convertUrlToBase64(url: string): Promise<string | null> {
    try {
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

      const response = await axios.get(fullUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      let buffer = Buffer.from(response.data);
      let mimeType = response.headers["content-type"] || "image/jpeg";

      if (!mimeType.startsWith("image/")) {
        const ext = url.split(".").pop()?.toLowerCase().split('?')[0];
        const mimeMap: Record<string, string> = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp"
        };
        mimeType = mimeMap[ext || ''] || "image/jpeg";
      }

      if (CONFIG.MEDIA.UNSUPPORTED_FORMATS.includes(mimeType)) {
        buffer = await sharp(buffer).png({ quality: 100 }).toBuffer();
        mimeType = "image/jpeg";
      }

      if (!buffer || buffer.length < 100) {
        throw new Error("Invalid image buffer");
      }

      const base64 = buffer.toString("base64");
      return `data:${mimeType};base64,${base64}`;
    } catch (error: any) {
      this.logger.error(`Base64 conversion failed: ${error.message}`);
      return null;
    }
  }

  async createImageWithGemini(dto: any, forRegeneration: boolean) {
  try {
    let remaining = 0;

    let imagePrompt = this.buildBaseImagePrompt(dto);
    this.logger.log('send image prompt to geminie', imagePrompt);
    const imageContentArray: any[] = [];

    const referenceCount = await this.addReferenceImagesToContent(dto, imageContentArray, imagePrompt);

    if (referenceCount > 0) {
      imagePrompt += this.getReferenceImageInstructions(dto, referenceCount);
    }

    const cleanPromptForGallery = imagePrompt;

    const isWatermarked = await this.addWatermarkIfNeeded(dto.userId, imageContentArray);

    if (isWatermarked) {
      imagePrompt += this.getWatermarkInstructions();
    }

    imageContentArray.push({ text: imagePrompt });

    const aspectRatio = this.normalizeAspectRatio(dto.deviceType || dto.videoRatio || '16:9');

    const imageResponse = await this.geminiClient.models.generateContent({
      model: CONFIG.MODELS.GEMINI_IMAGE,
      contents: [{ parts: imageContentArray }],
      config: {
        temperature: 0.8,
        maxOutputTokens: 1000,
        imageConfig: { aspectRatio }
      }
    });

    if (imageResponse.promptFeedback?.blockReason) {
      await this.rollbackImageLimitIfNeeded(dto.userId, forRegeneration);
      return {
        success: false,
        error: `Content blocked: ${imageResponse.promptFeedback.blockReason}`,
        code: 'CONTENT_FILTERED',
        userMessage: 'Content violates safety guidelines. Please rephrase.',
        blockReason: imageResponse.promptFeedback.blockReason
      };
    }

    if (imageResponse.candidates && Array.isArray(imageResponse.candidates) && imageResponse.candidates.length > 0) {
      const candidate = imageResponse.candidates[0];
      
      if (candidate && [FinishReason.SAFETY, FinishReason.OTHER, FinishReason.BLOCKLIST].includes(candidate.finishReason as any)) {
        await this.rollbackImageLimitIfNeeded(dto.userId, forRegeneration);
        return {
          success: false,
          error: 'Content blocked by safety filters',
          code: 'SAFETY_BLOCK',
          userMessage: 'Request blocked by safety filters. Modify your prompt.',
          finishReason: candidate.finishReason
        };
      }
    }

    if (imageResponse.candidates && imageResponse.candidates[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;

          if (!mimeType || !base64Data || !this.isValidImageMimeType(mimeType)) continue;

          const buffer = Buffer.from(base64Data, "base64");
          const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split("/")[1];

          const file = this.createMulterFile(buffer, mimeType, extension, dto.brandName);

          const gcsPath = await this.uploadToGCS(file, "generated-images");
          const downloadUrl = `/video/test-download?filename=${encodeURIComponent(gcsPath)}`;
          const viewUrl = `/video/view-file?filename=${encodeURIComponent(gcsPath)}`;

          return {
            success: true,
            gcsPath,
            downloadUrl,
            viewUrl,
            filename: file.originalname,
            deviceType: aspectRatio,
            generatedPrompt: cleanPromptForGallery,
            brandName: dto.brandName || 'image-generated',
            remaining: 0,
            message: `Image generated for ${dto.brandName || 'your brand'}`,
            source: dto.source,
            forRegeneration,
            language: dto.language || 'English',
            userId: dto.userId
          };
        }
      }
    }

    await this.rollbackImageLimitIfNeeded(dto.userId, forRegeneration);
    return { success: false, error: "No image generated" };

  } catch (error: any) {
    this.logger.error(`Image generation failed: ${error.message}`);
    await this.rollbackImageLimitIfNeeded(dto.userId, forRegeneration);
    return { success: false, error: error.message || 'Unknown error' };
  }
}


  private buildBaseImagePrompt(dto: any): string {
    let prompt = ``;

    if (dto.brandName && dto.brandName !== 'image-generated' && !dto.brandName.endsWith('-freestyle')) {
      prompt += `Brand: ${dto.brandName}\n`;
    }

    if (dto.products) prompt += `Products/Services: ${dto.products}\n`;
    if (dto.style) prompt += `Style: ${dto.style}\n`;
    if (dto.audience) prompt += `Target Audience: ${dto.audience}\n`;

    prompt += `\n`;

    if (dto.storyboard?.trim()) {
      prompt += `**Content:**\n${dto.storyboard}\n\n`;
    }

    if (dto.useSlogan && dto.slogan) {
  prompt += `\n**SLOGAN:** "${dto.slogan}"\n`;
  prompt += `- Display using premium advertising typography (clean, modern, high-legibility)\n`;
  prompt += `- Ensure strong visual hierarchy without overpowering the product\n`;
  prompt += `- Maintain proper spacing and negative space around brand and product\n`;
  prompt += `- Integrate naturally into the composition (not as a flat overlay)\n`;
  prompt += `- Keep layout balanced, professional, and marketing-standard appealing\n`;
}

    // const aspectRatio = dto.deviceType || dto.videoRatio || '16:9';
    // prompt += `\n**STYLE:** Photorealistic, high-quality marketing image\n`;
    // prompt += `**Format:** ${aspectRatio}\n`;

    if (dto.language && dto.language !== 'English') {
      prompt += `**Language:** All text in ${dto.language}\n`;
    }

    // prompt += `\n**Guidelines:**\n`;
    // prompt += `- Maintain professional quality\n`;
    // prompt += `- Use only specified elements\n`;
    // prompt += `- Authentic branding elements\n`;

    return prompt;
  }

  private async addReferenceImagesToContent(
    dto: any,
    contentArray: any[],
    basePrompt: string
  ): Promise<number> {
    const referenceImages: Array<{ url: string; label: string }> = [];

    if (dto.logoUrl?.trim()) {
      referenceImages.push({ url: dto.logoUrl, label: 'brand logo' });
    }

    if (dto.imageUrls && Array.isArray(dto.imageUrls)) {
      const validImages = dto.imageUrls.filter((img: string) => img?.trim());
      validImages.forEach((url: string, idx: number) => {
        referenceImages.push({ url, label: `product ${idx + 1}` });
      });
    }

    if (referenceImages.length === 0) return 0;

    const signedUrls = await this.convertToSignedUrls(referenceImages.map(ref => ref.url));

    let addedCount = 0;

    for (let i = 0; i < signedUrls.length; i++) {
      try {
        const imageBase64 = await this.convertUrlToBase64(signedUrls[i]);

        if (!imageBase64 || !this.isValidBase64Image(imageBase64)) continue;

        const match = imageBase64.match(/data:([^;]+);base64,(.+)/);
        if (!match) continue;

        let mimeType = match[1];
        const base64Data = match[2];

        if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

        if (!base64Data || base64Data.length < 100) continue;

        contentArray.push({
          inlineData: { mimeType, data: base64Data }
        });

        contentArray.push({ text: `[Reference: ${referenceImages[i].label}]` });

        addedCount++;
      } catch (error: any) {
        this.logger.error(`Reference image processing failed: ${error.message}`);
      }
    }

    return addedCount;
  }

  private getReferenceImageInstructions(dto: any, imageCount: number): string {
    let instructions = `\n**REFERENCE IMAGES PROVIDED:**\n`;

    if (dto.useLogo && dto.logoUrl) {
      instructions += `- Brand logo: Include prominently without alterations\n`;
    }

    if (imageCount > 1 || (imageCount === 1 && !dto.logoUrl)) {
      instructions += `- Product images: Use as visual reference for accurate representation\n`;
    }

    instructions += `- Maintain authentic appearance of all reference elements\n`;

    return instructions;
  }

  private async addWatermarkIfNeeded(userId: string, contentArray: any[]): Promise<boolean> {
    try {
      const user = await this.userModel.findById(userId);

      // if (user?.currentPlanName !== 'free') return false;

      const sambaBase64 = await this.convertUrlToBase64('https://samba.ink/sambaWaterMark.png');

      if (!sambaBase64 || !this.isValidBase64Image(sambaBase64)) return false;

      const match = sambaBase64.match(/data:([^;]+);base64,(.+)/);
      if (!match) return false;

      let mimeType = match[1];
      const base64Data = match[2];

      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      contentArray.push({
        inlineData: { mimeType, data: base64Data }
      });

      contentArray.push({ text: '[Watermark overlay logo]' });

      return true;
    } catch {
      return false;
    }
  }

  private getWatermarkInstructions(): string {
    return `\n\n**WATERMARK OVERLAY:**\n` +
      `- Place watermark logo in BOTTOM-RIGHT corner\n` +
      `- Position: 3-5% margin from bottom and right edges\n` +
      `- Opacity: 15-20% semi-transparent overlay\n` +
      `- Size: Small and subtle (~8-10% of image width)\n` +
      `- Keep watermark above all other content\n` +
      `- Do NOT alter, crop, or distort the watermark\n` +
      `- Watermark should be clearly visible but unobtrusive\n`;
  }

  private isValidBase64Image(base64String: string): boolean {
    return /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(base64String);
  }

  private isValidImageMimeType(mimeType: string): boolean {
  const validMimes: string[] = [
    'image/png',
    'image/jpeg', 
    'image/jpg',
    'image/webp',
    'image/gif'
  ];
  return validMimes.includes(mimeType);
}

private normalizeAspectRatio(input: string): string {
  const validRatios: string[] = [
    '21:9', '16:9', '4:3', '3:2', '1:1',
    '9:16', '3:4', '2:3', '9:21'
  ];
  
  if (validRatios.includes(input)) return input;

  const mappings: Record<string, string> = {
    'landscape': '16:9',
    'portrait': '9:16',
    'square': '1:1',
    'widescreen': '21:9',
    'standard': '4:3'
  };
  
  return mappings[input.toLowerCase()] || '16:9';
}


  private createMulterFile(
    buffer: Buffer,
    mimeType: string,
    extension: string,
    brandName: string
  ): Express.Multer.File {
    const sanitized = this.sanitizeBrandName(brandName);
    const filename = `${sanitized}-generated-${Date.now()}.${extension}`;

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    return {
      buffer,
      originalname: filename,
      mimetype: mimeType,
      fieldname: "image",
      encoding: "base64",
      size: buffer.length,
      stream,
      destination: "",
      filename,
      path: "",
    };
  }

  private sanitizeBrandName(brandName: string): string {
    if (!brandName || brandName === 'image-generated') return 'untitled';

    return brandName
      .replace(/-freestyle$/i, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toLowerCase() || 'untitled';
  }

  private async rollbackImageLimitIfNeeded(userId: string, forRegeneration: boolean): Promise<void> {
    if (forRegeneration) return;

    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'monthlyUsage.images': -1 }
      });
    } catch (error: any) {
      this.logger.error(`Rollback failed: ${error.message}`);
    }
  }

  async saveToGallery(
    userId: string, 
    downloadUrl: string, 
    gcsPath: string, 
    forRegeneration: boolean = false, 
    brandName = "",
    generatedPrompt?: string,
    source?: string 
  ) {
    let galleryEntry = await this.galleryModel.findOne({ userId });

    if (!galleryEntry) {
      galleryEntry = new this.galleryModel({
        userId,
        imageUrls: [{
          url: downloadUrl,
          filename: `${brandName}.png`,
          createdAt: new Date(),
          parentLink: null,
          generatedPrompt, 
          source,
        }],
        videoUrls: [],
      });
    } else {
      if (forRegeneration) {
        galleryEntry.imageUrls.pop();
      }

      galleryEntry.imageUrls.push({
        url: downloadUrl,
        filename: `${brandName}.png`,
        createdAt: new Date(),
        isDeleted: false,
        generatedPrompt, 
        source,
      });
    }

    await galleryEntry.save();
    return galleryEntry;
  }

    async generateVideoUsingVeo3(
      script: string,
      deviceType: string,
      logoImage?: string,
      referenceImages?: string[],
      userId?: string
    ): Promise<{ operationName: string; startTimestamp: number }> {
      let httpsAgent: https.Agent | null = null;
      
      try {
        let imagePayload: any = {};
        let imagesToUse: string[] = [];

        if (referenceImages?.length) {
          imagesToUse.push(...referenceImages.filter(img => img?.trim()));
        }

        if (logoImage?.trim() && imagesToUse.length < 3) {
          imagesToUse.push(logoImage);
        }

        if (imagesToUse.length > 0) {
          imagesToUse = await this.convertToGsUris(imagesToUse);
        }

        // if (imagesToUse.length > 0) {
        //   const primaryImage = imagesToUse[0];

        //   if (primaryImage.startsWith('data:')) {
        //     const [mimeWithPrefix, base64] = primaryImage.split(',');
        //     imagePayload = {
        //       image: {
        //         bytesBase64Encoded: base64,
        //         mimeType: mimeWithPrefix.split(';')[0].split(':')[1]
        //       }
        //     };
        //   } else if (primaryImage.startsWith('http')) {
        //     const gsUri = this.convertToGsUri(primaryImage);
        //     if (gsUri) {
        //       imagePayload = { image: { gcsUri: gsUri, mimeType: "image/png" } };
        //     }
        //   } else {
        //     imagePayload = { image: { gcsUri: primaryImage, mimeType: "image/png" } };
        //   }

        //   const hasLogo = logoImage ? imagesToUse.includes(logoImage) : false;
        //   const hasRefImages = referenceImages && referenceImages.length > 0;

        //   if (hasRefImages || hasLogo) {
        //     let context = '\n\n**IMAGE USAGE:**\n';
        //     if (hasRefImages) context += '- Use reference for product appearance\n';
        //     if (hasLogo) context += '- Integrate brand logo subtly\n';
        //     script += context;
        //   }
        // }

              const useReferenceMode = (referenceImages?.length ?? 0) > 0;

        if (imagesToUse.length > 0) {
          if (useReferenceMode) {
            // Reference/asset mode — Veo matches product appearance, not used as first frame
            imagePayload = {
              referenceImages: imagesToUse.map(uri => ({
                image: {
                  gcsUri: uri,
                  mimeType: 'image/png',
                },
                referenceType: 'asset',
              }))
            };
          } else {
            // First-frame mode — only logo present, no reference images
            const primaryImage = imagesToUse[0];

            if (primaryImage.startsWith('data:')) {
              const [mimeWithPrefix, base64] = primaryImage.split(',');
              imagePayload = {
                image: {
                  bytesBase64Encoded: base64,
                  mimeType: mimeWithPrefix.split(';')[0].split(':')[1]
                }
              };
            } else if (primaryImage.startsWith('http')) {
              const gsUri = this.convertToGsUri(primaryImage);
              if (gsUri) {
                imagePayload = { image: { gcsUri: gsUri, mimeType: 'image/png' } };
              }
            } else {
              imagePayload = { image: { gcsUri: primaryImage, mimeType: 'image/png' } };
            }
          }

          const hasLogo = logoImage ? imagesToUse.some(u => u.includes(logoImage.split('/').pop()!)) : false;

          let context = '\n\n**IMAGE USAGE:**\n';
          if (useReferenceMode) context += '- Use reference for product appearance\n';
          if (hasLogo) context += '- Integrate brand logo subtly\n';
          script += context;
        }

  this.logger.log('script send to veo generation',script);
  this.logger.log('imagePayload send to veo imagePayload',imagePayload);
        const payload = {
          instances: [{
            prompt: script,
            ...(Object.keys(imagePayload).length > 0 ? imagePayload : {})
          }],
          parameters: {
            durationSeconds: CONFIG.VIDEO.DURATION,
            sampleCount: CONFIG.VIDEO.SAMPLE_COUNT,
            aspectRatio: deviceType,
            ...(CONFIG.GCP.OUTPUT_URI ? { storageUri: CONFIG.GCP.OUTPUT_URI } : {}),
          },
        };

        const base = `https://${CONFIG.GCP.LOCATION}-aiplatform.googleapis.com/v1/projects/${CONFIG.GCP.PROJECT_ID}/locations/${CONFIG.GCP.LOCATION}/publishers/google/models/${CONFIG.MODELS.VEO}`;
        const token = await this.getGcpAccessToken();
        
        httpsAgent = new https.Agent({ 
          keepAlive: true,
          maxSockets: 10,
          timeout: CONFIG.TIMEOUTS.GCS_OPERATION
        });

        const startRes = await axios.post(`${base}:predictLongRunning`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          httpsAgent,
          timeout: CONFIG.TIMEOUTS.GCS_OPERATION,
        });

        const operationName: string = startRes.data?.name;
        if (!operationName) throw new Error("No operation name returned");

        return { operationName, startTimestamp: Date.now() };

      } catch (error: any) {
        this.logger.error(`Veo generation failed: ${error.message}`);

        const errorMessage = error.message || error.response?.data?.error?.message || '';
        const errorCode = error.code || error.response?.data?.error?.code;

        if (errorCode === 3 && (
          errorMessage.includes('sensitive words') ||
          errorMessage.includes('Responsible AI') ||
          errorMessage.includes('policy')
        )) {
          const policyError = new Error('Content policy violation');
          (policyError as any).code = 'POLICY_VIOLATION';
          (policyError as any).retryable = false;
          throw policyError;
        }

        if (error.response?.status === 401) {
          const authError = new Error("Authentication failed");
          (authError as any).code = 'AUTH_FAILED';
          (authError as any).retryable = false;
          throw authError;
        }

        if (error.response?.status === 403) {
          const permError = new Error("Access denied");
          (permError as any).code = 'PERMISSION_DENIED';
          (permError as any).retryable = false;
          throw permError;
        }

        if (error.response?.status === 429) {
          const rateLimitError = new Error("Rate limit exceeded");
          (rateLimitError as any).code = 'RATE_LIMITED';
          (rateLimitError as any).retryable = true;
          throw rateLimitError;
        }

        if (error.response?.status >= 500) {
          const serverError = new Error("Service temporarily unavailable");
          (serverError as any).code = 'SERVER_ERROR';
          (serverError as any).retryable = true;
          throw serverError;
        }

        const hasImages = (referenceImages?.length || 0) > 0 || !!logoImage?.trim();
        if (hasImages && (
          errorMessage.toLowerCase().includes('image') ||
          errorMessage.toLowerCase().includes('gcs_uri') ||
          errorMessage.toLowerCase().includes('invalid input')
        )) {
          const imageError = new Error('Image processing error');
          (imageError as any).code = 'IMAGE_ERROR';
          (imageError as any).retryable = true;
          (imageError as any).retryWithoutImages = true;
          throw imageError;
        }

        (error as any).retryable = true;
        throw error;
        
      } finally {
        if (httpsAgent) httpsAgent.destroy();
      }
    }

    async pollingStatusForVideoGenerated(
      operationName: string, 
      startTimestamp: number,
      paramDataObj: any
    ): Promise<any> {
      let httpsAgent: https.Agent | null = null;

      try {
        const base = `https://${CONFIG.GCP.LOCATION}-aiplatform.googleapis.com/v1/projects/${CONFIG.GCP.PROJECT_ID}/locations/${CONFIG.GCP.LOCATION}/publishers/google/models/${CONFIG.MODELS.VEO}`;
        const token = await this.getGcpAccessToken();
        
        httpsAgent = new https.Agent({ 
          keepAlive: true,
          maxSockets: 10,
          timeout: CONFIG.TIMEOUTS.GCS_OPERATION
        });

        const pollRes = await axios.post(
          `${base}:fetchPredictOperation`,
          { operationName },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            httpsAgent,
            timeout: CONFIG.TIMEOUTS.GCS_OPERATION,
          }
        );

        const op = pollRes.data;

        if (op?.error) {
          const errorMessage = op.error.message || 'Unknown error';
          const errorCode = op.error.code;

          if (errorCode === 3 && errorMessage.toLowerCase().includes('usage guidelines')) {
            return {
              success: false,
              isPending: false,
              error: 'CONTENT_POLICY_VIOLATION',
              userFriendlyMessage: 'Content violates guidelines. Please rephrase.',
            };
          }

          if (errorMessage.toLowerCase().includes('safety') || 
              errorMessage.toLowerCase().includes('policy') ||
              errorMessage.toLowerCase().includes('violate')) {
            return {
              success: false,
              isPending: false,
              error: 'SAFETY_FILTER',
              userFriendlyMessage: 'Content flagged by safety filters.',
            };
          }

          return {
            success: false,
            isPending: false,
            error: 'VEO_GENERATION_FAILED',
            message: `Video generation failed: ${errorMessage}`,
          };
        }

        if (!op?.done) {
          return { 
            success: true, 
            isPending: true,
            message: 'Processing...'
          };
        }

        const videos = op?.response?.videos || [];

        if (op?.response?.raiMediaFilteredCount > 0 || op?.response?.raiMediaFilteredReasons) {
          const filterReason = op?.response?.raiMediaFilteredReasons?.[0] || 'Content filtered by AI';
          const supportCodeMatch = filterReason.match(/Support codes?:?\s*([\d]+)/i);
          const supportCode = supportCodeMatch ? supportCodeMatch[1] : null;
          
          return {
            success: false,
            isPending: false,
            error: 'CONTENT_POLICY_VIOLATION',
            userFriendlyMessage: 'Content blocked by AI safety filters. Please rephrase.',
            supportCode,
          };
        }

        if (!videos[0]) {
          const elapsedSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
          
          if (elapsedSeconds < 120) {
            return {
              success: true,
              isPending: true,
              message: 'Video data not yet available'
            };
          }
          
          return {
            success: false,
            isPending: false,
            error: 'NO_VIDEO',
            userFriendlyMessage: 'No video produced',
          };
        }

        const video = videos[0];

        if (video.gcsUri) {
          const gcsPath = video.gcsUri.replace(`gs://${CONFIG.GCP.BUCKET}/`, '');
          const downloadUrl = `/video/test-download?filename=${encodeURIComponent(gcsPath)}`;
          const viewUrl = `/video/view-file?filename=${encodeURIComponent(gcsPath)}`;

          // try {
          //   await this.saveGeneratedVideoURLInDB(
          //     paramDataObj.userId,
          //     downloadUrl,
          //     gcsPath,
          //     paramDataObj.generatedImageId || null,
          //     paramDataObj.generatedImage,
          //     paramDataObj.script,
          //     paramDataObj.brandName,
          //     paramDataObj.source
          //   );
          // } catch (galleryError: any) {
          //   this.logger.error(`Gallery save failed: ${galleryError.message}`);
          // }

          return {
            success: true,
            isPending: false,
            gcsPath,
            downloadUrl,
            viewUrl,
          };
        }

        if (video.bytesBase64Encoded && video.mimeType) {
          return {
            success: true,
            isPending: false,
            base64Video: video.bytesBase64Encoded,
            mimeType: video.mimeType,
          };
        }

        return {
          success: false,
          isPending: false,
          error: 'NO_VIDEO_DATA',
          userFriendlyMessage: 'Video not accessible',
        };

      } catch (error: any) {
        this.logger.error(`Polling error: ${error.message}`);

        if (error.response?.data?.error) {
          const veoError = error.response.data.error;

          if (veoError.code === 3 && veoError.message?.toLowerCase().includes('usage guidelines')) {
            return {
              success: false,
              isPending: false,
              error: 'CONTENT_POLICY_VIOLATION',
              userFriendlyMessage: 'Content violates guidelines.',
            };
          }
        }

        if (error.response?.status === 429) {
          return { 
            success: false, 
            isRateLimited: true, 
            isPending: true,
            message: 'Rate limited...'
          };
        }

        if (error.response?.status >= 500) {
          return { 
            success: false, 
            isRetry: true,
            isPending: true,
            message: 'Server error...'
          };
        }

        if (error.response?.status >= 400 && error.response?.status < 500) {
          return {
            success: false,
            isPending: false,
            error: 'CLIENT_ERROR',
            message: error.message,
            userFriendlyMessage: `Request failed`,
          };
        }

        return { 
          success: false, 
          isPending: false,
          message: error.message,
          error: 'POLLING_ERROR',
          userFriendlyMessage: `Polling failed`,
        };

      } finally {
        if (httpsAgent) httpsAgent.destroy();
      }
    }
  async extendVideoUsingVeo(
    script: string,
    previousVideoGcsUri: string,
    deviceType: string,
  ): Promise<{ operationName: string; startTimestamp: number }> {
    let httpsAgent: https.Agent | null = null;

    try {
      const payload = {
        instances: [{
          prompt: script,
          video: {
            gcsUri: previousVideoGcsUri,
            mimeType: 'video/mp4',
          },
        }],
        parameters: {
          sampleCount: CONFIG.VIDEO.SAMPLE_COUNT,
          aspectRatio: deviceType,
          ...(CONFIG.GCP.OUTPUT_URI ? { storageUri: CONFIG.GCP.OUTPUT_URI } : {}),
        },
      };

      this.logger.log('Extension payload', JSON.stringify(payload));

      const base = `https://${CONFIG.GCP.LOCATION}-aiplatform.googleapis.com/v1/projects/${CONFIG.GCP.PROJECT_ID}/locations/${CONFIG.GCP.LOCATION}/publishers/google/models/${CONFIG.MODELS.VEO}`;
      const token = await this.getGcpAccessToken();

      httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

      const startRes = await axios.post(`${base}:predictLongRunning`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        httpsAgent,
        timeout: CONFIG.TIMEOUTS.GCS_OPERATION,
      });

      const operationName: string = startRes.data?.name;
      if (!operationName) throw new Error('No operation name returned from extension');

      this.logger.log('Extension operation started', operationName);
      return { operationName, startTimestamp: Date.now() };

    } catch (error: any) {
      this.logger.error(`Veo extension failed: ${error.message}`);
      throw error;
    } finally {
      if (httpsAgent) httpsAgent.destroy();
    }
  }
  async pollUntilDone(
    operationName: string,
    startTimestamp: number,
    paramDataObj: any,
    intervalMs = 5000,
    maxWaitMs = 300000,
  ): Promise<any> {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const result = await this.pollingStatusForVideoGenerated(
        operationName, startTimestamp, paramDataObj
      );

      this.logger.log('Poll result', JSON.stringify(result));

      if (!result.isPending) return result;

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return {
      success: false,
      isPending: false,
      error: 'TIMEOUT',
      userFriendlyMessage: 'Video generation timed out',
    };
  }

  async testLongVideoFlow(
    scripts: string[],   // ← array instead of single string
    deviceType: string,
    targetDuration: number = 15,
    logoUrl?: string,   
    referenceImages?: string[]
  ): Promise<any> {

    const BASE_DURATION = 8;
    const EXTENSION_DURATION = 7;
    const MAX_RETRIES = 3;
    const RETRY_WAIT_MS = 20000;

    const extensionsNeeded = Math.ceil((targetDuration - BASE_DURATION) / EXTENSION_DURATION);
    const getScript = (index: number) => scripts[index] ?? scripts[scripts.length - 1];

    this.logger.log(`Target: ${targetDuration}s → Extensions needed: ${extensionsNeeded}`);

    // ── STEP 1: Base video ──
    let baseResult: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      this.logger.log(`Base attempt ${attempt}/${MAX_RETRIES} with script[0]`);
      const base = await this.generateVideoUsingVeo3(getScript(0), deviceType, logoUrl, referenceImages,undefined);
      baseResult = await this.pollUntilDone(base.operationName, base.startTimestamp, {});

      if (baseResult.success && baseResult.gcsPath) break;

      this.logger.warn(`Base attempt ${attempt} failed: ${baseResult?.error}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
    }

    if (!baseResult?.success || !baseResult?.gcsPath) {
    return { 
      success: false, 
      step: 'base', 
      error: baseResult?.error,
      baseVideoCreated: false,  // ✅ processor uses this to decide rollback
    };
  }

    let currentGcsUri = `gs://${CONFIG.GCP.BUCKET}/${baseResult.gcsPath}`;
    let currentDuration = BASE_DURATION;

    // ── STEP 2+: Extensions with own script ──
    for (let i = 1; i <= extensionsNeeded; i++) {
      const extensionScript = getScript(i); // ← each extension gets its own script
      let extResult: any = null;
      let extSuccess = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        this.logger.log(`Extension ${i} | Attempt ${attempt} | using script[${i}]`);

        try {
          const ext = await this.extendVideoUsingVeo(extensionScript, currentGcsUri, deviceType);
          extResult = await this.pollUntilDone(ext.operationName, ext.startTimestamp, {});

          if (extResult.success && extResult.gcsPath) {
            extSuccess = true;
            break;
          }
        } catch (err: any) {
          this.logger.warn(`Extension ${i} attempt ${attempt} threw: ${err.message}`);
        }

        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
      }

    if (!extSuccess) {
    this.logger.warn(`⚠️ Extension ${i} failed — returning base video (${currentDuration}s)`);

    const partialGcsPath = currentGcsUri.replace(`gs://${CONFIG.GCP.BUCKET}/`, '');
    return {
      success: true,                                    // ✅ partial success
      isPartial: true,                                  // ✅ processor checks this
      baseVideoCreated: true,                           // ✅ no rollback needed
      partialReason: `Extension ${i} failed after ${MAX_RETRIES} attempts`,
      actualDuration: currentDuration,                  // how long video actually is
      requestedDuration: targetDuration,                // what user requested
      finalGcsPath: partialGcsPath,                     // ✅ base video path
      downloadUrl: `/video/test-download?filename=${encodeURIComponent(partialGcsPath)}`,
      viewUrl: `/video/view-file?filename=${encodeURIComponent(partialGcsPath)}`,
    };
  }


      currentGcsUri = `gs://${CONFIG.GCP.BUCKET}/${extResult.gcsPath}`;
      currentDuration += EXTENSION_DURATION;
      this.logger.log(`Extension ${i} done → now ${currentDuration}s`);
    }

    const finalGcsPath = currentGcsUri.replace(`gs://${CONFIG.GCP.BUCKET}/`, '');

    return {
      success: true,
      actualDuration: `${currentDuration}s`,
      finalGcsPath,
      downloadUrl: `/video/test-download?filename=${encodeURIComponent(finalGcsPath)}`,
      viewUrl: `/video/view-file?filename=${encodeURIComponent(finalGcsPath)}`,
    };
  }

  async generateVideoScripts(
    prompt: string,
    videoDuration: '8s' | '15s' | '30s',
    voiceOver?: string
  ): Promise<ScriptVoPair[]> {
    const durationMap = { '8s': 1, '15s': 2, '30s': 4 };
    const segmentDurations: Record<string, number[]> = { '8s': [8], '15s': [8, 7], '30s': [8, 7, 7, 8] };
    const scriptCount = durationMap[videoDuration] || 1;
    const durations = segmentDurations[videoDuration] || [8];

    // ✅ Only treat as user voiceOver if it's a meaningful sentence (8+ words)
    const needsGeneratedVO = !voiceOver?.trim() || voiceOver.trim().split(/\s+/).length <= 8;

    const systemPrompt = `You are a professional cinematic video script writer for Google Veo AI video generation.

  Your job is to write ${scriptCount} segment(s) that together form ONE seamless continuous video.

  CRITICAL RULES:
  - ALL scripts must describe the EXACT SAME scene, camera, lighting, mood and style
  - Script 1 sets the scene
  - Scripts 2, 3, 4 are micro-continuations — same shot, subtle camera movement only
  - The viewer should NEVER feel a scene change or cut between scripts
  - Same subject, same environment, same atmosphere throughout
  - Only allow very subtle motion changes (slow zoom in, slight pan, gentle orbit)
  - Each SCRIPT must be 40-60 words
  ${needsGeneratedVO
    ? `- Each VOICEOVER must be 10-20 words, natural spoken narration that sells or describes the product
  - Voiceover should feel like a real advertisement narrator`
    : ''}
  - Decide WHEN the voiceover narration starts and ends within each segment
  - Narration should NOT start at 0 — leave 1-2 seconds of silence first
  - Narration should NOT end at the last second — leave 0.5s silence at end
  - Segment 1 is exactly 8 seconds, segments 2/3/4 are exactly 7 seconds each
  - NO extra labels, titles or markdown other than the format below
  - Separate each segment with exactly: ---SPLIT---
  - Output ONLY the segments, nothing else

  NARRATOR GENDER RULE:
  - Analyze the product/brand and decide the best narrator gender
  - Beauty, skincare, haircare, feminine hygiene products → FEMALE
  - Tech, sports, automotive, finance, masculine products → MALE
  - Neutral/lifestyle products → FEMALE by default
  - Add GENDER: male OR GENDER: female ONCE at the very top before all segments

  OUTPUT FORMAT:
  GENDER: [male|female]
  SCRIPT: [cinematic scene description 40-60 words]
  VOICEOVER: [natural narration 10-20 words]
  START: [when narration starts in this segment e.g. 1.5]
  END: [when narration ends in this segment e.g. 6.0]
  ---SPLIT---
  SCRIPT: [next scene]
  VOICEOVER: [next narration]
  START: [e.g. 1.0]
  END: [e.g. 5.5]`;

    const segmentLabels = [
      'Establish the scene (8 seconds)',
      'Continue SAME shot with subtle slow zoom or gentle camera drift (7 seconds)',
      'Continue SAME shot, camera moves slightly closer or orbits gently (7 seconds)',
      'Continue SAME shot, final slow push-in or hold on subject (7 seconds)',
    ];

    const segmentExamples = Array.from({ length: scriptCount }, (_, i) =>
      `Segment ${i + 1}: ${segmentLabels[i] || segmentLabels[segmentLabels.length - 1]}`
    ).join('\n');

    const userPrompt = `User idea: "${prompt}"

  Write EXACTLY ${scriptCount} segment(s) for a ${videoDuration} video.

  ${scriptCount === 1
      ? `Write 1 segment describing the scene cinematically.`
      : `All segments must feel like ONE continuous shot — same scene, same subject, same lighting.\n${segmentExamples}`
    }

  ${!needsGeneratedVO
      ? `User has provided their own voiceover: "${voiceOver!.trim()}"
  Split it evenly across ${scriptCount} segment(s) — do NOT change the words, just distribute naturally.`
      : `Generate a natural advertisement-style voiceover for each segment.`
    }

  Output format (strictly follow, repeat per segment):
  GENDER: [male|female]   ← only on very first line
  SCRIPT: [scene here]
  VOICEOVER: [narration here]
  START: [start second within this segment]
  END: [end second within this segment]
  ---SPLIT---
  SCRIPT: [next scene]
  VOICEOVER: [next narration]
  START: [start second]
  END: [end second]`;

    try {
      this.logger.log(`🎬 Generating ${scriptCount} script(s) for ${videoDuration} video`);

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      if (!raw) throw new Error('GPT returned empty response');

      // ✅ Extract narrator gender (appears once at top)
      const genderMatch = raw.match(/GENDER:\s*(male|female)/i);
      const narratorGender: 'male' | 'female' =
        (genderMatch?.[1]?.toLowerCase() as 'male' | 'female') || 'female';
      this.logger.log(`🎙️ Narrator gender decided: ${narratorGender}`);

      // ✅ Remove GENDER line before splitting into segments
      const cleanRaw = raw.replace(/GENDER:\s*(male|female)\s*\n?/i, '').trim();

      // ✅ Split into segments
      const segments = cleanRaw
        .split(/\n?---SPLIT---\n?/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

      if (segments.length === 0) throw new Error('No segments parsed from GPT response');

      // ✅ Pad if GPT returns fewer than needed
      while (segments.length < scriptCount) {
        segments.push(segments[segments.length - 1]);
      }

      // ✅ If user provided a proper voiceOver, pre-split it
      const userVoChunks = !needsGeneratedVO
        ? this.splitVoiceOver(voiceOver!.trim(), scriptCount)
        : null;

      // ✅ Build result with GPT-decided timing per segment
      let cumulativeTime = 0;

      const result: ScriptVoPair[] = segments.slice(0, scriptCount).map((seg, i) => {
        // Parse each field from segment
        const scriptMatch = seg.match(/SCRIPT:\s*([\s\S]+?)(?=VOICEOVER:|START:|END:|$)/i);
        const voMatch     = seg.match(/VOICEOVER:\s*([\s\S]+?)(?=START:|END:|$)/i);
        const startMatch  = seg.match(/START:\s*([\d.]+)/i);
        const endMatch    = seg.match(/END:\s*([\d.]+)/i);

        const script   = scriptMatch?.[1]?.trim() || seg.trim();
        const voiceout = userVoChunks
          ? (userVoChunks[i] || '')           // ✅ user-provided, pre-split
          : (voMatch?.[1]?.trim() || '');     // ✅ GPT-generated

        const segDuration = durations[i] || 7;

        // ✅ Use GPT-decided local timing, fallback to safe defaults
        const localStart = parseFloat(startMatch?.[1] ?? '1.0');
        const localEnd   = parseFloat(endMatch?.[1]   ?? String(segDuration - 0.5));

        // ✅ Convert local segment time → absolute video timeline
        const subtitleStart = parseFloat((cumulativeTime + localStart).toFixed(2));
        const subtitleEnd   = parseFloat((cumulativeTime + Math.min(localEnd, segDuration - 0.3)).toFixed(2));

        cumulativeTime += segDuration;

        this.logger.log(`📝 Script   ${i + 1}: ${script.substring(0, 80)}...`);
        this.logger.log(`🎙️ VoiceOver ${i + 1}: ${voiceout.substring(0, 80) || '(none)'}`);
        this.logger.log(`⏱️ Subtitle  ${i + 1}: ${subtitleStart}s → ${subtitleEnd}s (local: ${localStart}s → ${localEnd}s)`);

        return {
          script,
          voiceOver: voiceout,
          narratorGender,     // ✅ same gender locked for all segments
          subtitleStart,      // ✅ absolute time in full video
          subtitleEnd,        // ✅ absolute time in full video
        };
      });

      this.logger.log(`✅ Generated ${result.length} script(s) | Gender: ${narratorGender}`);
      return result;

    } catch (error: any) {
      this.logger.error(`Script generation failed: ${error.message}`);
      this.logger.warn(`⚠️ Using fallback scripts`);

      // ✅ Fallback — safe default timings
      const voChunks = this.splitVoiceOver(voiceOver?.trim() || '', scriptCount);
      let cumulativeTime = 0;

      return Array.from({ length: scriptCount }, (_, i) => {
        const segDuration = durations[i] || 7;
        const subtitleStart = parseFloat((cumulativeTime + 1.0).toFixed(2));
        const subtitleEnd   = parseFloat((cumulativeTime + segDuration - 0.5).toFixed(2));
        cumulativeTime += segDuration;

        return {
          script: prompt.trim(),
          voiceOver: voChunks[i] || '',
          narratorGender: 'female' as const,
          subtitleStart,
          subtitleEnd,
        };
      });
    }
  }



  private splitVoiceOver(text: string, count: number): string[] {
    if (!text.trim() || count <= 1) return Array(count).fill(text.trim());
    const words = text.trim().split(/\s+/);
    const chunkSize = Math.ceil(words.length / count);
    return Array.from({ length: count }, (_, i) =>
      words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ')
    );
  }


  async saveGeneratedVideoURLInDB(
    userId: string,
    downloadUrl: string,
    gcsPath: string,
    generatedImageId?: string,
    processedImageURL?: string,
    generatedPrompt?: string,
    brandName?: string,
    source?: string
  ) {
    try {
      const result = await this.galleryModel.findOneAndUpdate(
        { userId: userId },
        {
          $push: {
            videoUrls: {
              url: downloadUrl,
              filename: `${brandName?.replace(/-freestyle$/i, '') || 'untitled'}.mp4`,
              createdAt: new Date(),
              isDeleted: false,
              imageId: generatedImageId?.toString() || undefined,
              imageURL: processedImageURL,
              generatedPrompt: generatedPrompt,
              source: source
            }
          }
        },
        { 
          upsert: true,
          new: true
        }
      );

      return result;
    } catch (error: any) {
      this.logger.error(`Save video to gallery failed: ${error.message}`);
      throw error;
    }
  }

  async fetchDomainInfoUsingAssistantAPI(
    domain: string, 
    language: string = 'English', 
    userId: string
  ): Promise<DomainInfo> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= CONFIG.MEDIA.MAX_RETRIES; attempt++) {
      try {
        const normalizedDomain = this.normalizeUrl(domain);
        
        const structuredData = await this.scrapeWebsiteMedia(normalizedDomain);
        const parsedData = JSON.parse(structuredData.data);

        const dirPath = path.resolve('.', 'structured_data');
        const filePath = path.join(dirPath, `${userId}.json`);

        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(parsedData, null, 2), 'utf-8');
        const fileStream = fs.createReadStream(filePath);

        const file = await this.client.files.create({
          file: fileStream,
          purpose: "assistants"
        });

// const prompt = `Return ONLY valid JSON in the schema below. Use ONLY the HTML provided. Do NOT guess or add external information.

// Inputs:
// - Language: ${language} - Domain: ${normalizedDomain}

// TASK 1 — Extract product + brand data:
// - Parse all JSON-LD blocks (@type Product, Organization, Brand) including @graph.
// - Extract product name, description, price, sku, features, currency, availability.
// - Extract gallery images from: .product-gallery, .media-gallery, [data-gallery], hero sections near price or add-to-cart.
// - Use only raster images (png, jpg, jpeg, webp, gif, avif). Resolve srcset or data-src.
// - Extract video URLs from <video>, <source>, <iframe>, <embed>, og:video.
// - Extract logo from JSON-LD "logo", or <img>/<picture> inside header/nav with class/id/alt containing logo|brand.
// - Convert relative URLs to absolute using ${normalizedDomain}.
// - If something does not exist in the HTML, return empty values.

// TASK 2 — Generate content ONLY from extracted data:
// - Write "about" (100–150 words) in ${language}.
// - Write a "tagline" and "slogan" (≤12 words).
// - "products_services": summarize about and product both from page content around 150 words.
// - "cta_suggestions": 2–3 short CTAs in ${language}.
// - "cultural_notes": relevance or tone of the brand.

// SCHEMA:
// {
//   "about": "",
//   "brand_name": "",
//   "tagline": "",
//   "audience": "",
//   "slogan": "",
//   "products_services": [{ "name": "", "description": "" }],
//   "style": "",
//   "logo_url": "",
//   "image_urls": [],
//   "video_urls": [],
//   "cta_suggestions": [],
//   "cultural_notes": "",
//   "product": {
//     "name": "",
//     "description": "",
//     "price": "",
//     "currency": "",
//     "sku": "",
//     "brand": "",
//     "features": [],
//     "availability": ""
//   }
// }
// `;


const prompt = `Return ONLY valid JSON in the schema below.
Use ONLY the provided HTML.
Do NOT guess or add external information.

Inputs:
- Language: ${language}
- Domain: ${normalizedDomain}

========================
TASK
========================

1. Extract brand_name from JSON-LD (Organization/Brand), header, footer, or logo section.
2. Extract slogan if available.
3. Extract logo_url from JSON-LD "logo" or header/nav image containing logo|brand.
4. Extract image_urls from gallery, hero section, or near main content.
   - Only raster images (png, jpg, jpeg, webp, gif, avif).
   - Resolve srcset or data-src.
   - Convert relative URLs to absolute using ${normalizedDomain}.

5. Identify the main PRODUCT or SERVICE.
   - Merge ALL details (name, description, features, pricing, benefits, availability)
     into ONE single formatted description field called "product_or_service".
   - Write it clearly (120–200 words) in ${language}.
   - Use only extracted HTML content.

If any data does not exist, return empty string "" or empty array [].

========================
SCHEMA
========================

{
  "brand_name": "",
  "slogan": "",
  "product_or_service": "",
  "logo_url": "",
  "image_urls": []
}
`;

        const thread = await this.client.beta.threads.create({
          messages: [{
            role: "user",
            attachments: [{
              file_id: file.id,
              tools: [
                { type: 'file_search' },
                { type: "code_interpreter" }
              ]
            }],
            content: [{ type: "text", text: prompt.trim() }],
          }],
        });

        const run = await this.client.beta.threads.runs.create(thread.id, {
          assistant_id: process.env.ASSISTANT_ID as string
        });

        let runStatus = run;
        let pollCount = 0;

        while (runStatus.status !== "completed" && runStatus.status !== "failed" && pollCount < CONFIG.TIMEOUTS.ASSISTANT_POLL_MAX) {
          await new Promise((r) => setTimeout(r, 2000));
          runStatus = await this.client.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
          pollCount++;
        }

        if (runStatus.status === 'failed') throw new Error('OpenAI Assistant run failed');
        if (pollCount >= CONFIG.TIMEOUTS.ASSISTANT_POLL_MAX) throw new Error('OpenAI Assistant timeout');

        const messages = await this.client.beta.threads.messages.list(thread.id);
        const content = (messages.data[0].content[0] as any).text.value;
       
        let parsed: any = {};
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error('Failed to parse AI response');
        }

        const normalizeUrl = (url: string): string => {
          if (!url || typeof url !== 'string') return '';
          url = url.trim();

          if (url.startsWith('http://') || url.startsWith('https://')) return url;
          if (url.startsWith('//')) return 'https:' + url;
          if (url.startsWith('/')) {
            const baseUrl = normalizedDomain.replace(/\/$/, '');
            return baseUrl + url;
          }

          const baseUrl = normalizedDomain.replace(/\/$/, '');
          return baseUrl + '/' + url.replace(/^\.\//, '');
        };

        const validateAndNormalize = (urls: any[]): string[] => {
          if (!Array.isArray(urls)) return [];

          const uniqueUrls = new Set<string>();

          return urls
            .map(url => normalizeUrl(url))
            .filter(url => url && url.length > 0)
            .filter(url => {
              try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname.toLowerCase();

                if (pathname.includes('.svg')) return false;

                const hasAllowedExtension = CONFIG.MEDIA.VALID_IMAGE_EXTS.some(ext =>
                  pathname.includes(`.${ext}`)
                );

                const hasExtension = pathname.includes('.');
                if (!hasExtension) return true;

                return hasAllowedExtension;
              } catch {
                return false;
              }
            })
            .filter(url => {
              if (uniqueUrls.has(url)) return false;
              uniqueUrls.add(url);
              return true;
            })
            .slice(0, CONFIG.MEDIA.MAX_IMAGES);
        };

        const processProductsServices = (products: any): string => {
          if (Array.isArray(products)) {
            return products.map(product => {
              if (typeof product === 'object' && product.name && product.description) {
                return `${product.name}: ${product.description}`;
              }
              return typeof product === 'string' ? product : '';
            }).filter(p => p).join("");
          }

          return typeof products === 'string' ? products : '';
        };
        
        const data: DomainInfo = {
          brandName: parsed.brand_name || "",
          slogan: parsed.slogan || "",
          products: processProductsServices(parsed.product_or_service),
          logoUrl: normalizeUrl(parsed.logo_url || ""),
          imageUrls: validateAndNormalize(parsed.image_urls || [])
        };
        this.logger.log('Data',data);
        return data;

      } catch (err: any) {
        lastError = err;
        this.logger.error(`Attempt ${attempt}/${CONFIG.MEDIA.MAX_RETRIES} failed: ${err.message}`);

        if (
          err.message?.includes('Invalid domain') ||
          err.message?.includes('Authentication') ||
          err.message?.includes('ASSISTANT_ID')
        ) {
          break;
        }

        if (attempt < CONFIG.MEDIA.MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    const errorMessage = this.getUserFriendlyFetchError(lastError, domain);
    throw new Error(errorMessage);
  }

  private getUserFriendlyFetchError(error: any, domain: string): string {
    const msg = error?.message?.toLowerCase() || '';

    if (msg.includes('cannot navigate') || msg.includes('invalid url')) {
      return `Unable to access "${domain}". Please check the URL.`;
    }

    if (msg.includes('timeout') || msg.includes('navigation timeout')) {
      return `Website "${domain}" took too long to respond.`;
    }

    if (msg.includes('net::err') || msg.includes('name_not_resolved')) {
      return `Website "${domain}" cannot be found.`;
    }

    if (msg.includes('openai') || msg.includes('assistant')) {
      return `AI processing failed. Please try again.`;
    }

    if (msg.includes('parse') || msg.includes('json')) {
      return `Unable to extract data from "${domain}".`;
    }

    return `Unable to fetch information from "${domain}".`;
  }

  private normalizeUrl(domain: string): string {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Invalid domain: Domain cannot be empty');
    }

    domain = domain.trim();

    if (/^https?:\/\//i.test(domain)) return domain;

    domain = domain.replace(/^\/+/, '').replace(/^\/\//, '');

    if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(domain)) {
      throw new Error(`Invalid domain format: ${domain}`);
    }

    return `https://${domain}`;
  }

  async scrapeWebsiteMedia(domain: string, retryCount = 1): Promise<any> {
    let browser: any = null;
    let page: any = null;

    try {
      const normalizedUrl = this.normalizeUrl(domain);

      const browserConfig: any = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-features=IsolateOrigins,site-per-process"
        ]
      };

      if (os.platform() === 'linux') {
        browserConfig.executablePath = '/usr/bin/chromium-browser';
      }

      browser = await puppeteer.launch(browserConfig);
      page = await browser.newPage();

      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      await page.setRequestInterception(true);
      page.on("request", (req: any) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.TIMEOUTS.SCRAPING
      });

      await page.setDefaultTimeout(20000);

      const structuredData = await page.evaluate(() => {
        const data: any = {
          meta: {},
          jsonLd: [],
          images: [],
          videos: [],
          logo: null,
          title: document.title,
          description: ""
        };

        document.querySelectorAll("meta").forEach((meta) => {
          const name = meta.getAttribute("name") || meta.getAttribute("property");
          const content = meta.getAttribute("content");
          if (name && content) {
            data.meta[name] = content;
          }
          if (name === "description" || name === "og:description") {
            data.description = content;
          }
        });

        document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
          try {
            const jsonData = JSON.parse(script.textContent || "");
            data.jsonLd.push(jsonData);
          } catch {}
        });

        const logoFromJsonLd = data.jsonLd.find((ld: any) =>
          ld["@type"] === "Organization" || ld["@type"] === "Brand"
        )?.logo;

        if (logoFromJsonLd) {
          data.logo = typeof logoFromJsonLd === "string" ? logoFromJsonLd : logoFromJsonLd?.url;
        } else {
          const logoImg = document.querySelector(
            'img[src*="logo" i], img[alt*="logo" i], header img, nav img'
          );
          if (logoImg) {
            data.logo = logoImg.getAttribute("src") || logoImg.getAttribute("data-src");
          }
        }

        const imageSelectors = [
          '.product-gallery img',
          '.product-media img',
          '[data-gallery] img',
          '.product img',
          'meta[property="og:image"]'
        ];

        const imageSet = new Set<string>();
        imageSelectors.forEach(selector => {
          if (selector.includes('meta')) {
            const metaImg = document.querySelector(selector);
            if (metaImg) {
              const imgUrl = metaImg.getAttribute("content");
              if (imgUrl) imageSet.add(imgUrl);
            }
          } else {
            document.querySelectorAll(selector).forEach((img: any) => {
              const src = img.getAttribute("src") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy-src");
              if (src && !src.includes("favicon") && !src.includes("icon")) {
                imageSet.add(src);
              }
            });
          }
        });

        data.images = Array.from(imageSet).slice(0, 5);

        const videoSet = new Set<string>();
        document.querySelectorAll("video source, video").forEach((video: any) => {
          const src = video.getAttribute("src");
          if (src) videoSet.add(src);
        });

        document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]').forEach((iframe: any) => {
          const src = iframe.getAttribute("src");
          if (src) videoSet.add(src);
        });

        const ogVideo = document.querySelector('meta[property="og:video"]');
        if (ogVideo) {
          const videoUrl = ogVideo.getAttribute("content");
          if (videoUrl) videoSet.add(videoUrl);
        }

        data.videos = Array.from(videoSet);

        return data;
      });

      return { data: JSON.stringify(structuredData, null, 2) };

    } catch (err: any) {
      this.logger.error(`Puppeteer error (attempt ${retryCount}): ${err.message}`);

      if (
        retryCount < CONFIG.MEDIA.MAX_RETRIES &&
        (err.message.includes('Execution context') ||
         err.message.includes('Connection closed') ||
         err.message.includes('Navigation timeout') ||
         err.message.includes('ERR_NAME_NOT_RESOLVED'))
      ) {
        await new Promise(res => setTimeout(res, 2000));
        return this.scrapeWebsiteMedia(domain, retryCount + 1);
      }

      throw err;

    } finally {
      try {
        if (page && !page.isClosed()) await page.close();
      } catch (pageError: any) {
        this.logger.warn(`Page cleanup error: ${pageError.message}`);
      }

      try {
        if (browser) await browser.close();
      } catch (browserError: any) {
        this.logger.warn(`Browser cleanup error: ${browserError.message}`);
      }
    }
  }

  private containsHebrew(text?: string): boolean {
    if (!text) return false;
    return /[\u0590-\u05FF]/.test(text);
  }

  private resolveLanguage(data: {
    about?: string;
    product?: string;
    tagline?: string;
    voiceOver?: string;
    language?: string;
  }): 'Hebrew' | 'English' {
    const payloadLang = (data.language || '').toLowerCase();

    const autoHebrew =
      this.containsHebrew(data.about) ||
      this.containsHebrew(data.product) ||
      this.containsHebrew(data.tagline) ||
      this.containsHebrew(data.voiceOver);

    if (payloadLang.includes('hebrew')) return 'Hebrew';
    if (payloadLang.includes('english')) {
      if (autoHebrew) {
        this.logger.warn('Language conflict: payload=English, Hebrew text found → overriding to Hebrew');
        return 'Hebrew';
      }
      return 'English';
    }

    return autoHebrew ? 'Hebrew' : 'English';
  }

  async generateAIPromptFromData(data: {
    brandName: string;
    slogan?: string;
    product?: string;
    audience?: string;
    tagline?: string;
    style?: string;
    voiceOver?: string;
    deviceType: string;
    contentType?: 'image' | 'video';
    language?: string;
    source?: string;
  }): Promise<{ success: boolean; prompt: string; source?: string }> {
    try {
      // { 
//         this.logger.log('Data add on the input gpt prompt',data);
//       const contentType = data.contentType || 'image';
//       const isVideo = contentType === 'video';

//       const language = this.resolveLanguage(data);

//       const promoKeywords = /(sale|offer|discount|deal|off|festival|special|limited|promo|%)/i;
//       const campaignText = (data.style || '').trim();
//       const isCampaign = promoKeywords.test(campaignText);

//       const aesthetic = isCampaign
//         ? 'cinematic premium advertising'
//         : (data.style || 'cinematic premium advertising');

//       const targetModel = isVideo ? 'Google Veo 3' : 'Google Gemini 3';

//       const prompt = `
// You are an expert Prompt Engineer and AI Safety Officer.
// Write a highly optimized generation prompt for ${targetModel}.

// INPUT DATA:
// Brand: ${data.brandName}
// Product: ${data.product || 'Premium product'}
// Visual Style: ${aesthetic}
// ${data.voiceOver && isVideo ? `Voiceover context (do not visualize text): "${data.voiceOver}"` : ''}

// ${isCampaign ? `
// ⚠️ IMMUTABLE CAMPAIGN RULE:
// The campaign message MUST be used exactly as written:
// "${campaignText}"
// Do NOT translate it.
// Do NOT rewrite it.
// Do NOT replace it.

// ⚠️ CAMPAIGN PRIORITY:
// This campaign defines the mood and theme.
// ` : ''}

// ⚠️ LANGUAGE LOCK:
// All narration must be written ONLY in ${language}.
// Foreign words are forbidden unless they are part of a brand name or campaign text.

// SAFETY RULES:
// - No violence, hate, sexual content, or dangerous activity
// - No real celebrities or politicians
// - No copyrighted characters or franchises

// OUTPUT RULES:
// ${isVideo
//   ? `- Format: 8-second cinematic video
//      - Focus: camera motion, lighting realism, textures
//      - No on-screen text overlays
//      - Campaign influences mood only`
//   : `- Format: high-end marketing image
//      - Focus: studio lighting and composition
//      - Text policy: ${
//         isCampaign
//           ? `include brand "${data.brandName}" and campaign "${campaignText}" clearly`
//           : 'minimal or no text'
//       }`
// }

// - Length under 85 words
// - Return ONLY the final raw prompt
// `;

// // const prompt = `
// // You are a High-End Commercial Art Director. 
// // Write a visual generation prompt for ${targetModel} that focuses on luxury product photography.

// // INPUT DATA:
// // Product: ${data.product}
// // Style: ${aesthetic}

// // ⚠️ VISUAL PRIORITY:
// // Focus on the "Hero" bottle. Use macro photography terms: "shallow depth of field," "caustic light refractions through water," "soft-focus bathroom tiles," and "levitating rosemary leaves." 

// // ⚠️ TEXT RULE:
// // Place the campaign message "${campaignText}" and the brand "${data.brandName}" in the composition. Ensure the text looks like professional 3D typography integrated into the scene, not a flat overlay.

// // OUTPUT RULES:
// // - Format: cinematic marketing image.
// // - Focus: Describe textures (glass, water ripples, bubbles) and dramatic studio lighting (rim lighting, softbox).
// // - Do NOT repeat the product specs like "700ml" or "$9.89". Describe the VIBE.
// // - Length under 85 words.
// // - Return ONLY the final raw prompt.
// // `;
// this.logger.log('sendind to gpt-4o-mini', prompt);
//       const completion = await this.client.chat.completions.create({
//         model: 'gpt-4o-mini',
//         messages: [
//           { role: 'system', content: 'You generate safe, high-quality AI media prompts.' },
//           { role: 'user', content: prompt }
//         ],
//         temperature: 0.7,
//         max_tokens: 250,
//       });
//     }
this.logger.log('Data add on the input gpt prompt', data);

const contentType = data.contentType || 'image';
const isVideo = contentType === 'video';
const language = this.resolveLanguage(data) || data.language || 'English';

/* ---------------- IMAGE PROMPT ---------------- */

const imagePrompt = `
You are a world-class Advertising Prompt Architect specializing in cinematic, premium commercial visuals for generative image models, optimized for Google Gemini image models (including lightweight and Nano variants).

Your task is to convert structured brand and product information into ONE refined, high-performing image generation prompt that produces a **campaign-specific, conversion-focused advertising visual**.

## **Tasks and RULES**

1. **Campaign Purpose & Content Preference (CRITICAL)**

   * The **Preferred Content Style** defines the **campaign purpose** (e.g., Sale, Black Friday, Holiday Offer, New Launch, Educational, Informational, Funny, Lifestyle, Premium Branding).
   * This must influence the **entire visual world**, including environment, lighting mood, color palette, props, atmosphere, and visual energy.
   * **Conditional Rule (MANDATORY):**

     * If the campaign purpose is **sale-, offer-, discount-, or promotion-driven**, a **professionally designed, modern, stylish campaign banner or badge** must be generated with a **new, relevant punch line**, matching current e-commerce and advertising standards. The banner must be fully visible, premium, readable at a glance, and must never overlap, hide behind, or be obscured by the product.
     * If the campaign purpose is **educational, informational, funny, lifestyle, or awareness-based**, **NO promotional text, banner, badge, or headline should appear in the image**. The purpose must be conveyed **purely through visuals, composition, expression, environment, and context**, with zero on-image text beyond the brand logo and product packaging.

2. **Product-Centric Background Imagery (STRICT)**

   * Background must be conceptually derived from the product category and real-world use case.
   * The setting should feel aspirational, premium, and contextually correct.
   * Background must enhance clarity and desirability without overpowering the product or brand elements.

3. **Visual Style Generation (AUTO-DERIVED)**

   * Visual style must be automatically inferred from brand identity, product category, target audience, and campaign purpose.
   * Do NOT request visual style as a manual input.
   * The generated style must align with **current market and advertising standards**, avoiding outdated, flat, or placeholder aesthetics.

4. **Advertising-Grade Visual Quality**

   * Generate commercial-ready advertising imagery, not abstract or artistic visuals.
   * Product must be the primary hero with sharp focus, realistic materials, accurate proportions, and professional lighting.
   * Composition must follow modern ad photography principles with depth, contrast, and clear hierarchy.

5. **Brand Logo & Identity Integration (CRITICAL)**

   * The provided brand logo (from the attached asset) must be used exactly as supplied, without alteration, recreation, or stylization.
   * Logo placement must follow real-world advertising best practices, positioned in a clear brand-safe zone (top corner, header area, or designated placeholder).
   * Logo must never be hidden, cropped, merged into the background, or treated as decorative texture.

6. **Brand & Product Fidelity**

   * Product appearance must match the supplied reference image precisely.
   * Do not invent features, claims, packaging changes, or exaggerated effects.
   * Brand presence must feel credible, premium, and trustworthy.

7. **Text & Layout Protection (STRICT)**

   * Do NOT modify, paraphrase, translate, or reinterpret brand names or product text.
   * Maintain clean negative space around logos, products, and any promotional banners.
   * Ensure clear separation between product, logo, and campaign elements.

8. **Safety & Platform Compliance**

   * Family-safe, globally compliant, and suitable for all major advertising platforms.
   * No celebrities, copyrighted characters, unsafe actions, or sensitive content.

9. **Language & Prompt Discipline**

   * Language: ${data.language || 'English'}
   * Neutral, professional, advertising-focused tone.
   * Describe only what is visually present, with no marketing claims or hype language.

## **Output Format**

1. Return ONLY one final Gemini-ready image generation prompt
2. Single paragraph, **120–150 words maximum**
3. No markdown, no explanations, no lists
4. Aspect ratio **16:9**

----------------------------
## **Here's the INPUT DATA**
Brand: ${data.brandName || ''}
Product: ${data.product || ''}
Campaign Purpose: ${data.style || ''}
---------------------------
`;

/* ---------------- VIDEO PROMPT ---------------- */

const videoPrompt = `
You are an expert commercial Prompt Engineer.

Create a premium, high-converting cinematic video prompt for Google Veo 3.

STRICT RULES:
- 8-second commercial
- Stunning advertising quality
- Realistic lighting and smooth camera motion
- Product must be the hero focal point
- No on-screen text overlays
- No clutter or overlapping elements
- Background must match product and brand identity
- Campaign defines mood only
- Use ONLY ${language}
- Under 85 words
- Return ONLY the final raw prompt

INPUT DATA (USE NATURALLY):
Brand: ${data.brandName}
Product/Service: ${data.product || 'Premium offering'}
Campaign Mood: ${data.style || 'None'}
Aspect Ratio: ${data.deviceType}
`;


const prompt = isVideo ? videoPrompt : imagePrompt;

this.logger.log('sending to gpt-4o-mini', prompt);

const completion = await this.client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You generate safe, high-quality AI media prompts.' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.7,
  max_tokens: 250,
});
      let generatedPrompt = completion.choices[0]?.message?.content?.trim();
      this.logger.log('return from gpt-4o-mini', generatedPrompt);
      if (!generatedPrompt) throw new Error('No prompt generated');

      const unsafeKeywords = /nude|blood|kill|attack|naked|nsfw/i;
      if (unsafeKeywords.test(generatedPrompt)) {
        generatedPrompt =
          language === 'Hebrew'
            ? `צילום קולנועי של המוצר ${data.brandName} ${data.product || 'מוצר'}, תאורת סטודיו מקצועית וקומפוזיציה אלגנטית.`
            : `Cinematic product shot of ${data.brandName} ${data.product || 'product'}, professional studio lighting and elegant composition.`;
      }

      if (language === 'Hebrew' && /[a-zA-Z]/.test(generatedPrompt)) {
        this.logger.warn('English characters detected in Hebrew output');
      }

      return {
        success: true,
        prompt: generatedPrompt,
        source: data.source,
      };

    } catch (error: any) {
      this.logger.error(`AI prompt generation failed: ${error.message}`);
      return {
        success: false,
        prompt: '',
        source: data.source,
      };
    }
  }
}
