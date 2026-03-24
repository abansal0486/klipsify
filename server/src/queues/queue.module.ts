// src/queues/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          maxRetriesPerRequest: 3,
        },
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed
          removeOnFail: 500, // Keep last 500 failed for debugging
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'video-generation' },
      { name: 'image-generation' },
      { name: 'file-upload' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
