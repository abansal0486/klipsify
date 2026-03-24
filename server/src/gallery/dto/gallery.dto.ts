// src/gallery/dto/gallery.dto.ts
import { IsString, IsOptional, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class CreateGalleryDto {
  @ApiPropertyOptional({ description: 'Initial image URLs', type: [Object] })
  @IsOptional()
  imageUrls?: any[];


  @ApiPropertyOptional({ description: 'Initial video URLs', type: [Object] })
  @IsOptional()
  videoUrls?: any[];


  @ApiPropertyOptional({ description: 'Prompt used to generate the content' })
  @IsOptional()
  @IsString()
  generatedPrompt?: string;

  @ApiPropertyOptional({ description: 'Source of the media (e.g., generated, uploaded, imported)' })
  @IsOptional()
  @IsString()
  source?: string;
}


export class AddMediaDto {
  @ApiPropertyOptional({ description: 'Image URL to add' })
  @IsOptional()
  @IsUrl({}, { message: 'Invalid image URL format' })
  imageUrl?: string;


  @ApiPropertyOptional({ description: 'Video URL to add' })
  @IsOptional()
  @IsUrl({}, { message: 'Invalid video URL format' })
  videoUrl?: string;


  @ApiPropertyOptional({ description: 'Optional filename' })
  @IsOptional()
  @IsString()
  filename?: string;


  @ApiPropertyOptional({ description: 'Prompt used to generate this media' })
  @IsOptional()
  @IsString()
  generatedPrompt?: string;


  @ApiPropertyOptional({ description: 'Image URL for video thumbnail' })
  @IsOptional()
  @IsString()
  imageURL?: string;

  @ApiPropertyOptional({ description: 'Source of the media (e.g., generated, uploaded, imported)' })
  @IsOptional()
  @IsString()
  source?: string;
}


export class UpdateMediaDto {
  @ApiProperty({ description: 'New filename' })
  @IsNotEmpty({ message: 'Filename is required' })
  @IsString()
  name: string;


  @ApiPropertyOptional({ description: 'Update the generated prompt' })
  @IsOptional()
  @IsString()
  generatedPrompt?: string;

  @ApiPropertyOptional({ description: 'Source of the media (e.g., product,freestyle)' })
  @IsOptional()
  @IsString()
  source?: string;
}
