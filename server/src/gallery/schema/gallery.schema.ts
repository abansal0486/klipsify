import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';


export type GalleryDocument = Gallery & Document;


// ✅ MediaItem interface with project support
interface MediaItem {
  _id?: string;
  url: string;
  filename: string;
  gcsPath: string;        // ✅ FULL GCS path
  createdAt: Date;
  isDeleted?: boolean;
  imageId?: string;
  imageURL?: string;
  storyboard?: string;    // ✅ For generated content
  usedLogo?: boolean;
  usedSlogan?: boolean;
  status?: 'completed' | 'pending';
  operationName?: string; // ✅ For video generation
  source?: string;        // ✅ NEW: Source of media (generated, uploaded, imported)
}


@Schema({ timestamps: true })
export class Gallery {
  @Prop({ required: true })
  userId: string;


  @Prop({ required: true })
  projectId: string;     // ✅ NEW: Link to specific project


  @Prop({ required: true })
  projectName: string;   // ✅ NEW: Project name for display


  // ✅ Images array for this project
  @Prop({
    type: [{
      url: { type: String, required: true },
      filename: { type: String, required: true },
      gcsPath: { type: String, required: true },  // ✅ Full GCS path
      createdAt: { type: Date, default: Date.now },
      isDeleted: { type: Boolean, default: false },
      storyboard: { type: String },
      usedLogo: { type: Boolean },
      usedSlogan: { type: Boolean },
      source: { type: String },  // ✅ NEW: Source tracking
    }],
    default: []
  })
  imageUrls: MediaItem[];


  // ✅ Videos array for this project
  @Prop({
    type: [{
      url: { type: String, required: true },
      filename: { type: String, required: true },
      gcsPath: { type: String, required: true },  // ✅ Full GCS path
      createdAt: { type: Date, default: Date.now },
      isDeleted: { type: Boolean, default: false },
      imageId: { type: String },
      imageURL: { type: String },
      storyboard: { type: String },
      usedLogo: { type: Boolean },
      usedSlogan: { type: Boolean },
      status: { type: String, enum: ['completed', 'pending'], default: 'pending' },
      operationName: { type: String },
      source: { type: String },  // ✅ NEW: Source tracking
    }],
    default: []
  })
  videoUrls: MediaItem[];


  @Prop({ default: 'active' })
  status: 'active' | 'archived';
}


export const GallerySchema = SchemaFactory.createForClass(Gallery);


// ✅ Indexes for fast queries
GallerySchema.index({ userId: 1, projectId: 1 });
GallerySchema.index({ userId: 1, 'imageUrls.createdAt': -1 });
GallerySchema.index({ userId: 1, 'videoUrls.createdAt': -1 });
