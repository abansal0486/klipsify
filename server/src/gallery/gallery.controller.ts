// src/gallery/gallery.controller.ts - UPDATED WITH PROMPT, THUMBNAIL & SOURCE SUPPORT (BACKWARD COMPATIBLE)
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProperty } from '@nestjs/swagger';
import { GalleryService } from './gallery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Gallery } from '../video/schema/gallery.schema';


@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);


  constructor(private readonly galleryService: GalleryService) {}


  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user gallery by ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Gallery retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Gallery not found' })
  async getUserGallery(@Param('userId') userId: string): Promise<Gallery | null> {
    this.logger.log(`Fetching gallery for userId: ${userId}`);
    return this.galleryService.findByUserId(userId);
  }


  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all galleries (Admin only)' })
  @ApiResponse({ status: 200, description: 'All galleries retrieved successfully' })
  async getAllGalleries(): Promise<Gallery[]> {
    this.logger.log('Admin fetching all galleries');
    return this.galleryService.findAllGalleries();
  }


  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create gallery' })
  @ApiResponse({ status: 201, description: 'Gallery created successfully' })
  async createGallery(@Body() body: Partial<Gallery>): Promise<Gallery> {
    this.logger.log(`Creating gallery for user: ${body.userId}`);
    return this.galleryService.create(body);
  }


  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add image to gallery' })
  @ApiResponse({ status: 201, description: 'Image added successfully' })
  async addImage(
    @Body() body: { 
      userId: string; 
      imageUrl: string; 
      filename?: string;
      generatedPrompt?: string; // ✅ Optional, won't break existing calls
      source?: string; // ✅ NEW - Optional source tracking
    }
  ): Promise<Gallery> {
    this.logger.log(`Adding image for user: ${body.userId}`);
    
    if (!body.userId || !body.imageUrl) {
      throw new BadRequestException('userId and imageUrl are required');
    }


    // ✅ Pass all parameters including optional prompt and source
    return this.galleryService.addImageToGallery(
      body.userId,
      body.imageUrl,
      body.filename,
      body.generatedPrompt, // Will be undefined if not provided (backward compatible)
      body.source // Will be undefined if not provided (backward compatible)
    );
  }


  @Post('video')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add video to gallery' })
  @ApiResponse({ status: 201, description: 'Video added successfully' })
  async addVideo(
    @Body() body: { 
      userId: string; 
      videoUrl: string; 
      filename?: string;
      imageURL?: string; // ✅ Optional video thumbnail
      generatedPrompt?: string; // ✅ Optional prompt
      source?: string; // ✅ NEW - Optional source tracking
    }
  ): Promise<Gallery> {
    this.logger.log(`Adding video for user: ${body.userId}`);
    
    if (!body.userId || !body.videoUrl) {
      throw new BadRequestException('userId and videoUrl are required');
    }


    // ✅ Pass all parameters including optional imageURL, prompt, and source
    return this.galleryService.addVideoToGallery(
      body.userId,
      body.videoUrl,
      body.filename,
      body.imageURL, // Will be undefined if not provided (backward compatible)
      body.generatedPrompt, // Will be undefined if not provided (backward compatible)
      body.source // Will be undefined if not provided (backward compatible)
    );
  }


  @Delete('/:type/:galleryId/:fileId/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete media from gallery' })
  @ApiParam({ name: 'type', enum: ['image', 'video'] })
  @ApiParam({ name: 'galleryId', description: 'Gallery ID' })
  @ApiParam({ name: 'fileId', description: 'File ID to delete' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Media deleted successfully' })
  async deleteMedia(
    @Param('type') type: string,
    @Param('galleryId') galleryId: string,
    @Param('fileId') fileId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    this.logger.log(`Deleting ${type} ${fileId} for user: ${userId}`);


    if (type !== 'image' && type !== 'video') {
      throw new BadRequestException('Type must be either "image" or "video"');
    }


    await this.galleryService.deleteMediaFromGallery(type, galleryId, fileId, userId);
  }


  @Put('/:type/:galleryId/:fileId/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update media in gallery' })
  @ApiParam({ name: 'type', enum: ['image', 'video'] })
  @ApiParam({ name: 'galleryId', description: 'Gallery ID' })
  @ApiParam({ name: 'fileId', description: 'File ID to update' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Media updated successfully' })
  async updateMedia(
    @Param('type') type: string,
    @Param('galleryId') galleryId: string,
    @Param('fileId') fileId: string,
    @Param('userId') userId: string,
    @Body() updateFile: { 
      name: string;
      generatedPrompt?: string; // ✅ Optional prompt update
      source?: string; // ✅ NEW - Optional source update
    }
  ): Promise<any> {
    this.logger.log(`Updating ${type} ${fileId} for user: ${userId}`);


    if (type !== 'image' && type !== 'video') {
      throw new BadRequestException('Type must be either "image" or "video"');
    }


    return await this.galleryService.updateMediaFromGallery(
      type,
      galleryId,
      fileId,
      userId,
      updateFile
    );
  }
}
