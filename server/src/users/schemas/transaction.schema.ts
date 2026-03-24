// src/transactions/schemas/transaction.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ required: true })
  planName: string;

  @Prop({
    required: true,
    enum: ['active','completed', 'pending', 'failed','canceled'],
    default: 'pending',
  })
  status: 'active' | 'completed' | 'pending' | 'failed' | 'canceled';

  @Prop({ required: true, unique: true })
  transactionId: string;

  @Prop()
  expireAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);