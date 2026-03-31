import {
  Controller,
  Post,
  Body,
  UploadedFiles,
  UseInterceptors,
  Get,
  Query,
  Res,
  Options,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  BadRequestException,
  UsePipes,
  ValidationPipe,
  InternalServerErrorException,
  HttpCode
} from "@nestjs/common";
import { memoryStorage } from "multer";
import { VideoService, DomainInfo, ScriptVoPair } from "./video.service";
import { 
  CreateVideoDto,
  GenerateImageDto,
  GenerateVideoDto,
  GenerateContentDto,
  FetchDomainInfoDto,
  PollStatusDto,
  GenerateAIPromptDto
} from "./dto/video.dto";
import { Express, Response } from "express";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { 
  ApiBody, 
  ApiConsumes, 
  ApiQuery, 
  ApiResponse, 
  ApiTags,
  ApiOperation 
} from "@nestjs/swagger";
import { Readable } from "stream";
import { Throttle } from '@nestjs/throttler';
const CONFIG = {
  FILES: {
    MAX_SIZE: 50 * 1024 * 1024,
    MAX_COUNT: 10,
    MAX_REF_IMAGES: 5,
    MAX_REF_IMAGES_FREESTYLE: 3,
    FIELD_SIZE: 2 * 1024 * 1024
  },
  TIMEOUTS: {
    REQUEST: 30000
  },
  MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ] as const,
  FILE_PATHS: ['', 'generated-images/', 'generated-videos/', 'uploads/']
} as const;

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  json: 'application/json'
};

const UPLOAD_CONFIG = {
  storage: memoryStorage(),
  limits: {
    fileSize: CONFIG.FILES.MAX_SIZE,
    files: CONFIG.FILES.MAX_COUNT,
    fieldSize: CONFIG.FILES.FIELD_SIZE,
  },
  fileFilter: (req: any, file: Express.Multer.File, callback: any) => {
    if (CONFIG.MIME_TYPES.includes(file.mimetype as any)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          `File type '${file.mimetype}' not allowed`
        ), 
        false
      );
    }
  }
};

@ApiTags('Video & Image Generation')
@Controller("video")
@UsePipes(new ValidationPipe({ 
  whitelist: true, 
  forbidNonWhitelisted: true,
  transform: true,
  disableErrorMessages: process.env.NODE_ENV === 'production'
}))
export class VideoController {
  private readonly logger = new Logger(VideoController.name);
  private readonly isProduction: boolean;

  constructor(private readonly videoService: VideoService) {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.validateEnvironment();
  }

  private validateEnvironment(): void {
    const required = ['GCP_BUCKET_NAME', 'GCP_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    if (!filename?.trim()) {
      throw new BadRequestException('Invalid filename');
    }

    const sanitized = filename
      .trim()
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      .replace(/^\.+/, '')
      .replace(/\/\//g, '/')
      .replace(/\\/g, '/')
      .substring(0, 255);

    if (!sanitized) {
      throw new BadRequestException('Filename invalid after sanitization');
    }

    return sanitized;
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? (MIME_MAP[ext] || 'application/octet-stream') : 'application/octet-stream';
  }

  private validateRequiredFields(fields: Record<string, any>, fieldNames: string[]): void {
    const missing = fieldNames.filter(name => {
      const value = fields[name];
      return value === undefined || value === null || 
        (typeof value === 'string' && !value.trim());
    });

    if (missing.length > 0) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Required fields missing',
        missingFields: missing,
        timestamp: new Date().toISOString()
      });
    }
  }

  private validateUrl(url: string, fieldName: string = 'URL'): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}: ${url}`);
    }
  }

  private validateUrlArray(urls: string[] | undefined, maxLength: number, fieldName: string = 'URLs'): void {
    if (!urls?.length) return;

    if (urls.length > maxLength) {
      throw new BadRequestException(
        `Maximum ${maxLength} ${fieldName} allowed, received ${urls.length}`
      );
    }

    urls.forEach((url, index) => {
      if (typeof url !== 'string') {
        throw new BadRequestException(`Invalid ${fieldName} at index ${index}`);
      }
      this.validateUrl(url, `${fieldName}[${index}]`);
    });
  }

  private handleError(error: any, operation: string, context?: Record<string, any>): never {
    this.logger.error(`${operation} failed: ${error.message}`, { stack: error.stack, ...context });

    if (error instanceof HttpException) {
      throw error;
    }

    throw new InternalServerErrorException({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: `${operation} failed`,
      error: this.isProduction ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }

  private buildSuccess(data: Record<string, any>): Record<string, any> {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...data
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return this.buildSuccess({
      status: 'healthy',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    });
  }

  @Post("generate-image")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate AI image' })
  @ApiResponse({ status: 202, description: 'Image queued' })
  async generateImage(@Body() body: {
    userId: string;
    storyboard: string;
    useLogo?: boolean;
    useSlogan?: boolean;
    logoUrl?: string;
    slogan?: string;
    style?:string;
    brandName?: string;
    referenceImage?: string[];
    source?: string;
  }) {
    const startTime = Date.now();
    
    try {
      const { userId, storyboard, useLogo, useSlogan, logoUrl, slogan, style, brandName, referenceImage, source } = body;

      this.validateRequiredFields({ userId, storyboard }, ['userId', 'storyboard']);
      this.validateUrlArray(referenceImage, CONFIG.FILES.MAX_REF_IMAGES, 'reference images');
      
      if (logoUrl && useLogo) {
        this.validateUrl(logoUrl, 'logoUrl');
      }

      this.logger.log(`🖼️ IMAGE - User: ${userId}, Source: ${source || 'N/A'}`);
      
      const imagePayload = {
        userId: userId.trim(),
        storyboard: storyboard.trim(),
        brandName: brandName?.trim() || '',
        slogan: useSlogan && slogan ? slogan.trim() : '',
        logoUrl: useLogo && logoUrl ? logoUrl.trim() : '',
        useLogo: Boolean(useLogo),
        useSlogan: Boolean(useSlogan),
        campaignMessage:style || '',
        imageUrls: referenceImage || [],
        source: source?.trim() || 'Product',
      };
      this.logger.log('imagepayload send to image generation',imagePayload);
      const result = await this.videoService.queueImageGeneration(userId, imagePayload);

      const duration = Date.now() - startTime;
      this.logger.log(`✅ IMAGE queued - ${duration}ms - Job: ${result.jobId}`);

      return this.buildSuccess({
        isPending: true,
        jobId: result.jobId,
        message: 'Image generation started',
        statusCheckUrl: `/video/job-status/${result.jobId}`,
        estimatedTime: '30-60 seconds',
        remaining: result.remaining,
        source: imagePayload.source,
        processingTime: `${duration}ms`
      });

    } catch (error) {
      this.handleError(error, 'Image generation', { userId: body.userId });
    }
  }

 @Post("create-from-prompt")
@HttpCode(HttpStatus.ACCEPTED)
async createVideoFromPrompt(@Body() body: {
  userId: string;
  storyboard: string;
  useLogo?: boolean;
  useSlogan?: boolean;
  videoRatio?: string;
  videoDuration?: '8s' | '15s' | '30s';
  voiceOverText?: string;
  style?: string;
  brandName?: string;
  slogan?: string;
  logoUrl?: string;
  language?: string;
  referenceImage?: string[];
  source?: string;
  voiceGender?: string;
  burnSubtitles?: boolean;
}) {
  const startTime = Date.now();

  try {
    const {
      userId, storyboard, useLogo, useSlogan, videoRatio,
      videoDuration, voiceOverText,
      style, brandName, slogan, logoUrl, language,
      referenceImage, source,
      voiceGender,    // ✅ destructured
      burnSubtitles,  // ✅ destructured
    } = body;

    this.validateRequiredFields({ userId, storyboard }, ['userId', 'storyboard']);
    this.validateUrlArray(referenceImage, CONFIG.FILES.MAX_REF_IMAGES, 'reference images');

    if (logoUrl && useLogo) {
      this.validateUrl(logoUrl, 'logoUrl');
    }

    // ── Step 1: Enrich storyboard ──────────────────────────────────────
    let enrichedStoryboard = storyboard.trim();
    if (style?.trim()) {
      enrichedStoryboard += `\n\nStyle/Mood: ${style.trim()}`;
    }
    // ✅ REMOVED: backgroundReference, cameraAngle enrichment

    // ── Step 2: Build fallback pair ────────────────────────────────────
    // ✅ CHANGED: narratorGender now uses voiceGender from frontend
    const fallbackPair: ScriptVoPair = {
      script:         enrichedStoryboard,
      voiceOver:      voiceOverText?.trim() || '',
      narrator:       '',
      narratorGender: voiceGender?.trim() || 'female',  // ✅ real voice
      subtitleStart:  1.0,
      subtitleEnd:    7.5,
      isExtension:    false,
      isLast:         true,
    };

    // ── Step 3: Generate script pairs ──────────────────────────────────
let scriptPairs: ScriptVoPair[] = [];
const finalDuration = (videoDuration?.trim() || '8s') as '8s' | '15s' | '30s';

// if (finalDuration === '15s' || finalDuration === '30s') {
//   try {
//     scriptPairs = await this.videoService.generateVideoScripts(
//   enrichedStoryboard,
//   finalDuration,
//   voiceOverText?.trim() || '',
//   voiceGender?.trim() || 'female',  // ✅ narratorOverride
//   'voiceover',                       // ✅ audioType — tells it to fill voiceOver field
// );

//     // ✅ FIXED: Don't overwrite voiceOver — generateVideoScripts already split it correctly
//     scriptPairs = scriptPairs.map((p) => ({
//       ...p,
//       narratorGender: voiceGender?.trim() || 'female',
//     }));

//     this.logger.log(`✅ Scripts generated: ${scriptPairs.length} for ${finalDuration}`);
//     this.logger.log(`✅ Pair voiceovers: ${JSON.stringify(scriptPairs.map(p => ({ vo: p.voiceOver?.substring(0,30), nar: p.narrator?.substring(0,30) })))}`);

//   } catch (err: any) {
//   scriptPairs = [fallbackPair];
//   this.logger.warn(`⚠️ Script generation failed: ${err.message} — using fallback`);
// }
// } else {
//   scriptPairs = [fallbackPair];
//   this.logger.log(`✅ 8s video — using storyboard directly`);
// }


//     this.logger.log(`🎬 VIDEO - User: ${userId}, Duration: ${finalDuration}, Scripts: ${scriptPairs.length}, Voice: ${voiceGender || 'female'}`);

    // ── Step 4: Build payload ──────────────────────────────────────────
    try {
  // ✅ ALL durations now use generateVideoScripts — including 8s
  scriptPairs = await this.videoService.generateVideoScripts(
    enrichedStoryboard,
    finalDuration,                    // '8s', '15s', '30s' all handled
    voiceOverText?.trim() || '',
    voiceGender?.trim() || 'female',  // narratorOverride
    'voiceover',                      // audioType
  );

  scriptPairs = scriptPairs.map((p) => ({
    ...p,
    narratorGender: voiceGender?.trim() || 'female',
  }));

  this.logger.log(`✅ Scripts generated: ${scriptPairs.length} for ${finalDuration}`);
  this.logger.log(`✅ Pair voiceovers: ${JSON.stringify(
    scriptPairs.map(p => ({ vo: p.voiceOver?.substring(0, 30), nar: p.narrator?.substring(0, 30) }))
  )}`);

} catch (err: any) {
  // ✅ Fallback splits correctly for each duration
  const segCount = finalDuration === '30s' ? 4 : finalDuration === '15s' ? 2 : 1;
  const words = (voiceOverText?.trim() || '').split(/\s+/).filter(Boolean);
  const chunkSize = Math.ceil(words.length / segCount);

  scriptPairs = Array.from({ length: segCount }, (_, i) => ({
    ...fallbackPair,
    voiceOver:   words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ') || fallbackPair.voiceOver,
    isExtension: i > 0,
    isLast:      i === segCount - 1,
  }));

  this.logger.warn(`⚠️ Script generation failed: ${err.message} — using ${segCount} fallback pairs`);
}

    const hasVoiceOver = Boolean(voiceOverText?.trim());

    const videoPayload = {
      userId:        userId.trim(),
      storyboard:    enrichedStoryboard,
      scripts:       scriptPairs.map(p => p.script),
      scriptPairs,
      brandName:     brandName?.trim() || '',
      slogan:        hasVoiceOver
                       ? voiceOverText!.trim()
                       : (useSlogan && slogan ? slogan.trim() : ''),
      logoUrl:       useLogo && logoUrl ? logoUrl.trim() : '',
      language:      language?.trim() || 'English',
      videoRatio:    videoRatio?.trim() || '16:9',
      videoDuration: finalDuration,
      voiceOverText: voiceOverText?.trim() || '',
      voiceGender:   voiceGender?.trim() || 'female',    // ✅ ADDED
      style:         style?.trim() || '',
      useLogo:       Boolean(useLogo),
      useSlogan:     hasVoiceOver ? true : Boolean(useSlogan),
      burnSubtitles: Boolean(burnSubtitles),              // ✅ CHANGED: from frontend toggle
      referenceImage: referenceImage || [],
      source:        source?.trim() || 'Product',
      // ✅ REMOVED: backgroundReference, cameraAngle
    };

    const result = await this.videoService.queueVideoGeneration(userId, videoPayload);

    const duration = Date.now() - startTime;
    this.logger.log(`✅ VIDEO queued - ${duration}ms - Job: ${result.jobId}`);

    return this.buildSuccess({
      isPending: true,
      jobId: result.jobId,
      message: 'Video generation started',
      statusCheckUrl: `/video/job-status/${result.jobId}`,
      estimatedTime: finalDuration === '30s' ? '8-10 minutes'
                   : finalDuration === '15s' ? '4-5 minutes'
                   : '2-3 minutes',
      remaining:  result.remaining,
      source:     videoPayload.source,
      details: {
        scriptsGenerated:    scriptPairs.length,
        videoDuration:       finalDuration,
        hasVoiceOver:        hasVoiceOver,
        voiceGender:         voiceGender || 'female',   // ✅ ADDED for debugging
        burnSubtitles:       Boolean(burnSubtitles),    // ✅ ADDED for debugging
        hasLogo:             Boolean(useLogo && logoUrl),
        referenceImageCount: referenceImage?.length || 0,
      },
      processingTime: `${duration}ms`,
    });

  } catch (error) {
    this.handleError(error, 'Video generation', { userId: body.userId });
  }
}



// @Post('generate')
// @HttpCode(HttpStatus.ACCEPTED)
// @ApiOperation({ summary: 'Unified content generation (freestyle)' })
// @ApiResponse({ status: 202, description: 'Content queued' })
// async generateContent(@Body() body: {
//   userId: string;
//   contentName?: string;
//   prompt: string;
//   aspectRatio: string;
//   contentType: 'image' | 'video';
//   audioType?: 'none' | 'voiceover' | 'narrator';
//   voiceOver?: string;
//   narrator?: string;
//   voiceGender?: string; // 'female' | 'male' | 'oldlady' | 'oldman'
//   hasSubtitle?: boolean;
//   videoDuration?: '8s' | '15s' | '30s';
//   referenceImage?: string[];
//   logo?: string;
//   source?: string;
// }) {
//   const startTime = Date.now();

//   try {
//     const {
//       userId, contentName, prompt, aspectRatio,
//       contentType, audioType, voiceOver, narrator,
//       voiceGender, hasSubtitle,
//       videoDuration, referenceImage, logo, source,
//     } = body;

//     // ✅ Unified voice text — voiceover or narrator, whichever is provided
//     const voiceText = voiceOver?.trim() || narrator?.trim() || '';
//     const hasVoiceText = Boolean(voiceText) && audioType !== 'none';

//     this.validateRequiredFields(
//       { userId, prompt, contentType },
//       ['userId', 'prompt', 'contentType'],
//     );

//     if (!['image', 'video'].includes(contentType)) {
//       throw new BadRequestException({
//         message: 'Invalid content type',
//         acceptedValues: ['image', 'video'],
//         receivedValue: contentType,
//       });
//     }

//     this.validateUrlArray(referenceImage, CONFIG.FILES.MAX_REF_IMAGES_FREESTYLE, 'reference images');

//     if (logo) {
//       this.validateUrl(logo, 'logo');
//     }

//     const useLogo = Boolean(logo);

//     this.logger.log(`🎨 ${contentType.toUpperCase()} freestyle - User: ${userId}`);
    
//     if (contentType === 'image') {
//       const payload = {
//         userId: userId.trim(),
//         storyboard: prompt.trim(),
//         brandName: contentName?.trim()
//           ? `${contentName.trim()}-freestyle`
//           : 'image-generated',
//         useLogo,
//         logoUrl: logo?.trim() || '',
//         useSlogan: false,
//         deviceType: aspectRatio?.trim() || '16:9',
//         language: 'English',
//         imageUrls: referenceImage || [],
//         source: source?.trim() || 'freestyle',
//         slogan: '',
//       };

//       const result = await this.videoService.queueImageGeneration(userId, payload);
//       const duration = Date.now() - startTime;

//       this.logger.log(`✅ IMAGE freestyle queued - ${duration}ms - Job: ${result.jobId}`);

//       return this.buildSuccess({
//         isPending: true,
//         jobId: result.jobId,
//         contentType: 'image',
//         message: 'Image generation started',
//         statusCheckUrl: `/video/job-status/${result.jobId}`,
//         estimatedTime: '30-60 seconds',
//         remaining: result.remaining,
//         details: {
//           prompt: prompt.substring(0, 100),
//           aspectRatio,
//           referenceImageCount: referenceImage?.length || 0,
//           hasLogo: useLogo,
//           source: payload.source,
//         },
//         processingTime: `${duration}ms`,
//       });
//     }

//     // ─── VIDEO ───────────────────────────────────────────────────────────────

//     // ✅ Map frontend voiceGender to full narrator character description
//     const narratorVoiceMap: Record<string, string> = {

//   female:
//     'Sarah, young adult female narrator, warm friendly tone, clear American accent, medium-high consistent pitch, smooth pacing, close-mic studio recording, professional advertisement voice',

//   male:
//     'James, adult male narrator, deep warm confident tone, natural American accent, low consistent pitch, steady pacing, close-mic studio recording, professional commercial voice',

//   old_lady:
//     'Eleanor, elderly female storyteller narrator, warm wise tone, gentle American accent, slightly higher pitch with soft tremble, slow thoughtful pacing, close-mic storytelling style',

//   old_man:
//     'George, elderly male narrator, rich gravelly authoritative tone, classic American accent, low pitch, slow deliberate pacing, close-mic documentary narration style',

//   teen_girl:
//     'Mia, teenage girl narrator, energetic playful tone, bright American accent, higher pitch, fast lively pacing, close-mic casual social media style voice',

//   teen_boy:
//     'Jake, teenage boy narrator, relaxed playful tone, youthful American accent, medium pitch, casual conversational pacing, close-mic vlog style voice',

//   professional:
//     'Alex, professional news anchor narrator, neutral polished tone, standard American broadcast accent, medium consistent pitch, precise pacing, studio broadcast recording style',

//   whispering:
//     'soft whisper narrator voice, intimate ASMR tone, neutral American accent, very low volume, slow gentle pacing with breath detail, ultra close-mic recording style'
// };
//     const resolvedNarrator = narratorVoiceMap[voiceGender ?? 'female'] ?? narratorVoiceMap['female'];

//     // ✅ subtitle only burns when voiceText exists + user toggled hasSubtitle
//     const burnSubtitles = hasVoiceText && Boolean(hasSubtitle);

//     let scriptPairs: ScriptVoPair[];

//     try {
//       // ✅ Always use manual flow — user prompt + split voiceover, no GPT script generation
//       // scriptPairs = this.videoService.buildManualScriptPairs(
//       //   prompt.trim(),
//       //   voiceText,
//       //   resolvedNarrator,
//       //   videoDuration ?? '8s',
//       // );
//       scriptPairs = await this.videoService.generateVideoScripts(
//   prompt.trim(),
//   videoDuration ?? '8s',
//   voiceText || undefined,  
//   resolvedNarrator,        
//   audioType as 'voiceover' | 'narrator'
// );
//       this.logger.log(`✅ Script pairs built: ${scriptPairs.length} segment(s) for ${videoDuration ?? '8s'}`);
//     } catch (scriptError: any) {
//       this.logger.error(`Script build failed: ${scriptError.message}`);
//       // Fallback — single segment with full voiceText
//       scriptPairs = [{
//   script:         prompt.trim(),
//   voiceOver:      voiceOver || '',
//   narrator:       '',
//   narratorGender: resolvedNarrator,
//   subtitleStart:  1.0,
//   subtitleEnd:    6.5,
//   isExtension:    false,
//   isLast:         true,
// }];

//     }

//     this.logger.log(`📋 Script pairs: ${JSON.stringify(scriptPairs)}`);
// return {
//   debug: true,
//   scriptPairs,
//   resolvedNarrator,
//   burnSubtitles,
//   voiceText,
//   videoDuration: videoDuration ?? '8s',
//   segmentCount: scriptPairs.length,
// };

//     // const payload = {
//     //   userId: userId.trim(),
//     //   scripts: scriptPairs.map((p) => p.script),
//     //   scriptPairs,
//     //   storyboard: prompt.trim(),
//     //   videoRatio: aspectRatio?.trim() || '16:9',
//     //   brandName: contentName?.trim()
//     //     ? `${contentName.trim()}-freestyle`
//     //     : 'video-generated',
//     //   useLogo,
//     //   logoUrl: logo?.trim() || '',
//     //   useSlogan: false,
//     //   slogan: '',
//     //   burnSubtitles,
//     //   voiceOverText: voiceText,         // ✅ full original voice text for reference
//     //   language: 'English',
//     //   videoDuration: videoDuration?.trim() || '8s',
//     //   referenceImage: referenceImage || [],
//     //   source: source?.trim() || 'freestyle',
//     //   backgroundReference: '',
//     //   cameraAngle: '',
//     // };

//     // const result = await this.videoService.queueVideoGeneration(userId, payload);
//     // const duration = Date.now() - startTime;

//     // this.logger.log(`✅ VIDEO freestyle queued - ${duration}ms - Job: ${result.jobId}`);

//     // const estimatedTime =
//     //   videoDuration === '30s' ? '8-10 minutes'
//     //   : videoDuration === '15s' ? '4-5 minutes'
//     //   : '2-3 minutes';

//     // return this.buildSuccess({
//     //   isPending: true,
//     //   jobId: result.jobId,
//     //   contentType: 'video',
//     //   message: 'Video generation started',
//     //   statusCheckUrl: `/video/job-status/${result.jobId}`,
//     //   estimatedTime,
//     //   remaining: result.remaining,
//     //   details: {
//     //     prompt: prompt.substring(0, 100),
//     //     aspectRatio,
//     //     scriptsGenerated: scriptPairs.length,
//     //     audioType: audioType ?? 'none',
//     //     hasVoiceOver: hasVoiceText,
//     //     voiceGender: voiceGender ?? 'female',
//     //     narratorCharacter: resolvedNarrator.split(',')[0], // e.g. "Sarah"
//     //     hasSubtitle: burnSubtitles,
//     //     videoDuration: videoDuration || '8s',
//     //     referenceImageCount: referenceImage?.length || 0,
//     //     hasLogo: useLogo,
//     //     source: payload.source,
//     //   },
//     //   processingTime: `${duration}ms`,
//     // });

//   } catch (error) {
//     this.handleError(error, `${body.contentType} freestyle`, {
//       userId: body.userId,
//       contentType: body.contentType,
//     });
//   }
// }

@Post('generate')
@HttpCode(HttpStatus.ACCEPTED)
@ApiOperation({ summary: 'Unified content generation (freestyle)' })
@ApiResponse({ status: 202, description: 'Content queued' })
async generateContent(@Body() body: {
  userId: string;
  contentName?: string;
  prompt: string;
  aspectRatio: string;
  contentType: 'image' | 'video';
  audioType?: 'none' | 'voiceover' | 'narrator';
  voiceOver?: string;
  narrator?: string;
  voiceGender?: string;
  hasSubtitle?: boolean;
  videoDuration?: '8s' | '15s' | '30s';
  referenceImage?: string[];
  logo?: string;
  source?: string;
}) {
  const startTime = Date.now();

  try {
    const {
      userId, contentName, prompt, aspectRatio,
      contentType, audioType, voiceOver, narrator,
      voiceGender, hasSubtitle,
      videoDuration, referenceImage, logo, source,
    } = body;

    // ─── FIX #2: For narrator mode, narrator script IS the scene prompt ──────
    // User leaves prompt empty and fills narrator field instead
    const effectivePrompt = (audioType === 'narrator' && !prompt?.trim())
      ? (narrator?.trim() ?? '')
      : (prompt?.trim() ?? '');

    // ─── FIX #1: Validate using effectivePrompt, not raw prompt ─────────────
    this.validateRequiredFields(
      { userId, prompt: effectivePrompt, contentType },
      ['userId', 'prompt', 'contentType'],
    );

    if (!['image', 'video'].includes(contentType)) {
      throw new BadRequestException({
        message: 'Invalid content type',
        acceptedValues: ['image', 'video'],
        receivedValue: contentType,
      });
    }

    this.validateUrlArray(referenceImage, CONFIG.FILES.MAX_REF_IMAGES_FREESTYLE, 'reference images');

    if (logo) {
      this.validateUrl(logo, 'logo');
    }

    const useLogo = Boolean(logo);

    this.logger.log(`🎨 ${contentType.toUpperCase()} freestyle - User: ${userId}`);
     this.logger.log(` body payload - ${JSON.stringify(body)}`);

    // ── IMAGE ────────────────────────────────────────────────────────────────
    if (contentType === 'image') {
      const payload = {
        userId: userId.trim(),
        storyboard: effectivePrompt,
        brandName: contentName?.trim()
          ? `${contentName.trim()}-freestyle`
          : 'image-generated',
        useLogo,
        logoUrl: logo?.trim() || '',
        useSlogan: false,
        deviceType: aspectRatio?.trim() || '16:9',
        language: 'English',
        imageUrls: referenceImage || [],
        source: source?.trim() || 'freestyle',
        slogan: '',
      };

      const result = await this.videoService.queueImageGeneration(userId, payload);
      const duration = Date.now() - startTime;

      this.logger.log(`✅ IMAGE freestyle queued - ${duration}ms - Job: ${result.jobId}`);

      return this.buildSuccess({
        isPending: true,
        jobId: result.jobId,
        contentType: 'image',
        message: 'Image generation started',
        statusCheckUrl: `/video/job-status/${result.jobId}`,
        estimatedTime: '30-60 seconds',
        remaining: result.remaining,
        details: {
          prompt: effectivePrompt.substring(0, 100),
          aspectRatio,
          referenceImageCount: referenceImage?.length || 0,
          hasLogo: useLogo,
          source: payload.source,
        },
        processingTime: `${duration}ms`,
      });
    }

    // ── VIDEO ────────────────────────────────────────────────────────────────

    // Voice map
    const narratorVoiceMap: Record<string, string> = {
      female:       'Sarah, young adult female narrator, warm friendly tone, clear American accent, medium-high consistent pitch, smooth pacing, close-mic studio recording, professional advertisement voice',
      male:         'James, adult male narrator, deep warm confident tone, natural American accent, low consistent pitch, steady pacing, close-mic studio recording, professional commercial voice',
      old_lady:     'Eleanor, elderly female storyteller narrator, warm wise tone, gentle American accent, slightly higher pitch with soft tremble, slow thoughtful pacing, close-mic storytelling style',
      old_man:      'George, elderly male narrator, rich gravelly authoritative tone, classic American accent, low pitch, slow deliberate pacing, close-mic documentary narration style',
      teen_girl:    'Mia, teenage girl narrator, energetic playful tone, bright American accent, higher pitch, fast lively pacing, close-mic casual social media style voice',
      teen_boy:     'Jake, teenage boy narrator, relaxed playful tone, youthful American accent, medium pitch, casual conversational pacing, close-mic vlog style voice',
      professional: 'Alex, professional news anchor narrator, neutral polished tone, standard American broadcast accent, medium consistent pitch, precise pacing, studio broadcast recording style',
      whispering:   'soft whisper narrator voice, intimate ASMR tone, neutral American accent, very low volume, slow gentle pacing with breath detail, ultra close-mic recording style',
    };
    const resolvedNarrator = audioType === 'narrator'
  ? narratorVoiceMap['professional']  // Alex — neutral, polished, no gender bias
  : narratorVoiceMap[voiceGender ?? 'female'] ?? narratorVoiceMap['female'];

    const voiceText =
      audioType === 'voiceover' ? (voiceOver?.trim() ?? '') :
      audioType === 'narrator'  ? (narrator?.trim()  ?? '') :
      '';

    const hasVoiceText  = Boolean(voiceText) && audioType !== 'none';
    const burnSubtitles = hasVoiceText && Boolean(hasSubtitle);

    // ─── FIX #4: Only pass valid audioType to generateVideoScripts ───────────
    const resolvedAudioType = (audioType === 'voiceover' || audioType === 'narrator')
      ? audioType
      : undefined;

    let scriptPairs: ScriptVoPair[];

    try {
      scriptPairs = await this.videoService.generateVideoScripts(
        effectivePrompt,                  
        videoDuration ?? '8s',
        voiceText || undefined,           
        resolvedNarrator,
        resolvedAudioType,                
      );

      this.logger.log(`✅ Script pairs built: ${scriptPairs.length} segment(s) for ${videoDuration ?? '8s'}`);

    } catch (scriptError: any) {
      this.logger.error(`Script build failed: ${scriptError.message}`);
      scriptPairs = [{
        script:         effectivePrompt,
        voiceOver:      audioType === 'voiceover' ? voiceText : '',
        narrator:       audioType === 'narrator'  ? voiceText : '',
        narratorGender: resolvedNarrator,
        subtitleStart:  1.0,
        subtitleEnd:    6.5,
        isExtension:    false,
        isLast:         true,
      }];
    }

    this.logger.log(`📋 Script pairs: ${JSON.stringify(scriptPairs)}`);

    const payload = {
      userId: userId.trim(),
      scripts: scriptPairs.map((p) => p.script),
      scriptPairs,
      storyboard: effectivePrompt,
      videoRatio: aspectRatio?.trim() || '16:9',
      brandName: contentName?.trim()
        ? `${contentName.trim()}-freestyle`
        : 'video-generated',
      useLogo,
      logoUrl: logo?.trim() || '',
      useSlogan: false,
      slogan: '',
      burnSubtitles,
      voiceOverText: voiceText,
      language: 'English',
      videoDuration: videoDuration?.trim() || '8s',
      referenceImage: referenceImage || [],
      source: source?.trim() || 'freestyle',
      backgroundReference: '',
      cameraAngle: '',
    };

    const result = await this.videoService.queueVideoGeneration(userId, payload);
    const duration = Date.now() - startTime;

    this.logger.log(`✅ VIDEO freestyle queued - ${duration}ms - Job: ${result.jobId}`);

//     return {
//   debug: true,
//   scriptPairs,
//   resolvedNarrator,
//   burnSubtitles,
//   voiceText,
//   videoDuration: videoDuration ?? '8s',
//   segmentCount: scriptPairs.length,
// };

    const estimatedTime =
      videoDuration === '30s' ? '8-10 minutes' :
      videoDuration === '15s' ? '4-5 minutes'  :
      '2-3 minutes';

    return this.buildSuccess({
      isPending: true,
      jobId: result.jobId,
      contentType: 'video',
      message: 'Video generation started',
      statusCheckUrl: `/video/job-status/${result.jobId}`,
      estimatedTime,
      remaining: result.remaining,
      scriptPairs,
      details: {
        prompt: effectivePrompt.substring(0, 100),
        aspectRatio,
        scriptsGenerated: scriptPairs.length,
        audioType: audioType ?? 'none',
        hasVoiceOver: hasVoiceText,
        voiceGender: voiceGender ?? 'female',
        narratorCharacter: resolvedNarrator.split(',')[0],
        hasSubtitle: burnSubtitles,
        videoDuration: videoDuration || '8s',
        referenceImageCount: referenceImage?.length || 0,
        hasLogo: useLogo,
        source: payload.source,
      },
      processingTime: `${duration}ms`,
    });

  } catch (error) {
    this.handleError(error, `${body.contentType} freestyle`, {
      userId: body.userId,
      contentType: body.contentType,
    });
  }
}




  @Get('job-status/:jobId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Check job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  async getJobStatus(@Param('jobId') jobId: string, @Query('userId') userId?: string) {
    try {
      if (!jobId?.trim()) {
        throw new BadRequestException('jobId is required');
      }

      const sanitizedJobId = jobId.trim();
      const resolvedUserId = userId?.trim() || 'anonymous';

      this.logger.log(`📊 Status - Job: ${sanitizedJobId}, User: ${resolvedUserId}`);

      const status = await this.videoService.getJobStatus(resolvedUserId, sanitizedJobId);

      return this.buildSuccess(status);

    } catch (error) {
      this.handleError(error, 'Job status check', { jobId, userId });
    }
  }

  

  @Post("poll-status")
  @ApiOperation({ summary: 'Poll Veo video status' })
  @ApiResponse({ status: 200, description: 'Status retrieved' })
  async pollStatusOfVideoGeneration(@Body() body: any) {
    try {
      const { operationName, startTimestamp } = body;

      if (!operationName || typeof operationName !== 'string') {
        throw new BadRequestException('Valid operationName required');
      }

      this.logger.log(`📡 Polling - Operation: ${operationName}`);

      const result = await this.videoService.pollingStatusForVideoGenerated(
        operationName,
        startTimestamp,
        body
      );

      return this.buildSuccess(result);

    } catch (error) {
      this.handleError(error, 'Status polling', { operationName: body.operationName });
    }
  }

  @Post("fetch-info")
  @ApiOperation({ summary: 'Fetch domain information' })
  @ApiResponse({ status: 200, description: 'Domain info fetched' })
  async fetchDomainInfo(@Body() body: { domain: string; language?: string; userId: string }): Promise<any> {
    try {
      const { domain, language, userId } = body;

      this.validateRequiredFields({ domain, userId }, ['domain', 'userId']);

      if (!domain?.trim() || !userId?.trim()) {
        return {
          success: false,
          error: !domain?.trim() ? 'Domain cannot be empty' : 'User ID is required',
          retryable: false
        };
      }

      const cleanDomain = domain.trim();
      const cleanLanguage = language?.trim() || 'English';

      this.logger.log(`🌐 Fetch domain - ${cleanDomain}, Lang: ${cleanLanguage}`);

      const domainInfo = await this.videoService.fetchDomainInfoUsingAssistantAPI(
        cleanDomain,
        cleanLanguage,
        userId.trim()
      );

      return {
        success: true,
        data: domainInfo
      };

    } catch (error: any) {
      this.logger.error(`Domain fetch failed: ${error.message}`);

      const isUserFriendly = error.message && (
        error.message.includes('Unable to') ||
        error.message.includes('Please') ||
        error.message.includes('cannot be found') ||
        error.message.includes('took too long')
      );

      const isRetryable = !error.message?.includes('Invalid domain format') &&
                          !error.message?.includes('empty') &&
                          !error.message?.includes('required');

      return {
        success: false,
        error: isUserFriendly 
          ? error.message 
          : `Unable to fetch information from "${body.domain}". Please try again.`,
        retryable: isRetryable,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  @Post("generate-ai-prompt")
  @ApiOperation({ summary: 'Generate AI prompt' })
  @ApiResponse({ status: 200, description: 'AI prompt generated' })
  async generateAIPrompt(@Body() body: {
    about: string;
    brandName: string;
    slogan?: string;
    product?: string;
    style?: string;
    voiceOver?: string;
    deviceType: string;
    contentType?: 'image' | 'video';
    source?: string;
  }) {
    try {
      this.validateRequiredFields(
        { brandName: body.brandName, deviceType: body.deviceType }, 
        ['brandName', 'deviceType']
      );

      this.logger.log(`🤖 Generate AI prompt - Brand: ${body.brandName}`);

      return await this.videoService.generateAIPromptFromData(body);

    } catch (error) {
      this.handleError(error, 'AI prompt generation', { brandName: body.brandName });
    }
  }

  @Post("upload-gcs")
  @UseInterceptors(AnyFilesInterceptor(UPLOAD_CONFIG))
  @ApiOperation({ summary: 'Upload files to GCS' })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: 'Files uploaded' })
  async uploadToGCS(@UploadedFiles() files: Express.Multer.File[]) {
    const startTime = Date.now();
    
    try {
      if (!files?.length) {
        return this.buildSuccess({
          filenames: [],
          count: 0,
          message: 'No files provided'
        });
      }

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const maxTotalSize = CONFIG.FILES.MAX_SIZE * CONFIG.FILES.MAX_COUNT;
      
      if (totalSize > maxTotalSize) {
        throw new BadRequestException(
          `Total size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds max (${Math.round(maxTotalSize / 1024 / 1024)}MB)`
        );
      }

      this.logger.log(`📤 Uploading ${files.length} file(s), ${Math.round(totalSize / 1024 / 1024)}MB`);

      const filenames = await Promise.all(
        files.map((file) => this.videoService.uploadToGCS(file, "uploads"))
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Uploaded ${filenames.length} file(s) - ${duration}ms`);

      return this.buildSuccess({
        filenames,
        count: filenames.length,
        message: `${filenames.length} file(s) uploaded`,
        urls: {
          view: filenames.map(fn => `/video/view-file?filename=${encodeURIComponent(fn)}`),
          download: filenames.map(fn => `/video/test-download?filename=${encodeURIComponent(fn)}`)
        },
        uploadTime: `${duration}ms`
      });

    } catch (error) {
      this.handleError(error, 'File upload', { fileCount: files?.length || 0 });
    }
  }

  private async streamFile(filename: string, res: Response, isDownload: boolean = false): Promise<void> {
    try {
      if (!filename) {
        res.status(400).json({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Missing filename parameter',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const sanitizedFilename = this.sanitizeFilename(filename);
      this.logger.log(`${isDownload ? '⬇️' : '👁️'} ${isDownload ? 'Download' : 'View'}: ${sanitizedFilename}`);

      let workingPath: string | null = null;
      let fileStream: Readable | null = null;
      let metadata: { size?: number | string; contentType?: string } | null = null;

      for (const prefix of CONFIG.FILE_PATHS) {
        try {
          const testPath = `${prefix}${sanitizedFilename}`;
          fileStream = await this.videoService.getFileStream(testPath);
          metadata = await this.videoService.getFileMetadata(testPath);
          workingPath = testPath;
          break;
        } catch {
          continue;
        }
      }

      if (!fileStream || !workingPath) {
        res.status(404).json({
          statusCode: 404,
          error: 'Not Found',
          message: 'File not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const contentType = metadata?.contentType || this.getMimeType(sanitizedFilename);
      const fileName = sanitizedFilename.split('/').pop() || 'download';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      }
      
      if (metadata?.size && typeof metadata.size === 'number' && metadata.size > 0) {
        res.setHeader('Content-Length', metadata.size.toString());
      }

      fileStream.on('error', (streamError) => {
        this.logger.error(`Stream error: ${streamError.message}`);
        if (!res.headersSent) {
          res.status(500).json({ 
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Error streaming file',
            timestamp: new Date().toISOString()
          });
        }
      });

      fileStream.pipe(res);

    } catch (error: any) {
      this.logger.error(`Stream error: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          statusCode: 500,
          error: 'Internal Server Error',
          message: this.isProduction ? 'Error streaming file' : error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  @Get("view-file")
  @ApiOperation({ summary: 'View/stream file from GCS' })
  @ApiQuery({ name: "filename", required: true })
  @ApiResponse({ status: 200, description: 'File streamed' })
  async viewFile(@Query("filename") filename: string, @Res() res: Response): Promise<void> {
    await this.streamFile(filename, res, false);
  }

  @Options("view-file")
  @ApiOperation({ summary: 'CORS preflight' })
  async viewFileOptions(@Res() res: Response): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  }

  @Get("test-download")
  @ApiOperation({ summary: 'Download file from GCS' })
  @ApiQuery({ name: "filename", required: true })
  @ApiResponse({ status: 200, description: "File downloaded" })
  async testDownload(@Query("filename") filename: string, @Res() res: Response): Promise<void> {
    await this.streamFile(filename, res, true);
  }

  @Get("check-file")
  @ApiOperation({ summary: 'Check if file exists' })
  @ApiQuery({ name: "filename", required: true })
  @ApiResponse({ status: 200, description: 'File checked' })
  async checkFile(@Query("filename") filename: string) {
    try {
      if (!filename) {
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Missing filename parameter',
          timestamp: new Date().toISOString()
        };
      }

      const sanitizedFilename = this.sanitizeFilename(filename);
      await this.videoService.getFileStream(sanitizedFilename);
      const metadata = await this.videoService.getFileMetadata(sanitizedFilename);

      return this.buildSuccess({
        exists: true,
        filename: sanitizedFilename,
        size: metadata?.size || 'unknown',
        contentType: metadata?.contentType || 'unknown',
        viewUrl: `/video/view-file?filename=${encodeURIComponent(sanitizedFilename)}`,
        downloadUrl: `/video/test-download?filename=${encodeURIComponent(sanitizedFilename)}`
      });

    } catch {
      return {
        success: false,
        exists: false,
        filename: filename,
        error: 'File not found',
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get("list-bucket-files")
  @ApiOperation({ summary: 'List all GCS files (Admin)' })
  @ApiResponse({ status: 200, description: "Files listed" })
  async listBucketFiles() {
    try {
      const bucketName = process.env.GCP_BUCKET_NAME;
      if (!bucketName) {
        throw new InternalServerErrorException('GCP_BUCKET_NAME not configured');
      }

      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        projectId: process.env.GCP_PROJECT_ID,
      });

      const bucket = storage.bucket(bucketName);
      const [files] = await bucket.getFiles();

      const fileList = files.map((file: any) => ({
        name: file.name,
        size: file.metadata?.size || 'unknown',
        contentType: file.metadata?.contentType || 'unknown',
        created: file.metadata?.timeCreated || 'unknown',
        updated: file.metadata?.updated || 'unknown',
        viewUrl: `/video/view-file?filename=${encodeURIComponent(file.name)}`,
        downloadUrl: `/video/test-download?filename=${encodeURIComponent(file.name)}`
      }));

      const breakdown = {
        generatedImages: fileList.filter(f => f.name.startsWith('generated-images/')).length,
        generatedVideos: fileList.filter(f => f.name.startsWith('generated-videos/')).length,
        uploads: fileList.filter(f => f.name.startsWith('uploads/')).length,
        other: fileList.filter(f => 
          !f.name.startsWith('generated-') && !f.name.startsWith('uploads/')
        ).length
      };

      this.logger.log(`✅ Found ${fileList.length} files in bucket`);

      return this.buildSuccess({
        bucketName,
        totalFiles: fileList.length,
        breakdown,
        files: fileList
      });

    } catch (error) {
      this.handleError(error, 'List bucket files', {});
    }
  }

  @Post("video-prompt")
  @ApiOperation({ 
    summary: '⚠️ DEPRECATED: Use /generate-image',
    deprecated: true 
  })
  @ApiResponse({ status: 202, description: 'Redirected' })
  async generatePrompt(@Body() dto: any) {
    this.logger.warn('⚠️ Deprecated: /video-prompt → use /generate-image');

    return this.generateImage({
      userId: dto.userId,
      storyboard: dto.aiPrompt || dto.storyboard || '',
      useLogo: dto.useLogo,
      useSlogan: dto.useSlogan,
      logoUrl: dto.logoUrl,
      slogan: dto.slogan,
      brandName: dto.brandName,
      referenceImage: dto.referenceImage,
      source: dto.source
    });
  }

  // ===============================================

  // ADD THESE 3 ENDPOINTS TO video.controller.ts

@Post('admin/clear-stuck-job/:jobId')
async clearStuckJob(@Param('jobId') jobId: string) {
  await this.videoService['cacheManager'].del(`job:${jobId}`);
  return { success: true, message: `Job ${jobId} cleared`, jobId };
}

@Get('admin/job-debug/:jobId')
async debugJob(@Param('jobId') jobId: string) {
  const cache = await this.videoService['cacheManager'].get(`job:${jobId}`);
  return { jobId, cache };
}

@Post('admin/fix-completed-job/:jobId')
async fixCompletedJob(@Param('jobId') jobId: string) {
  await this.videoService['cacheManager'].set(`job:${jobId}`, {
    status: 'completed',
    progress: 100,
    updatedAt: new Date().toISOString(),
  }, 300);
  return { success: true, message: `Job ${jobId} marked completed` };
}

@Post('enhance-prompt')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Enhance a prompt or voice script using AI' })
async enhancePrompt(@Body() body: {
  prompt: string;
  type: 'image' | 'video' | 'voiceover' | 'narrator';
  duration?: string; // ✅ e.g. '8s', '15s', '30s'
}) {
  if (!body.prompt?.trim()) {
    throw new BadRequestException('Prompt is required');
  }

  const enhanced = await this.videoService.enhancePrompt(
    body.prompt.trim(),
    body.type ?? 'video',
    body.duration, // ✅ pass through
  );

  return {
    success: true,
    enhanced,
    original: body.prompt.trim(),
  };
}



@Post('test-long-video')
async testLongVideo(@Body() body: any) {
  const { scripts, deviceType, targetDuration } = body;
  return this.videoService.testLongVideoFlow(
    scripts,
    deviceType,
    targetDuration ?? 15
  );
}


@Post('test-generate-scripts')
async testGenerateScripts(@Body() body: { 
  prompt: string; 
  videoDuration: '8s' | '15s' | '30s'; 
  voiceOver?: string 
}) {
  const scriptPairs = await this.videoService.generateVideoScripts(
    body.prompt,
    body.videoDuration,
    body.voiceOver
  );
  return { 
    success: true, 
    count: scriptPairs.length, 
    scriptPairs,                                    // ← show pairs not flat array
    scripts: scriptPairs.map(p => p.script),        // ← for backward compat
  };
}



}
