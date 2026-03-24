// src/projects/dto/create-project.dto.ts - ENHANCED VERSION
import {
  IsString,
  IsOptional,
  IsUrl,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'Summer Campaign 2025',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Project name must be at least 1 characters' })
  @MaxLength(100, { message: 'Project name cannot exceed 100 characters' })
  projectName: string;

  @ApiPropertyOptional({ description: 'Brand name', example: 'Nike' })
  @IsString()
  @IsOptional()
  brandName?: string;

  @ApiPropertyOptional({ description: 'Business niche', example: 'Sports Apparel' })
  @IsString()
  @IsOptional()
  niche?: string;

  @ApiPropertyOptional({ description: 'Industry', example: 'Sports Apparel' })
  @IsString()
  @IsOptional()
  industry?: string;


  @ApiPropertyOptional({ description: 'Description', example: 'Sports Apparel' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Target audience', example: 'Athletes aged 18-35' })
  @IsString()
  @IsOptional()
  audience?: string;

  @ApiPropertyOptional({ description: 'Brand slogan', example: 'Just Do It' })
  @IsString()
  @IsOptional()
  slogan?: string;

  @ApiPropertyOptional({ description: 'Products or services', example: 'Running shoes, sportswear' })
 @IsArray()
@IsOptional()
@Transform(({ value }) => {
  return typeof value === 'string' ? JSON.parse(value) : value;
})
products?: { productName: string; productImage: string }[];


  @ApiPropertyOptional({ description: 'Website domain', example: 'https://example.com' })
  // @IsUrl({}, { message: 'Invalid domain URL' })
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ description: 'Brand style/tone', example: 'Professional, Modern' })
  @IsString()
  @IsOptional()
  style?: string;

  @ApiPropertyOptional({ description: 'Whether to generate weekly marketing plan', example: true })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    if (value === undefined || value === null) return undefined;
    return false;
  })
  wantsWeeklyPlan?: boolean;

  @ApiPropertyOptional({ description: 'Number of videos per week', example: 3 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'number') return value;
    const parsed = parseInt(value?.toString() || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  })
  videosPerWeek?: number;

  @ApiPropertyOptional({ description: 'Number of images per week', example: 5 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'number') return value;
    const parsed = parseInt(value?.toString() || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  })
  imagesPerWeek?: number;

  @ApiPropertyOptional({ description: 'Preferred language', example: 'en' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ 
    description: 'AI conversation history', 
    type: [Object],
    example: [] 
  })
  @IsArray()
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    return [];
  })
  conversationLog?: any[];

  @ApiPropertyOptional({ description: 'Additional brand information', type: Object })
  @IsOptional()
  brandInfo?: any;
}
