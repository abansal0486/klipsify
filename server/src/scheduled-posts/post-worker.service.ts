// src/scheduled-posts/post-worker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledPostsService } from './scheduled-posts.service';

@Injectable()
export class PostWorkerService {
  private readonly logger = new Logger(PostWorkerService.name);

  constructor(private readonly scheduledPostsService: ScheduledPostsService) {}

  @Cron('*/1 * * * *') // every minute
  async handleScheduledPosts() {
    const posts = await this.scheduledPostsService.findPendingPosts();

    for (const post of posts) {
      try {
        // TODO: Integrate Facebook/Twitter API posting
        this.logger.log(`Posting to ${post.platform}: ${post.content}`);
        
        await this.scheduledPostsService.markAsPosted(post.id);
      } catch (err) {
        await this.scheduledPostsService.markAsFailed(post.id);
      }
    }
  }
}
