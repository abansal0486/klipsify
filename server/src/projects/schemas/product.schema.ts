import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
    @Prop({ required: true })
    productName: string;

    @Prop()
    productImage: string;

    
}

export const ProductSchema = SchemaFactory.createForClass(Product);
