import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UnauthorizedException,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { GenerateContentDto, ChatMessageDto, OptimizePromptDto } from './dto/project-ai.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  private getUserId(req: any): string {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return req.user.id;
  }

  // ==================== FILE SERVING ====================

  @Public()
  @Get('files/view')
  @ApiOperation({ summary: 'Stream file from GCS for viewing' })
  @ApiQuery({ name: 'filename', description: 'File name to view' })
  @ApiResponse({ status: 200, description: 'File stream returned' })
  async viewFile(
    @Query('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!filename) {
      throw new BadRequestException('Filename is required');
    }

    // ✅ SECURITY FIX: Path traversal protection
    if (filename.includes('..') || filename.startsWith('/')) {
      throw new BadRequestException('Invalid filename');
    }

    // ✅ SECURITY FIX: Validate file extension
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'];
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException('File type not allowed');
    }

    this.logger.log(`Streaming file: ${filename}`);

    try {
      const stream = await this.projectsService.getFileStream(filename);

      const contentTypeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        mp4: 'video/mp4',
        webm: 'video/webm',
      };

      res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      // ✅ SECURITY FIX: Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');

      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Error streaming file ${filename}:`, error.stack);
      res.status(400).json({ error: 'Failed to stream file' });
    }
  }


  

  @Public()
  @Get('files/download')
  @ApiOperation({ summary: 'Download file from GCS' })
  @ApiQuery({ name: 'filename', description: 'File name to download' })
  async downloadFile(
    @Request() req,
    @Query('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!filename) {
      throw new BadRequestException('Filename is required');
    }

    // ✅ SECURITY FIX: Path traversal protection
    if (filename.includes('..') || filename.startsWith('/')) {
      throw new BadRequestException('Invalid filename');
    }

    // ✅ SECURITY FIX: Validate file extension
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'];
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException('File type not allowed');
    }

    try {
      const userId = req.user?.id;

      if (userId) {
        const hasAccess = await this.projectsService.checkUserFileAccess(userId, filename);
        if (!hasAccess) {
          throw new BadRequestException('Access denied to this file');
        }
      }

      const stream = await this.projectsService.getFileStream(filename);
      const originalName = filename.split('/').pop() || 'download';

      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Error downloading file ${filename}:`, error.stack);
      res.status(400).json({ error: 'Failed to download file' });
    }
  }

  // ==================== CRUD OPERATIONS ====================
 // commented by aman on 18 march old function
  // @Post()
  // @HttpCode(HttpStatus.CREATED)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Create new project with optional file uploads' })
  // @ApiConsumes('multipart/form-data')
  // @ApiResponse({ status: 201, description: 'Project created successfully' })
  // @UseInterceptors(
  //   FileFieldsInterceptor([
  //     { name: 'logo', maxCount: 1 },
  //     { name: 'mediaFiles', maxCount: 10 },
  //   ]),
  // )
 
  // async create(
  //   @Request() req,
  //   @Body() createProjectDto: CreateProjectDto,
  //   @UploadedFiles()
  //   files?: {
  //     logo?: Express.Multer.File[];
  //     mediaFiles?: Express.Multer.File[];
  //   },
  // ) {
  //   const userId = this.getUserId(req);
  //   this.logger.log(`User ${userId} creating project: ${createProjectDto.projectName}`);

  //   return this.projectsService.create(userId, createProjectDto, files);
  // }


   @Post('create-new-project')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new project with optional file uploads' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'mediaFiles', maxCount: 10 },
    ]),
  )
  async create(
    @Request() req,
    @Body() createProjectDto: CreateProjectDto,
    @UploadedFiles()
    files?: {
      logo?: Express.Multer.File[];
      mediaFiles?: Express.Multer.File[];
    },
  ) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} creating project: ${createProjectDto.projectName}`);

    return this.projectsService.create(userId, createProjectDto, files);
  }


  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all projects for authenticated user' })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
  async findAll(@Request() req) {
    const userId = this.getUserId(req);
    this.logger.log(`Fetching all projects for user: ${userId}`);

    return this.projectsService.findByUserId(userId);
  }

  @Get(':projectId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get single project by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project retrieved successfully' })
  async findOne(@Request() req, @Param('projectId') projectId: string) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} fetching project: ${projectId}`);

    return this.projectsService.findOne(userId, projectId);
  }

  @Put(':projectId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update project with optional file uploads' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'mediaFiles', maxCount: 10 },
    ]),
  )
  async update(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @UploadedFiles()
    files?: {
      logo?: Express.Multer.File[];
      mediaFiles?: Express.Multer.File[];
    },
  ) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} updating project: ${projectId}`);

    return this.projectsService.update(userId, projectId, updateProjectDto, files);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive/soft-delete project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project archived successfully' })
  async archive(@Request() req, @Param('projectId') projectId: string) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} archiving project: ${projectId}`);

    return this.projectsService.archive(userId, projectId);
  }

  // ==================== AI & CONTENT GENERATION ====================

  @Post(':projectId/generate-calendar')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate weekly marketing calendar using AI' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Calendar generated successfully' })
  async generateCalendar(
    @Request() req,
    @Param('projectId') projectId: string,
  ) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} generating calendar for project: ${projectId}`);

    return this.projectsService.generateWeeklyCalendar(userId, projectId);
  }

  @Post(':projectId/chat')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chat with AI about marketing plan' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiBody({ type: ChatMessageDto })
  @ApiResponse({ status: 200, description: 'AI response generated' })
  async chatWithAI(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: ChatMessageDto,
  ) {
    const userId = this.getUserId(req);

    // ✅ IMPROVEMENT: Add length validation
    if (!body.message?.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    if (body.message.length > 5000) {
      throw new BadRequestException('Message too long (max 5000 characters)');
    }

    this.logger.log(`User ${userId} chatting with AI for project: ${projectId}`);

    return this.projectsService.chatWithAI(userId, projectId, body.message);
  }

  @Post(':projectId/optimize-prompt')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Optimize user prompt for image/video generation' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiBody({ type: OptimizePromptDto })
  @ApiResponse({ status: 200, description: 'Prompt optimized successfully' })
  async optimizePrompt(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: OptimizePromptDto,
  ) {
    const userId = this.getUserId(req);

    // ✅ IMPROVEMENT: Add length validation
    if (!body.prompt?.trim()) {
      throw new BadRequestException('Prompt cannot be empty');
    }

    if (body.prompt.length > 10000) {
      throw new BadRequestException('Prompt too long (max 10000 characters)');
    }

    this.logger.log(`User ${userId} optimizing prompt for project: ${projectId}`);
    this.logger.log(`Controller optimize-prompt ${body.prompt} project id ${body.contentType}`);

    return this.projectsService.optimizePromptForGeneration(
      userId,
      projectId,
      body.prompt,
      body.contentType,
    );
  }

  @Post(':projectId/generate-content')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate final content (image or video) from storyboard' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiBody({ type: GenerateContentDto })
  @ApiResponse({ status: 200, description: 'Content generation started' })
  async generateContentFromStoryboard(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() generateDto: GenerateContentDto,
  ) {
    const userId = this.getUserId(req);

    // ✅ IMPROVEMENT: Enhanced validation
    if (!generateDto.storyboard?.trim()) {
      throw new BadRequestException('Storyboard description is required');
    }

    if (generateDto.storyboard.length > 10000) {
      throw new BadRequestException('Storyboard too long (max 10000 characters)');
    }

    if (!['video', 'image'].includes(generateDto.contentType)) {
      throw new BadRequestException('contentType must be "video" or "image"');
    }

    // ✅ IMPROVEMENT: Validate video ratio
    if (generateDto.contentType === 'video' && generateDto.videoRatio) {
      const validRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
      if (!validRatios.includes(generateDto.videoRatio)) {
        throw new BadRequestException(
          `Invalid video ratio. Must be one of: ${validRatios.join(', ')}`
        );
      }
    }

    this.logger.log(
      `User ${userId} generating ${generateDto.contentType} for project: ${projectId}`,
    );

    return this.projectsService.generateContentFromStoryboard(
      userId,
      projectId,
      generateDto,
    );
  }

  // ==================== JOB STATUS ====================

  // ✅ FIXED: Single unified job status endpoint (replaces old /video-status)
  @Get(':projectId/job-status/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check video/image generation job status' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'jobId', description: 'Bull Queue Job ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Job status retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        isPending: { type: 'boolean' },
        status: { 
          type: 'string', 
          enum: ['completed', 'failed', 'active', 'waiting', 'delayed'] 
        },
        contentType: { type: 'string', enum: ['video', 'image'] },
        progress: { type: 'number', minimum: 0, maximum: 100 },
        message: { type: 'string' },
        videoUrl: { type: 'string' },
        imageUrl: { type: 'string' },
        viewUrl: { type: 'string' },
      }
    }
  })
  async checkJobStatus(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('jobId') jobId: string,
  ) {
    const userId = this.getUserId(req);

    if (!jobId) {
      throw new BadRequestException('jobId is required');
    }

    this.logger.log(
      `User ${userId} checking job ${jobId} for project ${projectId}`,
    );

    return this.projectsService.checkJobStatus(
      userId,
      projectId,
      jobId,
    );
  }

  // ==================== GALLERY ====================

  @Get(':projectId/gallery')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get project gallery (all generated images/videos)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Gallery retrieved successfully' })
  async getProjectGallery(
    @Request() req,
    @Param('projectId') projectId: string,
  ) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} fetching gallery for project: ${projectId}`);

    return this.projectsService.getProjectGallery(userId, projectId);
  }
}