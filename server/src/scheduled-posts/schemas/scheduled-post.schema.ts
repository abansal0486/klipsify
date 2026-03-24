// src/scheduled-posts/schemas/scheduled-post.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

@Schema({ timestamps: true })
export class ScheduledPost extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true })
  content: string;

  @Prop()
  mediaUrl?: string;

  @Prop({ required: true })
  platform: string; // e.g., facebook, twitter

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ default: 'pending' })
  status: 'pending' | 'posted' | 'failed';
}

export const ScheduledPostSchema = SchemaFactory.createForClass(ScheduledPost);
