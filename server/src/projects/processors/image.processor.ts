// src/projects/processors/image.processor.ts
import { 
  Process, 
  Processor, 
  OnQueueActive, 
  OnQueueCompleted, 
  OnQueueFailed 
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from '../schemas/project.schema';
import { ProjectGallery } from '../schemas/project-gallery.schema';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Storage } from '@google-cloud/storage';
import { User } from '../../users/schemas/user.schema'; 

// ✅ Configuration constants
const IMAGE_TIMEOUT_MS = 60000; // 60 seconds
const WATERMARK_FETCH_TIMEOUT_MS = 10000; // 10 seconds
const MAX_IMAGE_SIZE_MB = 50; // 50MB

@Processor('image-generation')
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);
  private readonly geminiClient: any;
  private readonly storage: Storage;

  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(ProjectGallery.name) private projectGalleryModel: Model<any>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  @Process({
    name: 'generate-image',
    concurrency: 10,
  })
  async handleImageGeneration(job: Job) {
    // ✅ FIX #5: Validate job data first
    this.validateJobData(job.data);
    
    const { userId, projectId, project, options, pendingId } = job.data;

    this.logger.log(`🎨 [Job ${job.id}] Starting image generation for project: ${projectId}`);
    this.logger.log(`📋 [Job ${job.id}] PendingId: ${pendingId}`);

    try {
      await job.progress(10);
      
      // Check image limit
      const limitCheck = await this.checkImageLimit(userId);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message || 'Image generation limit exceeded');
      }

      // Build prompt
      let imagePrompt = `Create a professional marketing advertisement image:\n\n`;
      imagePrompt += `Brand: ${project.brandName}\n`;
      imagePrompt += `Niche: ${project.niche}\n`;
      imagePrompt += `Style: ${project.style}\n\n`;
      imagePrompt += `**Content:**\n${options.storyboard}\n\n`;

      if (options.useLogo && project.logoUrl) {
        imagePrompt += `\n**LOGO INTEGRATION:**\n`;
        imagePrompt += `- Include the brand logo prominently\n`;
      }

      if (options.useSlogan && project.slogan) {
        imagePrompt += `\n**SLOGAN:** "${project.slogan}"\n`;
      }

      imagePrompt += `\n**STYLE:** Photorealistic, 16:9, professional marketing image\n`;

      await job.progress(30);
      
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Build content array
      const imageContentArray: any[] = [];
      let watermarkAdded = false;

      // ✅ FIX #3: Better watermark error handling
      // if (user.currentPlanName === 'free') {
      //   try {
      //     const sambaLogoUrl = 'https://samba.ink/sambaWaterMark.png';
      //     const { base64: sambaBase64, mimeType: sambaMimeType } = await this.fetchImageAsBase64(
      //       sambaLogoUrl,
      //       WATERMARK_FETCH_TIMEOUT_MS
      //     );
          
      //     imageContentArray.push({
      //       inlineData: { mimeType: sambaMimeType, data: sambaBase64 },
      //     });

      //     imagePrompt += `\n\n**CENTER WATERMARK (MANDATORY - USE FIRST IMAGE):**\n`;
      //     imagePrompt += `- **CENTER** samba.ink logo (FIRST image), 8-12% opacity background overlay\n`;
      //     imagePrompt += `- Size: 25% image width, perfectly centered\n`;
      //     imagePrompt += `- Main content renders OVER watermark (stays crisp/professional)\n`;
          
      //     watermarkAdded = true;
      //     this.logger.log(`✅ [Job ${job.id}] Clipsyfy watermark added`);
      //   } catch (error) {
      //     this.logger.warn(`⚠️ [Job ${job.id}] Clipsyfy watermark fetch failed: ${error.message}`);
      //     imagePrompt += `\n**NOTE:** Generate without watermark overlay\n`;
      //   }
      // }

      // Add logo if available
      if (options.useLogo && project.logoViewUrl) {
        try {
          const API_URL = process.env.API_URL || 'http://localhost:3001';
          const fullLogoUrl = project.logoViewUrl.startsWith('http')
            ? project.logoViewUrl
            : `${API_URL}/${project.logoViewUrl}`;

          const { base64, mimeType } = await this.fetchImageAsBase64(fullLogoUrl);
          imageContentArray.push({
            inlineData: {
              mimeType,
              data: base64,
            },
          });
          this.logger.log(`✅ [Job ${job.id}] Brand logo added`);
        } catch (error) {
          this.logger.warn(`⚠️ [Job ${job.id}] Logo fetch failed: ${error.message}`);
        }
      }

      imageContentArray.push({ text: imagePrompt });
      
      // ✅ FIX #4: Use logger instead of console.log
      this.logger.debug(`📦 [Job ${job.id}] Content array has ${imageContentArray.length} items`);
      
      await job.progress(50);

      // ✅ FIX #1: Generate with timeout
      const model = this.geminiClient.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
      });

      this.logger.log(`📤 [Job ${job.id}] Sending request to Gemini...`);
      
      const imageResponse = await this.generateImageWithTimeout(model, {
        contents: [{ parts: imageContentArray }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1000,
        },
      }, IMAGE_TIMEOUT_MS);

      this.logger.log(`✅ [Job ${job.id}] Gemini response received`);
      await job.progress(70);

      // Extract image
      const parts = imageResponse.response?.candidates?.[0]?.content?.parts;
      
      if (!parts) {
        throw new Error('No image generated');
      }

      let base64Data: string | null = null;
      let mimeType: string | null = null;

      for (const part of parts) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
          break;
        }
      }

      if (!base64Data || !mimeType) {
        throw new Error('No image data found');
      }

      await job.progress(80);

      // Upload to GCS
      const buffer = Buffer.from(base64Data, 'base64');
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      this.logger.log(`📦 [Job ${job.id}] Image size: ${sizeMB} MB`);
      
      // ✅ Check image size
      if (buffer.length > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        throw new Error(`Image too large: ${sizeMB}MB (max: ${MAX_IMAGE_SIZE_MB}MB)`);
      }

      const extension = mimeType.split('/')[1] || 'png';
      const timestamp = Date.now();
      const sanitizedBrandName = project.brandName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `generated-images/${timestamp}-${sanitizedBrandName}.${extension}`;

      const bucketName = process.env.GCP_BUCKET_NAME!;
      const bucket = this.storage.bucket(bucketName);
      const blob = bucket.file(filename);

      await blob.save(buffer, {
        contentType: mimeType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      this.logger.log(`✅ [Job ${job.id}] Uploaded to GCS: ${filename}`);

      const gcsPath = filename;
      const downloadUrl = `projects/files/download?filename=${encodeURIComponent(gcsPath)}`;
      const viewUrl = `projects/files/view?filename=${encodeURIComponent(gcsPath)}`;

      await job.progress(90);

      // Add to gallery
      await this.addToProjectGallery(userId, projectId, 'image', {
        url: gcsPath,
        viewUrl,
        downloadUrl,
      });

      await this.incrementImageUsage(userId, projectId, project.brandName, {
        gcsPath,
        viewUrl,
        downloadUrl,
        filename: `${project.brandName}-image.${extension}`,
      });

      // ✅ FIX #2: Update conversation with error recovery
      await this.updateConversationWithCompletedImage(
        projectId,
        pendingId,
        viewUrl,
        downloadUrl,
        project.brandName
      );

      await job.progress(100);

      this.logger.log(`🎉 [Job ${job.id}] Image generation complete!`);

      return {
        success: true,
        contentType: 'image',
        url: downloadUrl,
        viewUrl,
        gcsPath,
        filename: `${project.brandName}-image.${extension}`,
        message: watermarkAdded 
          ? 'Image generated successfully with watermark!'
          : 'Image generated successfully!',
        pendingId,
      };
    } catch (error) {
      this.logger.error(`❌ [Job ${job.id}] Image generation failed:`, error.stack);
      throw error;
    }
  }

  /**
   * ✅ FIX #5: Validate job data
   */
  private validateJobData(data: any): void {
    const required = ['userId', 'projectId', 'project', 'options', 'pendingId'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required job data: ${missing.join(', ')}`);
    }
    
    if (!data.project.brandName) {
      throw new Error('Missing project.brandName');
    }
    
    if (!data.options.storyboard) {
      throw new Error('Missing options.storyboard');
    }
  }

  /**
   * ✅ FIX #1: Generate image with timeout protection
   */
  private async generateImageWithTimeout(model: any, content: any, timeoutMs: number) {
    return Promise.race([
      model.generateContent(content),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Image generation timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * ✅ FIX #2: Update conversation with error recovery
   */
  private async updateConversationWithCompletedImage(
    projectId: string,
    pendingId: string,
    viewUrl: string,
    downloadUrl: string,
    brandName: string
  ) {
    try {
      this.logger.log(`📝 Updating conversation for pendingId: ${pendingId}`);

      const project = await this.projectModel.findById(projectId);
      
      if (!project) {
        this.logger.warn(`⚠️ Project not found: ${projectId}`);
        return;
      }

      if (!project.aiConversationLog) {
        project.aiConversationLog = [];
      }

      // Find the pending message
      const pendingMsgIndex = project.aiConversationLog.findIndex(
        (msg: any) => 
          msg.metadata?.pendingId === pendingId && 
          msg.metadata?.status === 'pending'
      );

      if (pendingMsgIndex !== -1) {
        this.logger.log(`✅ Found pending message at index ${pendingMsgIndex}, updating...`);
        
        // Update the pending message to completed
        project.aiConversationLog[pendingMsgIndex].metadata.status = 'completed';
        project.aiConversationLog[pendingMsgIndex].content = 
          `✅ **Image generated successfully!**\n\n` +
          `![Generated Image](${viewUrl})\n\n` +
          `**Download your image:**\n` +
          `[📥 Download Image](${viewUrl})`;
        
        project.aiConversationLog[pendingMsgIndex].metadata.imageUrl = viewUrl;
        project.aiConversationLog[pendingMsgIndex].metadata.downloadUrl = downloadUrl;
        project.aiConversationLog[pendingMsgIndex].metadata.mediaPreview = {
          type: 'image',
          url: viewUrl,
          downloadUrl: downloadUrl,
        };

        this.logger.log(`✅ Updated existing pending message to completed`);
      } else {
        this.logger.warn(`⚠️ Pending message not found for pendingId: ${pendingId}, adding new message`);
        
        // Fallback: Add new completed message
        const completedMessage = {
          role: 'assistant' as const,
          content: 
            `✅ **Image generated successfully!**\n\n` +
            `![Generated Image](${viewUrl})\n\n` +
            `**Download your image:**\n` +
            `[📥 Download Image](${viewUrl})`,
          timestamp: new Date(),
          metadata: {
            type: 'image_completed',
            status: 'completed',
            contentType: 'image',
            pendingId: pendingId,
            imageUrl: viewUrl,
            downloadUrl: downloadUrl,
            mediaPreview: {
              type: 'image',
              url: viewUrl,
              downloadUrl: downloadUrl,
            },
          },
        };
        
        project.aiConversationLog.push(completedMessage);
      }

      // Save to database
      project.markModified('aiConversationLog');
      await project.save();
      
      this.logger.log(`✅ Conversation updated successfully for ${brandName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to update conversation:`, error);
      
      // ✅ FIX #2: Try updating project status as fallback
      try {
        await this.projectModel.findByIdAndUpdate(projectId, {
          $set: { 
            'latestGeneration.type': 'image',
            'latestGeneration.url': viewUrl,
            'latestGeneration.status': 'completed',
            'latestGeneration.timestamp': new Date()
          }
        });
        this.logger.log('✅ Updated project status as fallback');
      } catch (fallbackError) {
        this.logger.error('❌ Fallback update also failed:', fallbackError);
      }
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`🎨 Processing image job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`✅ Image job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Image job ${job.id} failed: ${error.message}`);
  }

  /**
   * ✅ FIX #3: Fetch image with timeout
   */
  private async fetchImageAsBase64(imageUrl: string, timeoutMs: number = 10000): Promise<{ base64: string; mimeType: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(imageUrl, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/png';

      return { base64, mimeType };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async addToProjectGallery(
    userId: string,
    projectId: string,
    type: 'image',
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
        $push: { imageUrls: mediaItem },
      },
      {
        new: true,
        upsert: true,
      },
    );
  }

  private async checkImageLimit(userId: string): Promise<{ allowed: boolean; remaining: number; message?: string }> {
    try {
      const user = await this.userModel.findById(userId);
      
      if (!user) {
        return { allowed: false, remaining: 0, message: 'User not found' };
      }

      // const imageLimit = user.currentLimits?.imageLimit || 4;
      // const imagesUsed = user.monthlyUsage?.images || 0;
       const imageLimit =  4;
      const imagesUsed = 0;


      this.logger.log(`📊 Image Limit Check: ${imagesUsed}/${imageLimit} used`);

      if (imagesUsed >= imageLimit) {
        return {
          allowed: false,
          remaining: 0,
          message: `Image generation limit reached. You've used ${imagesUsed}/${imageLimit} images this month. Please upgrade your plan.`
        };
      }

      return {
        allowed: true,
        remaining: imageLimit - imagesUsed
      };
    } catch (error) {
      this.logger.error('Error checking image limit:', error);
      return { allowed: false, remaining: 0, message: 'Error checking limits' };
    }
  }

  private async incrementImageUsage(
    userId: string,
    projectId: string,
    brandName: string,
    imageData: { gcsPath: string; viewUrl: string; downloadUrl: string; filename: string }
  ) {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'monthlyUsage.images': 1 }
      });

      this.logger.log(`✅ Image usage tracked for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to track image usage:', error);
    }
  }
}
