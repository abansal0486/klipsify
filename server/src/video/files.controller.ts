import { 
  Controller, 
  Get, 
  Res, 
  Req, 
  UseGuards, 
  UnauthorizedException,
  Logger,
  All
} from '@nestjs/common';
import { Response } from 'express';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly videoService: VideoService) {}

  // ✅ Handle all file requests with path-based URLs
  @All('*')
  @UseGuards(JwtAuthGuard)
  async handleFileAccess(
    @Req() req: any,
    @Res() res: Response
  ) {
    try {
      const userId = req.user?.id || req.user?._id;
      console.log('🔍 File request - User:', userId, 'Path:', req.path);
      
      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Extract filename from path
      let filename = '';
      let fileType: 'image' | 'video' | null = null; // ✅ Properly type fileType

      if (req.path.startsWith('/files/image/')) {
        filename = req.path.replace('/files/image/', '');
        fileType = 'image';
      } else if (req.path.startsWith('/files/video/')) {
        filename = req.path.replace('/files/video/', '');
        fileType = 'video';
      } else {
        console.log('❌ Unknown file path:', req.path);
        return res.status(404).json({ error: 'Unknown file path' });
      }

      console.log('🔍 Extracted:', { filename, fileType });

      if (!filename || !fileType) { // ✅ Check both filename and fileType
        return res.status(400).json({ error: 'Invalid file path or type' });
      }

      // ✅ Now TypeScript knows fileType is 'image' | 'video'
      const hasAccess = await this.videoService.checkUserFileAccessByFilename(userId, filename, fileType);
      console.log('🔍 Access check result:', hasAccess ? 'ALLOWED' : 'DENIED');
      
      if (!hasAccess) {
        console.log('❌ Access denied for user', userId, 'to file', filename);
        throw new UnauthorizedException('Access denied to this file');
      }

      // Get file stream
      console.log('📁 Getting file stream for:', filename);
      const fileStream = await this.videoService.getFileStream(filename);
      const metadata = await this.videoService.getFileMetadata(filename);
      
      console.log('📁 File metadata:', { size: metadata.size, contentType: metadata.contentType });

      // Set headers
      res.setHeader('Content-Type', metadata.contentType || this.getMimeType(filename));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      if (metadata.size && typeof metadata.size === 'number' && metadata.size > 0) {
        res.setHeader('Content-Length', metadata.size.toString());
      }
      
      console.log('✅ Serving file:', filename);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error('❌ File serving error:', error.message);
      
      if (error instanceof UnauthorizedException) {
        res.status(401).json({ 
          error: 'Unauthorized access', 
          message: error.message,
          path: req.path 
        });
      } else {
        res.status(500).json({ 
          error: 'Internal server error', 
          message: error.message,
          path: req.path 
        });
      }
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mov': return 'video/quicktime';
      default: return 'application/octet-stream';
    }
  }
}
