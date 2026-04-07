import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UgcVideoDocument = UgcVideo & Document;

@Schema({ timestamps: true })
export class UgcVideo {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  videoUrl: string;       // /video/test-download?filename=...

  @Prop()
  gcsPath: string;        // output/xxx/sample_0.mp4

  @Prop()
  thumbnailUrl: string;

  @Prop()
  brandName: string;

  @Prop()
  script: string;         // the script used

  @Prop()
  avatarId: string;       // e.g. veo_sarah

  @Prop()
  avatarName: string;     // e.g. Sarah

  @Prop({ default: 'veo' })
  mode: string;           // 'veo' | 'heygen'

  @Prop()
  aspectRatio: string;    // 9:16 | 16:9 | 1:1

  @Prop()
  duration: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  referenceImages: string[];
}

export const UgcVideoSchema = SchemaFactory.createForClass(UgcVideo);
UgcVideoSchema.index({ userId: 1, createdAt: -1 });
