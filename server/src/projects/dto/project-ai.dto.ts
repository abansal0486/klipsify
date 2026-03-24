// src/projects/dto/project-ai.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ description: 'User message to AI', example: 'Create a marketing plan for my product' })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  message: string;
}

export class OptimizePromptDto {
  @ApiProperty({ description: 'User prompt to optimize', example: 'A beautiful sunset' })
  @IsString()
  @IsNotEmpty({ message: 'Prompt cannot be empty' })
  prompt: string;

  @ApiPropertyOptional({ 
    description: 'Content type for optimization', 
    enum: ['video', 'image'],
    example: 'image'
  })
  @IsOptional()
  @IsEnum(['video', 'image'])
  contentType?: 'video' | 'image';
}

export class GenerateContentDto {
  @ApiProperty({ 
    description: 'Storyboard description for content generation',
    example: 'A product showcase video with dynamic transitions'
  })
  @IsString()
  @IsNotEmpty({ message: 'Storyboard description is required' })
  storyboard: string;

  @ApiProperty({ 
    description: 'Type of content to generate', 
    enum: ['video', 'image'],
    example: 'video'
  })
  @IsEnum(['video', 'image'], { message: 'contentType must be "video" or "image"' })
  contentType: 'video' | 'image';

  @ApiProperty({ description: 'Include project logo in generated content', example: true })
  @IsBoolean()
  useLogo: boolean;

  @ApiProperty({ description: 'Include project slogan in generated content', example: true })
  @IsBoolean()
  useSlogan: boolean;

  // ✅ VIDEO-ONLY FIELDS

  @ApiPropertyOptional({
    description: 'Video aspect ratio',
    example: '16:9',
  })
  @IsOptional()
  @IsString()
  videoRatio?: string;

  @ApiPropertyOptional({
    description: 'Background / environment description',
    example: 'urban cityscape at sunset',
  })
  @IsOptional()
  @IsString()
  backgroundReference?: string;

  @ApiPropertyOptional({
    description: 'Voice over script text',
    example: 'Introducing the future of innovation...',
  })
  @IsOptional()
  @IsString()
  voiceOverText?: string;

  @ApiPropertyOptional({
    description: 'Camera angle / shot type',
    example: 'wide shot, low-angle',
  })
  @IsOptional()
  @IsString()
  cameraAngle?: string;
}
