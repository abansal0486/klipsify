import { 
  IsString, 
  IsOptional, 
  IsBoolean, 
  IsArray, 
  IsEnum, 
  IsNotEmpty, 
  MaxLength,
  ArrayMaxSize,
  ValidateIf
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

// =====================================================
// ENUMS
// =====================================================

export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video'
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  WIDESCREEN = '21:9'
}

export enum LogoPosition {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right'
}

// =====================================================
// 🔥 YOUR EXISTING DTO (Enhanced with validation)
// =====================================================

export class CreateVideoDto {
  @ApiProperty({ description: 'User ID', example: 'user_123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  userId: string;

  @ApiProperty({ description: 'Business/brand description' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  about: string;

  @ApiProperty({ description: 'Is this a regeneration request', default: false })
  @IsBoolean()
  forRegeneration: boolean;

  @ApiProperty({ description: 'Brand name', example: 'TechCorp' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  brandName: string;

  @ApiProperty({ description: 'Target audience', example: 'Young professionals' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  audience: string;

  @ApiPropertyOptional({ description: 'Brand slogan' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  slogan?: string;

  @ApiPropertyOptional({ description: 'Tagline' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  tagline?: string;

  @ApiPropertyOptional({ 
    description: 'Device type / aspect ratio', 
    example: '16:9',
    enum: AspectRatio 
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deviceType?: string;

  @ApiPropertyOptional({ description: 'Logo URL (GCS or HTTP)' })
  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== null)
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @ApiPropertyOptional({ 
    description: 'Reference image URLs (max 5)', 
    type: [String],
    example: ['https://...', 'gs://...'] 
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Maximum 5 image URLs allowed' })
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ 
    description: 'Reference video URLs (max 3)', 
    type: [String] 
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 video URLs allowed' })
  @IsString({ each: true })
  videoUrls?: string[];

  @ApiPropertyOptional({ description: 'Products/services description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  products?: string;

  @ApiPropertyOptional({ description: 'Business domain/website' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  domain?: string;

  @ApiProperty({ description: 'Visual style preference', example: 'Modern and minimalist' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  style: string;

  @ApiPropertyOptional({ description: 'Additional summary/context' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  summary?: string;

  @ApiPropertyOptional({ description: 'Content language', default: 'English' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsOptional()
  @ValidateIf((o) => o.instructions !== null)
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  instructions?: string | null;
}

// =====================================================
// IMAGE GENERATION DTO
// =====================================================

export class GenerateImageDto {
  @ApiProperty({ description: 'User ID', example: 'user_123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  userId: string;

  @ApiProperty({ description: 'AI-generated storyboard/prompt', example: 'A futuristic cityscape at sunset...' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => value?.trim())
  storyboard: string;

  @ApiPropertyOptional({ description: 'Brand name', example: 'TechCorp' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  brandName?: string;

  @ApiPropertyOptional({ description: 'Use logo overlay via FFmpeg', default: false })
  @IsOptional()
  @IsBoolean()
  useLogo?: boolean;

  @ApiPropertyOptional({ description: 'Logo URL (GCS or HTTP)', example: 'gs://bucket/logo.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Use slogan', default: false })
  @IsOptional()
  @IsBoolean()
  useSlogan?: boolean;

  @ApiPropertyOptional({ description: 'Slogan text', example: 'Innovation starts here' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  slogan?: string;

  @ApiPropertyOptional({ 
    description: 'Reference images for Gemini (max 3)', 
    type: [String],
    example: ['https://...', 'gs://...'] 
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 reference images allowed' })
  @IsString({ each: true })
  referenceImage?: string[];

  @ApiPropertyOptional({ 
    description: 'Content source', 
    example: 'Product',
    enum: ['Product', 'Service', 'Freestyle']
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @ApiPropertyOptional({ description: 'Device type/aspect ratio', example: '16:9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deviceType?: string;

  @ApiPropertyOptional({ description: 'Language', default: 'English' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}

// =====================================================
// VIDEO GENERATION DTO
// =====================================================

export class GenerateVideoDto {
  @ApiProperty({ description: 'User ID', example: 'user_123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  userId: string;

  @ApiProperty({ description: 'AI-generated storyboard/prompt' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => value?.trim())
  storyboard: string;

  @ApiPropertyOptional({ description: 'Brand name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  brandName?: string;

  @ApiPropertyOptional({ 
    description: 'Video aspect ratio', 
    enum: AspectRatio, 
    default: '16:9' 
  })
  @IsOptional()
  @IsEnum(AspectRatio)
  videoRatio?: string;

  @ApiPropertyOptional({ description: 'Use logo overlay via FFmpeg', default: false })
  @IsOptional()
  @IsBoolean()
  useLogo?: boolean;

  @ApiPropertyOptional({ description: 'Logo URL (GCS or HTTP)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Use slogan', default: false })
  @IsOptional()
  @IsBoolean()
  useSlogan?: boolean;

  @ApiPropertyOptional({ description: 'Slogan text' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  slogan?: string;

  @ApiPropertyOptional({ description: 'Voice-over text' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  voiceOverText?: string;

  @ApiPropertyOptional({ description: 'Camera angle description', example: 'Top-down aerial view' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  cameraAngle?: string;

  @ApiPropertyOptional({ description: 'Background reference description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  backgroundReference?: string;

  @ApiPropertyOptional({ description: 'Language', default: 'English' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @ApiPropertyOptional({ 
    description: 'Reference images for Veo3 (max 3)', 
    type: [String] 
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 reference images allowed' })
  @IsString({ each: true })
  referenceImage?: string[];

  @ApiPropertyOptional({ 
    description: 'Content source', 
    example: 'Product' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

// =====================================================
// UNIFIED GENERATE CONTENT DTO
// =====================================================

export class GenerateContentDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  userId: string;

  @ApiPropertyOptional({ description: 'Content name/title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  contentName?: string;

  @ApiProperty({ description: 'Generation prompt' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => value?.trim())
  prompt: string;

  @ApiProperty({ description: 'Aspect ratio', enum: AspectRatio })
  @IsEnum(AspectRatio)
  aspectRatio: string;

  @ApiProperty({ description: 'Content type', enum: ContentType })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiPropertyOptional({ description: 'Voice-over text (video only)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  voiceOver?: string;

  @ApiPropertyOptional({ 
    description: 'Reference images (max 3)', 
    type: [String] 
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 reference images allowed' })
  @IsString({ each: true })
  referenceImage?: string[];

  @ApiPropertyOptional({ description: 'Logo URL for FFmpeg overlay' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string;

  @ApiPropertyOptional({ description: 'Content source', example: 'Freestyle' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

// =====================================================
// DOMAIN INFO DTO
// =====================================================

export class FetchDomainInfoDto {
  @ApiProperty({ description: 'Domain/website URL', example: 'example.com' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  domain: string;

  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  userId: string;

  @ApiPropertyOptional({ description: 'Language', default: 'English' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}

// =====================================================
// POLL STATUS DTO
// =====================================================

export class PollStatusDto {
  @ApiProperty({ description: 'Veo operation name' })
  @IsNotEmpty()
  @IsString()
  operationName: string;

  @ApiPropertyOptional({ description: 'Start timestamp (Unix time)' })
  @IsOptional()
  startTimestamp?: number;
}

// =====================================================
// AI PROMPT GENERATION DTO
// =====================================================

export class GenerateAIPromptDto {
  @ApiProperty({ description: 'Business/brand description' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  about: string;

  @ApiProperty({ description: 'Brand name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  brandName: string;

  @ApiPropertyOptional({ description: 'Brand slogan' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  slogan?: string;

  @ApiPropertyOptional({ description: 'Products/services description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  products?: string;

  @ApiPropertyOptional({ description: 'Visual style preference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  style?: string;

  @ApiPropertyOptional({ description: 'Voice-over text' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  voiceOver?: string;

  @ApiProperty({ description: 'Device type/aspect ratio' })
  @IsNotEmpty()
  @IsString()
  deviceType: string;

  @ApiPropertyOptional({ 
    description: 'Content type', 
    enum: ContentType, 
    default: ContentType.VIDEO 
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({ 
    description: 'Source type', 
    default: 'Product',
    enum: ['Product', 'Service', 'Freestyle']
  })
  @IsOptional()
  @IsString()
  source?: string;
}

// =====================================================
// RESPONSE DTOS
// =====================================================

export class JobStatusResponse {
  @ApiProperty()
  jobId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: ['queued', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiProperty()
  progress: number;

  @ApiProperty({ required: false })
  result?: any;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty()
  updatedAt: string;
}

export class GenerationResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  isPending: boolean;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  statusCheckUrl: string;

  @ApiProperty()
  estimatedTime: string;

  @ApiProperty({ required: false })
  remaining?: number;

  @ApiProperty({ required: false })
  details?: any;
}

export class ApiSuccessResponse<T = any> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  message?: string;

  @ApiProperty()
  timestamp?: string;
}

export class ApiErrorResponse {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  error: string;

  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  timestamp: string;

  @ApiProperty({ required: false })
  path?: string;

  @ApiProperty({ required: false })
  details?: any;
}

// =====================================================
// LOGO OVERLAY OPTIONS DTO (for FFmpeg integration)
// =====================================================

export class LogoOverlayOptionsDto {
  @ApiPropertyOptional({ 
    description: 'Logo position', 
    enum: LogoPosition, 
    default: LogoPosition.BOTTOM_RIGHT 
  })
  @IsOptional()
  @IsEnum(LogoPosition)
  position?: LogoPosition;

  @ApiPropertyOptional({ 
    description: 'Logo scale (% of video width)', 
    example: 0.15,
    default: 0.15 
  })
  @IsOptional()
  scale?: number;

  @ApiPropertyOptional({ 
    description: 'Padding from edge (pixels)', 
    example: 20,
    default: 20 
  })
  @IsOptional()
  padding?: number;

  @ApiPropertyOptional({ 
    description: 'Fade in duration (seconds)', 
    default: 0 
  })
  @IsOptional()
  fadeIn?: number;

  @ApiPropertyOptional({ 
    description: 'Fade out duration (seconds)', 
    default: 0 
  })
  @IsOptional()
  fadeOut?: number;
}
