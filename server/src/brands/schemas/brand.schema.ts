import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'brands', timestamps: true })
export class BrandEntity extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  brandName: string;

  @Prop()
  industry: string;

  @Prop()
  description: string;

  @Prop()
  slogan: string;

  @Prop()
  logoGcsPath: string;

  @Prop()
  logoUrl: string;

  @Prop()
  logoViewUrl: string;
}

export const BrandEntitySchema = SchemaFactory.createForClass(BrandEntity);
