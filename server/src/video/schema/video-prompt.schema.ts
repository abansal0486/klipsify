// src/video/schema/video-prompt.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoPromptDocument = VideoPrompt & Document;

// ✅ CREATE SEPARATE SCHEMA FOR NESTED OBJECT
@Schema({ _id: false }) // _id: false prevents creating _id for nested objects
export class ProcessingStats {
  @Prop()
  attachedImages: number;

  @Prop()
  hasLogo: boolean;

  @Prop()
  hasGeneratedImage: boolean;

  @Prop()
  processingTimeMs: number;
}

// ✅ CREATE SEPARATE SCHEMA FOR B-ROLL SUGGESTIONS
@Schema({ _id: false })
export class BrollSuggestion {
  @Prop()
  timeframe: string;

  @Prop()
  description: string;
}

@Schema({ timestamps: true })
export class VideoPrompt {
  @Prop({ required: true })
  userId: string;

  // Input Data
  @Prop({ required: true })
  brandName: string;

  @Prop()
  products: string;

  @Prop()
  audience: string;

  @Prop()
  style: string;

  @Prop({ required: true })
  domain: string;

  @Prop({ default: 'English' })
  language: string;

  @Prop()
  slogan: string;

  @Prop()
  logoUrl: string;

  @Prop([String])
  imageUrls: string[];

  // Generated Content
  @Prop({ required: true })
  script: string;

  @Prop({ type: [BrollSuggestion] }) // ✅ FIXED: Use the BrollSuggestion schema
  brollSuggestions: BrollSuggestion[];

  @Prop({ required: true })
  imagePrompt: string;

  @Prop({ type: String, default: null })
  dalleImageUrl: string | null;

  @Prop({ type: String, default: null })
  gcsImagePath: string | null;

  @Prop({ type: String, default: null })
  imageDownloadUrl: string | null;

  // ✅ FIXED: Use the ProcessingStats schema
  @Prop({ type: ProcessingStats })
  processingStats: ProcessingStats;

  @Prop({ enum: ['processing', 'completed', 'failed'], default: 'processing' })
  status: string;

  @Prop()
  error: string;
}

export const VideoPromptSchema = SchemaFactory.createForClass(VideoPrompt);
