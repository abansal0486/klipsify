// src/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { VideoProcessor } from './processors/video.processor';
import { ImageProcessor } from './processors/image.processor';
import { Project, ProjectSchema } from './schemas/project.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Gallery, GallerySchema } from '../video/schema/gallery.schema';
import { ProjectGallery, ProjectGallerySchema } from './schemas/project-gallery.schema';
import { CacheModule } from '@nestjs/cache-manager';
import { ProjectProcessingService } from './project.processing.service';
import { Product, ProductSchema } from './schemas/product.schema';
import { Brand, BrandSchema } from './schemas/brand.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Brand.name, schema: BrandSchema },
      { name: User.name, schema: UserSchema },
      { name: Gallery.name, schema: GallerySchema },
      { name: ProjectGallery.name, schema: ProjectGallerySchema },
    ]),
    // ✅ Register Bull queues for this module
    BullModule.registerQueue(
      { name: 'video-generation' },
      { name: 'image-generation' },
    ),
    CacheModule.register({
      ttl: 600, // 10 minutes cache TTL
      max: 100, // Maximum number of items in cache
    }),
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    VideoProcessor, 
    ImageProcessor, 
    ProjectProcessingService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
