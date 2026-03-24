import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';  // 🔥 ADD THIS
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { FilesController } from './files.controller';
import { ImageProcessor } from './processors/image.processor';
import { VideoProcessor } from './processors/video.processor';
import { Gallery, GallerySchema } from "./schema/gallery.schema";
import { VideoPrompt, VideoPromptSchema } from './schema/video-prompt.schema';
import { User, UserSchema } from "src/users/schemas/user.schema";
import { VideoProcessingService } from './video-processing.service';
import { Subscription, SubscriptionSchema,  } from "src/subscriptions/schemas/subscription.schema";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Gallery.name, schema: GallerySchema },
      { name: VideoPrompt.name, schema: VideoPromptSchema },
    ]),
    
   BullModule.registerQueue(
      { 
        name: 'video-image-generation',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          timeout: 120000, // 2 minutes
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 200, // Keep last 200 failed jobs
        },
      },
      { 
        name: 'video-video-generation',
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          timeout: 600000, // 10 minutes
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    ),


    // 🔥 ADD THIS: Import CacheModule (it's already global but needs explicit import)
    CacheModule.register(),
  ],
  controllers: [VideoController, FilesController],
  providers: [
    VideoService,
    ImageProcessor,
    VideoProcessor,
    VideoProcessingService
  ],
  exports: [MongooseModule, VideoService, VideoProcessingService],
})
export class VideoModule { }
