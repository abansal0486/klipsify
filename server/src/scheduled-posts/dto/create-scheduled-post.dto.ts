// src/scheduled-posts/dto/create-scheduled-post.dto.ts
import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduledPostDto {
  @ApiProperty({ example: "Hello world!", description: "Text content of the post" })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: "https://example.com/photo.jpg", required: false })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiProperty({ example: "facebook", description: "Target platform: facebook | twitter" })
  @IsString()
  platform: string;

  @ApiProperty({ example: "2025-08-21T10:30:00Z", description: "When to publish (ISO8601 format)" })
  @IsDateString()
  scheduledAt: string;
}
