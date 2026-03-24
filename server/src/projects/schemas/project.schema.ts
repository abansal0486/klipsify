import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Project extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Basic Info
  @Prop({ required: false })
  projectName: string;

  @Prop({ required: false })
  brandName: string;


  @Prop()
  niche: string;


  // new code by aman on 18 march
  @Prop()
  industry: string;

  @Prop()
  audience: string;


  // new code by aman on 18 march
  @Prop()
  description: string;

  @Prop()
  targetAudience: string;

  @Prop()
  slogan: string;


  //old code commented by aman on 18 march
  // @Prop()
  // products: string;

  // new code by aman on 18 march
  @Prop()
  products: Array<{
    productName: string;
    productImage: string;
  }>;

  @Prop()
  domain: string;

  @Prop()
  style: string;

  // Logo
  @Prop()
  logoGcsPath: string;

  @Prop()
  logoUrl: string;

  @Prop()
  logoViewUrl: string;

  // Media Files - SINGLE SOURCE OF TRUTH
  @Prop({ type: [Object], default: [] })
  mediaFiles: Array<{
    gcsPath: string;
    downloadUrl: string;
    viewUrl: string;
    filename: string;
    type: 'image' | 'video';
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }>;
  // Add this field to your schema
  @Prop({ type: Array, default: [] })
  aiConversationLog: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;

  // Planning
  @Prop({ type: Boolean, default: false })
  wantsWeeklyPlan: boolean;

  @Prop({ type: Number, default: 0 })
  videosPerWeek: number;

  @Prop({ type: Number, default: 0 })
  imagesPerWeek: number;

  // ✅ ADD THIS: Weekly Content Calendar
  @Prop({ type: String, default: null })
  weeklyContentCalendar: string;

  // Conversation
  @Prop({ type: Array, default: [] })
  conversationLog: any[];

  // Status
  @Prop({ enum: ['active', 'archived', 'deleted'], default: 'active' })
  status: string;

  @Prop({ type: Date, default: Date.now })
  lastActivityAt: Date;

  // ✅ VIRTUAL GETTERS - Compute on demand, don't store
  get imageUrls(): string[] {
    return this.mediaFiles
      ?.filter(f => f.type === 'image')
      .map(f => f.viewUrl) || [];
  }

  get videoUrls(): string[] {
    return this.mediaFiles
      ?.filter(f => f.type === 'video')
      .map(f => f.viewUrl) || [];
  }

  get brandInfo() {
    return {
      about: this.products || '',
      brand_name: this.brandName,
      tagline: this.slogan,
      audience: this.audience,
      slogan: this.slogan,
      style: this.style,
      logo_url: this.logoViewUrl || '',
      image_urls: this.imageUrls,
      video_urls: this.videoUrls,
      language: 'en',
    };
  }
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// ✅ Enable virtuals in JSON/Object output
ProjectSchema.set('toJSON', { virtuals: true });
ProjectSchema.set('toObject', { virtuals: true });
