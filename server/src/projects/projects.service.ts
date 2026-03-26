import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Storage } from '@google-cloud/storage';
import { OpenAI } from 'openai';
import axios from 'axios';
import { Readable } from 'stream';
import { Gallery, GalleryDocument } from '../video/schema/gallery.schema';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import {
  ProjectGallery,
  ProjectGalleryDocument,
} from './schemas/project-gallery.schema';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from './schemas/product.schema';
import { Brand } from './schemas/brand.schema';
// ==================== TYPE DEFINITIONS ====================
interface MediaFileUpload {
  gcsPath: string;
  downloadUrl: string;
  viewUrl: string;
  filename: string;
  type: 'image' | 'video';
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

interface GalleryMediaData {
  type: 'image' | 'video';
  url: string;
  filename: string;
  imageId?: string;
  imageURL?: string;
  contentType?: string;
  storyboard?: string;
  usedLogo?: boolean;
  usedSlogan?: boolean;
  status?: 'completed' | 'pending';
  operationName?: string;
}

interface VideoGenerationResult {
  operationName: string;
  startTimestamp: string;
}

interface PollingResult {
  success: boolean;
  isPending: boolean;
  downloadUrl?: string;
  viewUrl?: string;
  gcsPath?: string;
  filename?: string;
  totalVideos?: number;
  isRateLimited?: boolean;
  isRetry?: boolean;
  message?: string;
}

@Injectable()
export class ProjectsService {
  private readonly storage: Storage;
  private readonly openaiClient: OpenAI;
  private readonly geminiClient: any;
  private readonly vertexAI: VertexAI;

  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Brand.name) private brandModel: Model<Brand>,
    @InjectModel(Gallery.name) private galleryModel: Model<GalleryDocument>,
    @InjectModel(ProjectGallery.name)
    private projectGalleryModel: Model<ProjectGalleryDocument>,
    @InjectQueue('video-generation') private videoQueue: Queue,
    @InjectQueue('image-generation') private imageQueue: Queue,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // Initialize GCS
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Initialize OpenAI
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize Gemini
    this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: 'us-central1',
    });
  }

  private readonly logger = new Logger(ProjectsService.name);

  // ==================== HELPER METHODS ====================

  /**
   * Convert various types to boolean
   */
  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return false;
  }

  /**
   * Convert various types to number
   */
  private toNumber(value: any): number {
    if (typeof value === 'number') return value;
    const parsed = parseInt(value?.toString() || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Generate download URL
   */
  private generateDownloadUrl(gcsPath: string): string {
    return `projects/files/download?filename=${encodeURIComponent(gcsPath)}`;
  }

  /**
   * Generate view URL
   */
  private generateViewUrl(gcsPath: string): string {
    return `projects/files/view?filename=${encodeURIComponent(gcsPath)}`;
  }

  /**
   * Upload file to GCS
   */
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

    const stream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    return new Promise((resolve, reject) => {
      stream.on('error', (err) => {
        console.error('❌ GCS Upload error detailed:', err);
        reject(new BadRequestException(`Failed to upload file to GCS: ${err.message}`));
      });

      stream.on('finish', () => {
        console.log('✅ GCS UPLOADED:', filename);
        resolve(filename);
      });

      stream.end(file.buffer);
    });
  }

  /**
   * Get GCP Access Token
   */
  private async getGcpAccessToken(): Promise<string> {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('Failed to obtain GCP access token');
    return token;
  }

  /**
   * Remove duplicate questions from AI response
   */
  private removeDuplicateQuestions(response: string): string {
    const lines = response.split('\n');
    const seenQuestions = new Set<string>();
    const cleanLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (/\?\s*\(Reply Yes or No\)/i.test(trimmedLine)) {
        const normalized = trimmedLine.replace(/\s+/g, ' ').toLowerCase();

        if (!seenQuestions.has(normalized)) {
          seenQuestions.add(normalized);
          cleanLines.push(line);
        }
      } else {
        cleanLines.push(line);
      }
    }

    return cleanLines.join('\n').trim();
  }

  /**
   * Extract storyboard from conversation history
   */
  private extractStoryboardFromHistory(conversationHistory: any[]): string {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (
        msg.role === 'assistant' &&
        (msg.content.includes('Scene') || msg.content.includes('0-2s'))
      ) {
        return msg.content;
      }
    }
    return '';
  }

  // ==================== GALLERY METHODS ====================

  /**
   * Add to project gallery
   */
  private async addToProjectGallery(
    userId: string,
    projectId: string,
    type: 'storyboard' | 'image' | 'video',
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
        ...(type === 'storyboard' && { $push: { storyboardUrls: mediaItem } }),
        ...(type === 'image' && { $push: { imageUrls: mediaItem } }),
        ...(type === 'video' && { $push: { videoUrls: mediaItem } }),
      },
      {
        new: true,
        upsert: true,
      },
    );
  }

  // ==================== PROJECT CRUD ====================

  /**
   * Generate weekly content calendar
   */
  private async generateWeeklyContentCalendar(
    projectData: any,
  ): Promise<string> {
    const prompt = `You are now a marketing executive of a big marketing agency.

Please create a detailed marketing plan for social postings (videos and images).

Plan Details:
- Videos per week: ${projectData.videosPerWeek || 0}
- Images per week: ${projectData.imagesPerWeek || 0}
- Company name: ${projectData.brandName}
- Slogan: ${projectData.slogan || 'N/A'}
- Niche: ${projectData.niche}
- Target Audience: ${projectData.audience}
- Content Style: ${projectData.style}
- Products/Services: ${projectData.products || 'N/A'}

Make a plan and create the marketing calendar by week.`;

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional marketing executive specializing in social media content planning.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return (
      completion.choices[0]?.message?.content || 'Unable to generate calendar.'
    );
  }

  /**
   * Create project
   */
  //commented by aman on 18 march old code
  // async create(
  //   userId: string,
  //   createProjectDto: CreateProjectDto,
  //   files?: {
  //     logo?: Express.Multer.File[];
  //     mediaFiles?: Express.Multer.File[];
  //   },
  // ) {
  //   const projectData: any = {
  //     userId: new Types.ObjectId(userId),
  //     projectName: createProjectDto.projectName,
  //     brandName: createProjectDto.brandName,
  //     niche: createProjectDto.niche,
  //     audience: createProjectDto.audience,
  //     slogan: createProjectDto.slogan,
  //     products: createProjectDto.products,
  //     domain: createProjectDto.domain,
  //     style: createProjectDto.style,
  //     wantsWeeklyPlan: this.toBoolean(createProjectDto.wantsWeeklyPlan),
  //     videosPerWeek: this.toNumber(createProjectDto.videosPerWeek),
  //     imagesPerWeek: this.toNumber(createProjectDto.imagesPerWeek),
  //     conversationLog: createProjectDto.conversationLog || [],
  //     status: 'active',
  //     lastActivityAt: new Date(),
  //   };

  //   // Upload logo
  //   if (files?.logo && files.logo.length > 0) {
  //     const logoGcsPath = await this.uploadToGCS(files.logo[0], 'project-logos');
  //     projectData.logoGcsPath = logoGcsPath;
  //     projectData.logoUrl = this.generateDownloadUrl(logoGcsPath);
  //     projectData.logoViewUrl = this.generateViewUrl(logoGcsPath);
  //   }

  //   // Upload media files
  //   if (files?.mediaFiles && files.mediaFiles.length > 0) {
  //     const mediaUploadResults: MediaFileUpload[] = [];

  //     for (const file of files.mediaFiles) {
  //       const isVideo = /\.(mp4|mov|avi|webm)$/i.test(file.originalname);
  //       const folder = isVideo ? 'project-videos' : 'project-images';

  //       const gcsPath = await this.uploadToGCS(file, folder);
  //       mediaUploadResults.push({
  //         gcsPath,
  //         downloadUrl: this.generateDownloadUrl(gcsPath),
  //         viewUrl: this.generateViewUrl(gcsPath),
  //         filename: gcsPath.split('/').pop()!,
  //         type: isVideo ? 'video' : 'image',
  //         originalName: file.originalname,
  //         mimeType: file.mimetype,
  //         size: file.size,
  //         createdAt: new Date(),
  //       });
  //     }

  //     projectData.mediaFiles = mediaUploadResults;
  //   }

  //   // Generate calendar if needed
  //   if (
  //     projectData.wantsWeeklyPlan &&
  //     (projectData.videosPerWeek > 0 || projectData.imagesPerWeek > 0)
  //   ) {
  //     try {
  //       projectData.weeklyContentCalendar = await this.generateWeeklyContentCalendar(
  //         projectData,
  //       );
  //     } catch (error) {
  //       console.error('⚠️ Calendar generation failed:', error);
  //       projectData.weeklyContentCalendar = null;
  //     }
  //   }

  //   const newProject = new this.projectModel(projectData);
  //   const savedProject = await newProject.save();

  //   return savedProject.toObject();
  // }

  //written by aman on 18march new code

  async create(
    userId: string,
    createProjectDto: CreateProjectDto,
    files?: {
      logo?: Express.Multer.File[];
      mediaFiles?: Express.Multer.File[];
    },
  ) {
    const projectData: any = {
      userId: new Types.ObjectId(userId),
      projectName: createProjectDto.projectName,
      brandName: createProjectDto.brandName,
      niche: createProjectDto.niche,
      industry: createProjectDto.industry,
      description: createProjectDto.description,
      audience: createProjectDto.audience,
      slogan: createProjectDto.slogan,
      products: createProjectDto.products,
      domain: createProjectDto.domain,
      style: createProjectDto.style,
      wantsWeeklyPlan: this.toBoolean(createProjectDto.wantsWeeklyPlan),
      videosPerWeek: this.toNumber(createProjectDto.videosPerWeek),
      imagesPerWeek: this.toNumber(createProjectDto.imagesPerWeek),
      conversationLog: createProjectDto.conversationLog || [],
      status: 'active',
      lastActivityAt: new Date(),
    };

    if (createProjectDto.products && Array.isArray(createProjectDto.products)) {
      for (const product of createProjectDto.products) {
        await this.productModel.create({
          productName: product.productName,
          productImage: product.productImage,
        });
      }
    }

    const brandData: any = {
      brandName: createProjectDto.brandName,
      industry: createProjectDto.industry,
      description: createProjectDto.description,
      slogan: createProjectDto.slogan,
      products: createProjectDto.products,
    };

    await this.brandModel.create(brandData);

    // Upload logo
    if (files?.logo && files.logo.length > 0) {
      const logoGcsPath = await this.uploadToGCS(
        files.logo[0],
        'project-logos',
      );
      projectData.logoGcsPath = logoGcsPath;
      projectData.logoUrl = this.generateDownloadUrl(logoGcsPath);
      projectData.logoViewUrl = this.generateViewUrl(logoGcsPath);
    }

    // Upload media files
    if (files?.mediaFiles && files.mediaFiles.length > 0) {
      const mediaUploadResults: MediaFileUpload[] = [];

      for (const file of files.mediaFiles) {
        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(file.originalname);
        const folder = isVideo ? 'project-videos' : 'project-images';

        const gcsPath = await this.uploadToGCS(file, folder);
        mediaUploadResults.push({
          gcsPath,
          downloadUrl: this.generateDownloadUrl(gcsPath),
          viewUrl: this.generateViewUrl(gcsPath),
          filename: gcsPath.split('/').pop()!,
          type: isVideo ? 'video' : 'image',
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          createdAt: new Date(),
        });
      }

      projectData.mediaFiles = mediaUploadResults;
    }

    // Generate calendar if needed
    if (
      projectData.wantsWeeklyPlan &&
      (projectData.videosPerWeek > 0 || projectData.imagesPerWeek > 0)
    ) {
      try {
        projectData.weeklyContentCalendar =
          await this.generateWeeklyContentCalendar(projectData);
      } catch (error) {
        console.error('⚠️ Calendar generation failed:', error);
        projectData.weeklyContentCalendar = null;
      }
    }

    const newProject = new this.projectModel(projectData);
    const savedProject = await newProject.save();

    return savedProject.toObject();
  }

  /**
   * Find all projects by user
   */
  async findByUserId(userId: string) {
    return this.projectModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $ne: 'deleted' },
      })
      .sort({ lastActivityAt: -1 })
      .exec();
  }

  /**
   * Find one project
   */
  async findOne(userId: string, projectId: string) {
    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  /**
   * Update project
   */
  async update(
    userId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    files?: {
      logo?: Express.Multer.File[];
      mediaFiles?: Express.Multer.File[];
    },
  ) {
    const project = await this.findOne(userId, projectId);

    if (files?.logo && files.logo.length > 0) {
      const logoGcsPath = await this.uploadToGCS(
        files.logo[0],
        'project-logos',
      );
      updateProjectDto['logoGcsPath'] = logoGcsPath;
      updateProjectDto['logoUrl'] = this.generateDownloadUrl(logoGcsPath);
      updateProjectDto['logoViewUrl'] = this.generateViewUrl(logoGcsPath);
    }

    if (files?.mediaFiles && files.mediaFiles.length > 0) {
      const newMediaFiles: MediaFileUpload[] = [];

      for (const file of files.mediaFiles) {
        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(file.originalname);
        const folder = isVideo ? 'project-videos' : 'project-images';

        const gcsPath = await this.uploadToGCS(file, folder);
        newMediaFiles.push({
          gcsPath,
          downloadUrl: this.generateDownloadUrl(gcsPath),
          viewUrl: this.generateViewUrl(gcsPath),
          filename: gcsPath.split('/').pop()!,
          type: isVideo ? 'video' : 'image',
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          createdAt: new Date(),
        });
      }

      updateProjectDto['mediaFiles'] = [
        ...(project.mediaFiles || []),
        ...newMediaFiles,
      ];
    }

    updateProjectDto['lastActivityAt'] = new Date();

    return await this.projectModel.findByIdAndUpdate(
      projectId,
      { $set: updateProjectDto },
      { new: true },
    );
  }

  /**
   * Archive project
   */
  async archive(userId: string, projectId: string) {
    await this.findOne(userId, projectId);

    const archivedProject = await this.projectModel.findByIdAndUpdate(
      projectId,
      {
        $set: {
          status: 'archived',
          lastActivityAt: new Date(),
        },
      },
      { new: true },
    );

    return {
      message: 'Project archived successfully',
      project: archivedProject,
    };
  }

  // ==================== AI & CONTENT GENERATION ====================

  /**
   * Generate weekly calendar
   */
  async generateWeeklyCalendar(userId: string, projectId: string) {
    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.wantsWeeklyPlan) {
      throw new BadRequestException('Weekly plan not enabled for this project');
    }

    if (project.weeklyContentCalendar) {
      return {
        success: true,
        message: 'Calendar already generated',
        calendar: project.weeklyContentCalendar,
        cached: true,
      };
    }

    const prompt = `You are now a marketing executive of a big marketing agency.
Please create a detailed 1-week marketing plan for social media postings (videos and images).

Requirements:

- Company Name: ${project.brandName}
- Videos per week: ${project.videosPerWeek || 0} 
- Video time limit is maximum 8 second 
- Images per week: ${project.imagesPerWeek || 0}

- Include:
- Weekly theme
- Marketing objective
- Publishing schedule
- Numbering-wise single list of all (${project.videosPerWeek || 0} videos + ${project.imagesPerWeek || 0} images)

The output must end with this question:
"Please choose any number from the above video and image to get a complete detailed information?"
`;

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const rawText = completion.choices[0]?.message?.content || '';

    if (!rawText || rawText.trim().length === 0) {
      throw new BadRequestException('ChatGPT returned empty response');
    }

    project.weeklyContentCalendar = rawText;

    if (!project.aiConversationLog) {
      project.aiConversationLog = [];
    }

    project.aiConversationLog = [
      {
        role: 'assistant' as const,
        content: rawText,
        timestamp: new Date(),
      },
    ];

    await project.save();

    return {
      success: true,
      message: 'Calendar generated successfully',
      calendar: rawText,
      cached: false,
    };
  }

  /**
   * Generate storyboard image with Gemini
   */
  private async generateStoryboardImageWithGemini(
    userId: string,
    projectId: string,
    brandName: string,
    storyboardDescription: string,
    style: string,
  ): Promise<any> {
    const imagePrompt = `
Create a professional storyboard infographic for "${brandName}".

${storyboardDescription}

**VISUAL REQUIREMENTS:**
- Design Style: Clean infographic layout with multiple panels/frames
- Format: Comic-style storyboard with 4-6 sequential panels arranged in a grid
- Each panel should show: 
  * Simple sketch/illustration of the scene
  * Time marker (e.g., "0-2s", "2-4s")
  * Brief text description below each frame
- Typography: Modern sans-serif fonts for labels and descriptions
- Color Scheme: Use only black and white/light gray backgrounds
- Visual Style: ${style}
- Layout: Horizontal storyboard grid (4 panels in 2 rows or 6 panels in 2 rows)
- Aspect Ratio: 16:9 landscape format suitable for presentation

**INFOGRAPHIC ELEMENTS:**
- Panel borders: Clean, thin black or gray lines
- Time stamps: Bold, clearly visible (e.g., "Scene 1: 0-2s")
- Illustrations: Simple line art or flat design style (not photorealistic)
- Text descriptions: Short, readable captions under each panel
- Brand identity: Logo placement, color consistency throughout
- Professional layout: Balanced composition with clear visual hierarchy

**INSTRUCTIONS:**
- Don't use logo
- Create a storyboard infographic that clearly shows the video sequence
- Use illustration/sketch style rather than photorealistic rendering
- Ensure text is large and readable
- Maintain clean, organized grid layout
- Focus on clarity and visual storytelling
    `.trim();

    const imageContentArray: any[] = [];
    imageContentArray.push({ text: imagePrompt });

    const model = this.geminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    const imageResponse = await model.generateContent({
      contents: [{ parts: imageContentArray }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1000,
      },
    });

    if (
      imageResponse.response?.candidates &&
      imageResponse.response.candidates.length > 0 &&
      imageResponse.response.candidates[0].content?.parts
    ) {
      for (const part of imageResponse.response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;

          if (!base64Data || !mimeType) {
            continue;
          }

          const buffer = Buffer.from(base64Data, 'base64');
          const extension = mimeType.split('/')[1] || 'png';

          const file: Express.Multer.File = {
            buffer,
            originalname: `${brandName}-storyboard-${Date.now()}.${extension}`,
            mimetype: mimeType,
            fieldname: '',
            encoding: '',
            size: buffer.length,
            stream: new Readable(),
            destination: '',
            filename: '',
            path: '',
          };

          const gcsPath = await this.uploadToGCS(file, 'storyboard-images');
          const downloadUrl = this.generateDownloadUrl(gcsPath);
          const viewUrl = this.generateViewUrl(gcsPath);

          await this.addToProjectGallery(userId, projectId, 'storyboard', {
            url: gcsPath,
            viewUrl: viewUrl,
            downloadUrl: downloadUrl ?? viewUrl,
          });

          const aiResponse = `Here's your storyboard infographic:\n\n![Storyboard Infographic](${viewUrl})\n\nAre you satisfied with this storyboard infographic? (Reply Yes or No)`;

          return {
            success: true,
            url: downloadUrl,
            viewUrl,
            gcsPath,
            message: aiResponse,
            filename: `${brandName}-storyboard.png`,
            deviceType: '16:9',
            brandName: brandName,
          };
        }
      }
    }

    throw new BadRequestException('No image generated from Gemini model');
  }

  /**
   * Chat with AI
   */
  async chatWithAI(userId: string, projectId: string, userMessage: string) {
    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const conversationHistory = project.aiConversationLog || [];
    const userMsgLower = userMessage.toLowerCase().trim();
    const lastAssistantMsg =
      conversationHistory.length > 0
        ? conversationHistory[conversationHistory.length - 1]?.content || ''
        : '';

    // CHECK 1: User wants to generate storyboard image
    const askingForStoryboardImage =
      lastAssistantMsg.includes('Do you want to generate storyboard image') ||
      lastAssistantMsg.includes('Do you want to generate story board image') ||
      lastAssistantMsg.match(
        /generate.*storyboard.*image.*\(Reply Yes or No\)/i,
      );

    if (userMsgLower === 'yes' && askingForStoryboardImage) {
      const storyboardDescription =
        this.extractStoryboardFromHistory(conversationHistory);

      if (!storyboardDescription) {
        throw new BadRequestException(
          'No storyboard found in conversation history',
        );
      }

      const result = await this.generateStoryboardImageWithGemini(
        userId,
        projectId,
        project.brandName,
        storyboardDescription,
        project.style || 'professional',
      );

      const userYesMessage = {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
      };

      const imageResponseMessage = {
        role: 'assistant' as const,
        content: result.message,
        timestamp: new Date(),
        metadata: {
          imageUrl: result.viewUrl,
          type: 'storyboard_infographic',
        },
      };

      project.aiConversationLog = [
        ...conversationHistory,
        userYesMessage,
        imageResponseMessage,
      ];
      await project.save();

      return {
        success: true,
        message: result.message,
        imageUrl: result.url,
        viewUrl: result.viewUrl,
        gcsPath: result.gcsPath,
        conversationLength: project.aiConversationLog.length,
      };
    }

    // CHECK 2: User is satisfied with storyboard infographic
    const askingAboutInfographicSatisfaction =
      lastAssistantMsg.includes(
        'Are you satisfied with this storyboard infographic?',
      ) ||
      lastAssistantMsg.includes(
        'Are you satisfied with this storyboard image?',
      );

    if (userMsgLower === 'yes' && askingAboutInfographicSatisfaction) {
      const responseWithButton = `Great! Your storyboard is ready.\n\n[GENERATE_CONTENT_BUTTON]\n\nClick the button above to generate the final video or image from this storyboard.`;

      const userSatisfiedMessage = {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
      };

      const buttonResponseMessage = {
        role: 'assistant' as const,
        content: responseWithButton,
        timestamp: new Date(),
        metadata: {
          showGenerateButton: true,
          type: 'button_prompt',
        },
      };

      project.aiConversationLog = [
        ...conversationHistory,
        userSatisfiedMessage,
        buttonResponseMessage,
      ];
      await project.save();

      return {
        success: true,
        message: responseWithButton,
        showGenerateButton: true,
        conversationLength: project.aiConversationLog.length,
      };
    }

    // CHECK 3: User is NOT satisfied - REGENERATE
    if (userMsgLower === 'no' && askingAboutInfographicSatisfaction) {
      const storyboardDescription =
        this.extractStoryboardFromHistory(conversationHistory);

      if (!storyboardDescription) {
        throw new BadRequestException(
          'No storyboard found in conversation history',
        );
      }

      const improvingMessage = {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
      };

      const regeneratingMessage = {
        role: 'assistant' as const,
        content:
          'Let me regenerate an improved version of the storyboard infographic for you... 🎨',
        timestamp: new Date(),
      };

      project.aiConversationLog = [
        ...conversationHistory,
        improvingMessage,
        regeneratingMessage,
      ];
      await project.save();

      const result = await this.generateStoryboardImageWithGemini(
        userId,
        projectId,
        project.brandName,
        storyboardDescription,
        project.style || 'professional',
      );

      const newImageMessage = {
        role: 'assistant' as const,
        content: result.message,
        timestamp: new Date(),
        metadata: {
          imageUrl: result.viewUrl,
          type: 'storyboard_infographic_regenerated',
        },
      };

      project.aiConversationLog = [
        ...project.aiConversationLog,
        newImageMessage,
      ];
      await project.save();

      return {
        success: true,
        message: `Let me regenerate an improved version of the storyboard infographic for you... 🎨\n\n${result.message}`,
        imageUrl: result.url,
        viewUrl: result.viewUrl,
        gcsPath: result.gcsPath,
        conversationLength: project.aiConversationLog.length,
      };
    }

    // CHECK 4: User says NO to "Do you want to generate storyboard image?"
    if (userMsgLower === 'no' && askingForStoryboardImage) {
      const responseWithButton = `No problem! You can generate video or image content directly.\n\n[GENERATE_CONTENT_BUTTON]\n\nClick the button above to create your final video or image from the storyboard.`;

      const userNoMessage = {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
      };

      const buttonResponseMessage = {
        role: 'assistant' as const,
        content: responseWithButton,
        timestamp: new Date(),
        metadata: {
          showGenerateButton: true,
          type: 'generate_content_prompt',
        },
      };

      project.aiConversationLog = [
        ...conversationHistory,
        userNoMessage,
        buttonResponseMessage,
      ];
      await project.save();

      return {
        success: true,
        message: responseWithButton,
        showGenerateButton: true,
        conversationLength: project.aiConversationLog.length,
      };
    }

    if (userMsgLower === '__no_weekly_plan__') {
      const noCalendarMessage =
        `No problem! You can still get great results **without a weekly calendar**.\n\n` +
        `[GENERATE_CONTENT_BUTTON]\n\n`; // 🔥 this line is required;

      const userSpecialMessage = {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
      };

      const assistantMessage = {
        role: 'assistant' as const,
        content: noCalendarMessage,
        timestamp: new Date(),
        metadata: {
          type: 'no_weekly_plan_explanation',
          showGenerateButton: true,
        },
      };

      project.aiConversationLog = [
        ...conversationHistory,
        userSpecialMessage,
        assistantMessage,
      ];
      await project.save();

      return {
        success: true,
        message: noCalendarMessage,
        showGenerateButton: true,
        conversationLength: project.aiConversationLog.length,
      };
    }

    // Regular OpenAI conversation
    const systemPrompt = `You are a marketing expert for "${project.brandName}".

Project Details:
- Brand: ${project.brandName}
- Niche: ${project.niche}
- Style: ${project.style}

${project.weeklyContentCalendar || 'Weekly marketing calendar available.'}

**STRICT CONVERSATION FLOW:**

**Step 1: User picks number (1-16)**
→ Provide DETAILED content description
→ **END WITH ONLY**: "Are you satisfied with this content? (Reply Yes or No)"

**Step 2: User says "No"**
→ Regenerate improved detailed content
→ **END WITH ONLY**: "Are you satisfied with this new content? (Reply Yes or No)"

**Step 3: User says "Yes"**
→ Ask **ONLY**: "Would you like me to create an 8-second storyboard for this? (Reply Yes or No)"

**Step 4: User says "Yes" to storyboard**
→ Create detailed 8-second storyboard
→ **END WITH ONLY**: "Are you satisfied with this storyboard? (Reply Yes or No)"

**Step 5: User says "No" to storyboard**
→ Regenerate improved storyboard
→ **END WITH ONLY**: "Are you satisfied with this storyboard? (Reply Yes or No)"

**Step 6: User says "Yes" to storyboard**
→ Ask **ONLY**: "Do you want to generate storyboard image? (Reply Yes or No)"

**CRITICAL RULES:**
- **NEVER duplicate questions**
- **ONE question per response**
- Use exact format: "(Reply Yes or No)"`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.2,
      max_tokens: 1500,
    });

    let aiResponse = completion.choices[0]?.message?.content?.trim() || '';
    aiResponse = this.removeDuplicateQuestions(aiResponse);

    const hasQuestion = /\?\s*\(Reply Yes or No\)\s*$/i.test(aiResponse.trim());

    if (!hasQuestion) {
      if (userMsgLower.match(/^\d+$/)) {
        aiResponse +=
          '\n\nAre you satisfied with this content? (Reply Yes or No)';
      } else if (userMsgLower === 'no') {
        if (
          lastAssistantMsg.includes(
            'Would you like me to create an 8-second storyboard for this?',
          )
        ) {
          aiResponse +=
            '\n\nNo problem! You can choose another number from the above list to create a different video or image.';
        } else if (lastAssistantMsg.includes('storyboard')) {
          aiResponse +=
            '\n\nAre you satisfied with this storyboard? (Reply Yes or No)';
        } else {
          aiResponse +=
            '\n\nAre you satisfied with this new content? (Reply Yes or No)';
        }
      } else if (userMsgLower === 'yes') {
        if (lastAssistantMsg.includes('satisfied with this content')) {
          aiResponse +=
            '\n\nWould you like me to create an 8-second storyboard for this? (Reply Yes or No)';
        } else if (
          lastAssistantMsg.includes('8-second storyboard') ||
          lastAssistantMsg.includes('satisfied with this storyboard')
        ) {
          aiResponse +=
            '\n\nDo you want to generate storyboard image? (Reply Yes or No)';
        }
      } else {
        aiResponse += '\n\nPlease reply Yes, No, or pick a number (1-16)';
      }
    }

    const newUserMessage = {
      role: 'user' as const,
      content: userMessage,
      timestamp: new Date(),
    };

    const newAIMessage = {
      role: 'assistant' as const,
      content: aiResponse,
      timestamp: new Date(),
    };

    project.aiConversationLog = [
      ...conversationHistory,
      newUserMessage,
      newAIMessage,
    ];
    await project.save();

    return {
      success: true,
      message: aiResponse,
      conversationLength: project.aiConversationLog.length,
    };
  }

  /**
   * Generate content from storyboard
   */
  // Update the options interface to include video-specific fields
  async generateContentFromStoryboard(
    userId: string,
    projectId: string,
    options: {
      storyboard: string;
      contentType: 'video' | 'image';
      useLogo: boolean;
      useSlogan: boolean;
      videoRatio?: string;
      backgroundReference?: string;
      voiceOverText?: string;
      cameraAngle?: string;
    },
  ) {
    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (options.contentType === 'image') {
      this.logger.log(
        `🔍 [DEBUG] Starting image generation for project: ${projectId}`,
      );
      this.logger.log(
        `🔍 [DEBUG] Current conversation length: ${project.aiConversationLog?.length || 0}`,
      );

      // ✅ Generate unique pending ID
      const pendingId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // ✅ STEP 1: Add pending message to conversation
      const pendingImageMessage = {
        role: 'assistant' as const,
        content: `🎨 **Image generation started!**

This will take approximately **30-60 seconds**.
---

**Meanwhile, continue working on other content...**`,
        timestamp: new Date(),
        metadata: {
          type: 'image-pending',
          status: 'pending',
          contentType: 'image',
          pendingId: pendingId,
        },
      };

      // ✅ Initialize aiConversationLog if it doesn't exist
      if (!project.aiConversationLog) {
        project.aiConversationLog = [];
      }

      project.aiConversationLog.push(pendingImageMessage);
      this.logger.log(
        `✅ [DEBUG] Added pending image message. New length: ${project.aiConversationLog.length}`,
      );

      // ✅ STEP 2: Add calendar message (so user can pick another item)
      if (
        project.weeklyContentCalendar &&
        project.weeklyContentCalendar.trim()
      ) {
        this.logger.log(
          `✅ [DEBUG] Calendar exists, adding calendar message...`,
        );

        const calendarMessage = {
          role: 'assistant' as const,
          content: `${project.weeklyContentCalendar}`,
          timestamp: new Date(),
          metadata: {
            type: 'calendar-while-generating',
            showCalendar: true,
          },
        };

        project.aiConversationLog.push(calendarMessage);
        this.logger.log(
          `✅ [DEBUG] Added calendar message. New length: ${project.aiConversationLog.length}`,
        );
      } else {
        this.logger.warn(`⚠️ [DEBUG] No calendar found!`);
      }

      // ✅ STEP 3: Save to database with explicit markModified
      this.logger.log(`💾 [DEBUG] Saving project to database...`);

      // ✅ CRITICAL: Mark the array as modified for Mongoose
      project.markModified('aiConversationLog');

      const savedProject = await project.save();

      this.logger.log(
        `✅ [DEBUG] Project saved! Final conversation length: ${savedProject.aiConversationLog.length}`,
      );

      // ✅ STEP 4: Queue image generation
      const job = await this.imageQueue.add(
        'generate-image',
        {
          userId,
          projectId,
          project: savedProject.toObject(), // ✅ Use saved project
          options,
          pendingId, // ✅ Pass pendingId to processor
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          timeout: 120000,
        },
      );

      this.logger.log(
        `✅ Image queued: Job ${job.id} for project ${projectId}`,
      );
      this.logger.log(`✅ Messages saved to DB, user can now see calendar`);

      return {
        success: true,
        contentType: 'image',
        isPending: true,
        jobId: job.id,
        pendingId: pendingId, // ✅ Return pendingId
        message: 'Image generation started! Check the chat.',
        statusCheckUrl: `/projects/${projectId}/job-status/${job.id}`,
      };
    } else {
      this.logger.log(
        `🔍 [DEBUG] Starting video generation for project: ${projectId}`,
      );
      this.logger.log(
        `🔍 [DEBUG] Current conversation length: ${project.aiConversationLog?.length || 0}`,
      );

      // ✅ Generate unique pending ID
      const pendingId = `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // ✅ STEP 1: Add "generating" message WITH pendingId and status
      const generatingMessage = {
        role: 'assistant' as const,
        content: `🎬 **Video generation started!**\r\n\r\nThis will take approximately **1-2 minutes**.\r\n\r\n${options.useLogo ? '✅ Including brand logo\\n' : ''}${options.useSlogan ? `✅ Including slogan: \"${project.slogan}\"\\n` : ''}\r\nYour video is being generated in the background. **I'll notify you when it's ready!**\r\n\r\n---\r\n\r\n**Meanwhile, continue working on other content...**`,
        timestamp: new Date(),
        metadata: {
          type: 'video-pending',
          status: 'pending', // ✅ ADD THIS
          contentType: 'video',
          pendingId: pendingId, // ✅ ADD THIS
        },
      };

      // ✅ Initialize aiConversationLog if it doesn't exist
      if (!project.aiConversationLog) {
        project.aiConversationLog = [];
      }

      project.aiConversationLog.push(generatingMessage);
      this.logger.log(
        `✅ [DEBUG] Added generating message. New length: ${project.aiConversationLog.length}`,
      );

      // ✅ STEP 2: Add calendar message
      if (
        project.weeklyContentCalendar &&
        project.weeklyContentCalendar.trim()
      ) {
        this.logger.log(
          `✅ [DEBUG] Calendar exists, adding calendar message...`,
        );

        const calendarMessage = {
          role: 'assistant' as const,
          content: `${project.weeklyContentCalendar}`,
          timestamp: new Date(),
          metadata: {
            type: 'calendar-while-generating',
            showCalendar: true,
          },
        };

        project.aiConversationLog.push(calendarMessage);
        this.logger.log(
          `✅ [DEBUG] Added calendar message. New length: ${project.aiConversationLog.length}`,
        );
      } else {
        this.logger.warn(`⚠️ [DEBUG] No calendar found!`);
      }

      // ✅ STEP 3: Save to database with explicit markModified
      this.logger.log(`💾 [DEBUG] Saving project to database...`);

      // ✅ CRITICAL: Mark the array as modified for Mongoose
      project.markModified('aiConversationLog');

      const savedProject = await project.save();

      this.logger.log(
        `✅ [DEBUG] Project saved! Final conversation length: ${savedProject.aiConversationLog.length}`,
      );

      // ✅ Verify it was actually saved
      const verifyProject = await this.projectModel
        .findById(projectId)
        .select('aiConversationLog');

      // ✅ STEP 4: Queue video generation
      const job = await this.videoQueue.add(
        'generate-video',
        {
          userId,
          projectId,
          project: savedProject.toObject(), // ✅ Use saved project
          options,
          pendingId,
        },
        {
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 },
          timeout: 300000,
        },
      );

      this.logger.log(`✅ Video queued: Job ${job.id}`);
      this.logger.log(`✅ Messages saved to DB, user can now see calendar`);

      return {
        success: true,
        contentType: 'video',
        isPending: true,
        jobId: job.id,
        pendingId: pendingId, // ✅ ADD THIS
        message: 'Video generation started! Check the chat.',
        statusCheckUrl: `projects/${projectId}/job-status/${job.id}`,
      };
    }
  }

  /**
   * Optimize prompt for generation
   */
  async optimizePromptForGeneration(
    userId: string,
    projectId: string,
    originalPrompt: string,
    contentType?: 'video' | 'image',
  ): Promise<{ success: boolean; optimizedPrompt: string }> {
    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a prompt optimization expert. Your job is to convert storyboards into SHORT, CLEAR prompts optimized for ${
            contentType === 'video'
              ? 'Veo3 video generation (max 150 words)'
              : 'Imagen 4 ultra image generation (max 100 words)'
          }.

For VIDEO prompts, follow these CRITICAL RULES:
- Focus ONLY on visual descriptions (scenes, actions, lighting, camera movement, composition)
- DO NOT include any on-screen text instructions (no "text overlay", captions, quotes, hashtags, or written slogans)
- If the storyboard mentions text, convert it into visual storytelling or mood, not text on screen

For IMAGE prompts:
- You may describe minimal text if absolutely required, but keep it simple and short.

General guidelines:
- Emphasize brand style and identity through visuals, environments, and character styling
- Use clear, concise language
- No meta explanations or commentary

Return ONLY the optimized prompt, nothing else.`,
        },
        {
          role: 'user',
          content: originalPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const optimizedPrompt = completion.choices[0]?.message?.content?.trim();

    if (!optimizedPrompt) {
      throw new BadRequestException('Failed to generate optimized prompt');
    }

    return {
      success: true,
      optimizedPrompt,
    };
  }

  /**
   * Get project gallery
   */
  async getProjectGallery(userId: string, projectId: string) {
    const gallery = await this.projectGalleryModel
      .findOne({
        userId: new Types.ObjectId(userId),
        projectId: new Types.ObjectId(projectId),
      })
      .lean();

    if (!gallery) {
      return {
        storyboards: [],
        images: [],
        videos: [],
      };
    }

    return {
      storyboards: gallery.storyboardUrls || [],
      images: gallery.imageUrls || [],
      videos: gallery.videoUrls || [],
    };
  }

  // ==================== FILE ACCESS ====================

  /**
   * Check user file access
   */
  async checkUserFileAccess(
    userId: string,
    filename: string,
  ): Promise<boolean> {
    // Check project files
    const projects = await this.projectModel.find({
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    });

    for (const project of projects) {
      if (project.logoGcsPath === filename) return true;
      if (project.logoUrl?.includes(filename)) return true;

      if (project.mediaFiles && Array.isArray(project.mediaFiles)) {
        const hasFile = project.mediaFiles.some((file: any) => {
          return (
            file.gcsPath === filename ||
            file.downloadUrl?.includes(filename) ||
            file.filename === filename
          );
        });
        if (hasFile) return true;
      }
    }

    // Check gallery files
    const galleryEntries = await this.galleryModel.find({
      userId: new Types.ObjectId(userId),
    });

    for (const gallery of galleryEntries) {
      const imageMatch = gallery.imageUrls.some(
        (item: any) =>
          item.url?.includes(filename) || item.filename === filename,
      );
      if (imageMatch) return true;

      const videoMatch = gallery.videoUrls.some(
        (item: any) =>
          item.url?.includes(filename) || item.filename === filename,
      );
      if (videoMatch) return true;
    }

    return false;
  }

  /**
   * Get file stream from GCS
   */
  async getFileStream(filename: string): Promise<any> {
    const bucketName = process.env.GCP_BUCKET_NAME!;
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(filename);

    const [exists] = await file.exists();
    if (!exists) {
      throw new NotFoundException(`File ${filename} not found`);
    }

    return file.createReadStream();
  }

  /**
   * Get job status - NEW METHOD FOR QUEUE
   */
  async checkJobStatus(userId: string, projectId: string, jobId: string) {
    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' }, // ✅ Fix #1
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    let job = await this.videoQueue.getJob(jobId);
    let queueType: 'video' | 'image' = 'video';

    if (!job) {
      job = await this.imageQueue.getJob(jobId);
      queueType = 'image';
    }

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress() || 0; // ✅ Fix #2

    this.logger.log(
      `📊 Job ${jobId} status: ${state} (progress: ${progress}%)`,
    );

    if (state === 'completed') {
      const result = job.returnvalue;

      // ✅ Fix #3: Type-specific return
      return {
        success: true,
        isPending: false,
        status: 'completed',
        contentType: queueType,
        progress: 100,
        ...(queueType === 'video'
          ? {
              videoUrl: result.downloadUrl,
              viewUrl: result.viewUrl,
              gcsPath: result.gcsPath,
              message: 'Video is ready!',
            }
          : {
              imageUrl: result.downloadUrl,
              viewUrl: result.viewUrl,
              gcsPath: result.gcsPath,
              message: 'Image is ready!',
            }),
      };
    }

    if (state === 'failed') {
      return {
        success: false,
        isPending: false,
        status: 'failed',
        contentType: queueType,
        error: job.failedReason || 'Unknown error',
        message: `${queueType} generation failed: ${job.failedReason || 'Unknown error'}`,
      };
    }

    return {
      success: true,
      isPending: true,
      status: state,
      progress,
      contentType: queueType,
      message: `Processing ${queueType}...${progress > 0 ? ` ${progress}% complete` : ''}`,
    };
  }
}
