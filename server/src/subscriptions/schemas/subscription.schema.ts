// src/subscriptions/schemas/subscription.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
// import { Plan } from '../../plans/schemas/plan.schema';

export type SubscriptionDocument = Subscription & Document; // ✅ ADD THIS LINE

@Schema({ timestamps: true })
export class Subscription extends Document { // ✅ CHANGE: extend Document
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  // @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
  // plan: Types.ObjectId;

  // @Prop({ default: 0 })
  // credits: number;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, default: 'free' })
  planName: string;

  // ✅ STRIPE INTEGRATION
  @Prop({ type: String, default: null })
  subscriptionId?: string;

  // ✅ USAGE TRACKING
  @Prop({
    type: {
      videos: { type: Number, default: 0 },
      images: { type: Number, default: 0 },
      resetDate: { type: Date, default: Date.now }
    },
    default: () => ({
      videos: 0,
      images: 0,
      resetDate: new Date()
    })
  })
  monthlyUsage: {
    videos: number;
    images: number;
    resetDate: Date;
  };

  //✅ CURRENT LIMITS (Base + Carryover)
  @Prop({
    type: {
      videoLimit: { type: Number, default: 4 },
      imageLimit: { type: Number, default: 4 },
      accountLimit: { type: Number, default: 1 }
    },
    default: () => ({
      videoLimit: 4,
      imageLimit: 4,
      accountLimit: 1
    })
  })
  currentLimits: {
    videoLimit: number;
    imageLimit: number;
    accountLimit: number;
  };

  // @Prop({ default: Date.now })
  // renewDate: Date;

  // @Prop({ default: 'registration' })
  // source: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
