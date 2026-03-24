import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  @Prop({ type: String, required: true })
  planName: string;

  @Prop({
    type: String,
    enum: ['active', 'pending', 'canceled', 'completed', 'failed',
           'refunded', 'cancelled', 'suspended', 'expired'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: String, required: true, unique: true })
  transactionId: string;

  @Prop({ type: String, default: null })
  subscriptionId?: string;

  @Prop({ type: String, default: null })
  payerId?: string;

  @Prop({ type: String, default: 'stripe' })
  paymentMethod?: string;

  @Prop({ type: String, default: null })
  description?: string;

  @Prop({ type: Date, default: null })
  expireAt?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  metadata?: Record<string, any>;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ subscriptionId: 1 });
TransactionSchema.index({ transactionId: 1 }, { unique: true });
