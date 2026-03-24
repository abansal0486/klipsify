// src/scheduled-posts/scheduled-posts.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ScheduledPostsService } from './scheduled-posts.service';
import { CreateScheduledPostDto } from './dto/create-scheduled-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('scheduled-posts')
export class ScheduledPostsController {
  constructor(private readonly scheduledPostsService: ScheduledPostsService) {}
  
@ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post()
  async schedulePost(@Req() req, @Body() dto: CreateScheduledPostDto) {
    const userId = req.user._id; // from JWT
    return this.scheduledPostsService.create(userId, dto);
  }
}
