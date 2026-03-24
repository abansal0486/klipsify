// src/scheduled-posts/scheduled-posts.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScheduledPost } from './schemas/scheduled-post.schema';
import { CreateScheduledPostDto } from './dto/create-scheduled-post.dto';

@Injectable()
export class ScheduledPostsService {
  constructor(
    @InjectModel(ScheduledPost.name) private postModel: Model<ScheduledPost>,
  ) {}

  async create(userId: string, dto: CreateScheduledPostDto) {
    const post = new this.postModel({
      ...dto,
      user: userId,
      scheduledAt: new Date(dto.scheduledAt),
      status: 'pending',
    });
    return post.save();
  }

  async findPendingPosts() {
    return this.postModel.find({
      status: 'pending',
      scheduledAt: { $lte: new Date() },
    });
  }

  async markAsPosted(postId: string | Types.ObjectId) {
    return this.postModel.findByIdAndUpdate(postId, { status: 'posted' });
  }

  async markAsFailed(postId: string | Types.ObjectId) {
    return this.postModel.findByIdAndUpdate(postId, { status: 'failed' });
  }
}
