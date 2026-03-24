// src/gallery/gallery.service.ts - UPDATED WITH PROMPT, THUMBNAIL & SOURCE SUPPORT (BACKWARD COMPATIBLE)
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Gallery, GalleryDocument } from '../video/schema/gallery.schema';


@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);


  constructor(
    @InjectModel(Gallery.name) private galleryModel: Model<GalleryDocument>,
  ) {}


  async findByUserId(userId: string): Promise<Gallery | null> {
    try {
      const gallery = await this.galleryModel.findOne({ userId }).lean().exec();


      if (!gallery) {
        return null;
      }


      return this.filterAndSortMedia(gallery);
    } catch (error) {
      this.logger.error(`Error fetching gallery for user ${userId}:`, error.stack);
      throw new InternalServerErrorException('Failed to fetch gallery');
    }
  }


  async findAllGalleries(): Promise<Gallery[]> {
    try {
      const galleries = await this.galleryModel.aggregate([
        {
          $addFields: {
            userIdObj: { $toObjectId: '$userId' },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userIdObj',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            user: {
              _id: 1,
              name: 1,
              email: 1,
              role: 1,
            },
            imageUrls: 1,
            videoUrls: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);


      return galleries.map((gallery) => this.filterAndSortMedia(gallery));
    } catch (error) {
      this.logger.error('Error fetching all galleries:', error.stack);
      throw new InternalServerErrorException('Failed to fetch galleries');
    }
  }


  async addImageToGallery(
    userId: string,
    imageUrl: string,
    filename?: string,
    generatedPrompt?: string, // ✅ Optional prompt parameter
    source?: string, // ✅ NEW - Optional source parameter
  ): Promise<Gallery> {
    try {
      const newImage = {
        url: imageUrl,
        createdAt: new Date(),
        filename: filename || this.extractFilename(imageUrl),
        isDeleted: false,
        generatedPrompt, // ✅ Include prompt (undefined if not provided)
        source, // ✅ Include source (undefined if not provided)
      };


      const gallery = await this.galleryModel.findOneAndUpdate(
        { userId },
        { $push: { imageUrls: newImage } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );


      this.logger.log(
        `Image added to gallery for user: ${userId}${generatedPrompt ? ' with prompt' : ''}${source ? ` from source: ${source}` : ''}`
      );
      return gallery;
    } catch (error) {
      this.logger.error(`Error adding image for user ${userId}:`, error.stack);
      throw new InternalServerErrorException('Failed to add image');
    }
  }


  async addVideoToGallery(
    userId: string,
    videoUrl: string,
    filename?: string,
    imageURL?: string, // ✅ Optional thumbnail parameter
    generatedPrompt?: string, // ✅ Optional prompt parameter
    source?: string, // ✅ NEW - Optional source parameter
  ): Promise<Gallery> {
    try {
      const newVideo = {
        url: videoUrl,
        createdAt: new Date(),
        filename: filename || this.extractFilename(videoUrl),
        isDeleted: false,
        imageURL, // ✅ Include thumbnail (undefined if not provided)
        generatedPrompt, // ✅ Include prompt (undefined if not provided)
        source, // ✅ Include source (undefined if not provided)
      };


      const gallery = await this.galleryModel.findOneAndUpdate(
        { userId },
        { $push: { videoUrls: newVideo } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );


      this.logger.log(
        `Video added to gallery for user: ${userId}${imageURL ? ' with thumbnail' : ''}${generatedPrompt ? ' with prompt' : ''}${source ? ` from source: ${source}` : ''}`
      );
      return gallery;
    } catch (error) {
      this.logger.error(`Error adding video for user ${userId}:`, error.stack);
      throw new InternalServerErrorException('Failed to add video');
    }
  }


  async create(data: Partial<Gallery>): Promise<Gallery> {
    try {
      if (!data.userId) {
        throw new BadRequestException('userId is required');
      }


      const existingGallery = await this.galleryModel.findOne({
        userId: data.userId,
      });


      if (existingGallery) {
        this.logger.warn(`Gallery already exists for user: ${data.userId}`);
        return existingGallery;
      }


      const newGallery = new this.galleryModel({
        ...data,
        imageUrls: data.imageUrls || [],
        videoUrls: data.videoUrls || [],
      });


      const savedGallery = await newGallery.save();
      this.logger.log(`Gallery created for user: ${data.userId}`);
      return savedGallery;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating gallery:', error.stack);
      throw new InternalServerErrorException('Failed to create gallery');
    }
  }


  async deleteMediaFromGallery(
    type: string,
    galleryId: string,
    fileId: string,
    userId: string,
  ): Promise<void> {
    try {
      const gallery = await this.galleryModel.findOne({
        _id: galleryId,
        userId: userId,
      });


      if (!gallery) {
        throw new NotFoundException('Gallery not found');
      }


      const field = type === 'image' ? 'imageUrls' : 'videoUrls';


      const result = await this.galleryModel.updateOne(
        {
          _id: galleryId,
          userId: userId,
          [`${field}._id`]: fileId,
        },
        {
          $set: { [`${field}.$.isDeleted`]: true },
        },
      );


      if (result.matchedCount === 0) {
        throw new NotFoundException(`${type} not found in gallery`);
      }


      if (result.modifiedCount > 0) {
        this.logger.log(`${type} ${fileId} soft-deleted for user: ${userId}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting ${type}:`, error.stack);
      throw new InternalServerErrorException(`Failed to delete ${type}`);
    }
  }


  async updateMediaFromGallery(
    type: string,
    galleryId: string,
    fileId: string,
    userId: string,
    file: any,
  ): Promise<any> {
    try {
      const gallery = await this.galleryModel.findOne({
        _id: galleryId,
        userId: userId,
      });


      if (!gallery) {
        throw new NotFoundException('Gallery not found');
      }


      if (!file?.name) {
        throw new BadRequestException('File name is required');
      }


      const field = type === 'image' ? 'imageUrls' : 'videoUrls';


      // ✅ Build update object dynamically
      const updateFields: any = {
        [`${field}.$.filename`]: file.name,
      };


      // ✅ Add prompt to update if provided
      if (file.generatedPrompt !== undefined) {
        updateFields[`${field}.$.generatedPrompt`] = file.generatedPrompt;
      }


      // ✅ NEW - Add source to update if provided
      if (file.source !== undefined) {
        updateFields[`${field}.$.source`] = file.source;
      }


      const result = await this.galleryModel.updateOne(
        {
          _id: galleryId,
          userId: userId,
          [`${field}._id`]: fileId,
        },
        {
          $set: updateFields,
        },
      );


      if (result.matchedCount === 0) {
        throw new NotFoundException(`${type} not found in gallery`);
      }


      this.logger.log(`${type} ${fileId} updated for user: ${userId}`);


      return {
        isSuccess: true,
        message: 'Media Updated Successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }


      this.logger.error(`Gallery Update Error:`, error.stack);
      return {
        isSuccess: false,
        message: 'Failed to Update Media',
      };
    }
  }


  private extractFilename(url: string): string {
    try {
      return url.split('/').pop()?.split('?')[0] || 'unknown';
    } catch {
      return 'unknown';
    }
  }


  private filterAndSortMedia(gallery: any): any {
    const filteredImages = (gallery.imageUrls || []).filter(
      (img) => !img?.isDeleted,
    );
    const filteredVideos = (gallery.videoUrls || []).filter(
      (video) => !video?.isDeleted,
    );


    return {
      ...gallery,
      imageUrls: filteredImages.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      videoUrls: filteredVideos.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }
}
