// src/scheduled-posts/scheduled-posts.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduledPost, ScheduledPostSchema } from './schemas/scheduled-post.schema';
import { ScheduledPostsService } from './scheduled-posts.service';
import { ScheduledPostsController } from './scheduled-posts.controller';
import { PostWorkerService } from './post-worker.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ScheduledPost.name, schema: ScheduledPostSchema }]),
  ],
  controllers: [ScheduledPostsController],
  providers: [ScheduledPostsService, PostWorkerService],
})
export class ScheduledPostsModule {}
