import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

class MediaItem {
  // stored path or main file url
  @Prop({ type: String, required: true })
  url: string;

  // full URL used for inline viewing (optional if same as url)
  @Prop({ type: String })
  viewUrl?: string;

  // full URL used for download (optional if same as url)
  @Prop({ type: String })
  downloadUrl?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema({ timestamps: true, collection: 'project_galleries' })
export class ProjectGallery {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ type: [MediaItem], default: [] })
  storyboardUrls: MediaItem[];

  @Prop({ type: [MediaItem], default: [] })
  imageUrls: MediaItem[];

  @Prop({ type: [MediaItem], default: [] })
  videoUrls: MediaItem[];
}

export type ProjectGalleryDocument = ProjectGallery & Document;
export const ProjectGallerySchema = SchemaFactory.createForClass(ProjectGallery);
