import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'brandproducts', timestamps: true })
export class BrandProductEntity extends Document {
  @Prop({ type: Types.ObjectId, ref: 'BrandEntity', required: true })
  brandId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  productName: string;

  @Prop()
  description: string;

  @Prop()
  productImageGcsPath: string;

  @Prop()
  productImage: string;
}

export const BrandProductEntitySchema = SchemaFactory.createForClass(BrandProductEntity);
