import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Brand extends Document {
  @Prop()
  brandName: string;
  @Prop()
  industry: string;
  @Prop()
  description: string;
  @Prop()
  slogan: string;
  @Prop()
  products: Array<{
    productName: string;
    productImage: string;
  }>;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
