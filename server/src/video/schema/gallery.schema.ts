import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';


export type GalleryDocument = Gallery & Document;


// Define interface for media items
interface MediaItem {
  _id?: string;
  url: string;
  createdAt: Date;
  filename?: string;
  isDeleted?: boolean;
  imageId?: string;
  imageURL?: string;
  generatedPrompt?: string;
  source?: string; // ✅ ADD THIS LINE
}


@Schema({ timestamps: true })
export class Gallery {
  @Prop({ required: true })
  userId: string;


  // ✅ CHANGED: Store objects with timestamps instead of strings
  @Prop({
    type: [{
      url: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      filename: { type: String },
      isDeleted: { type: Boolean, default: false },
      generatedPrompt: { type: String },
      source: { type: String } // ✅ ADD THIS LINE
    }],
    default: []
  })
  imageUrls: MediaItem[];


  @Prop({
    type: [{
      url: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      filename: { type: String },
      isDeleted: { type: Boolean, default: false },
      imageId: { type: String },
      imageURL: { type: String },
      generatedPrompt: { type: String },
      source: { type: String } // ✅ ADD THIS LINE
    }],
    default: []
  })
  videoUrls: MediaItem[];
}


export const GallerySchema = SchemaFactory.createForClass(Gallery);
