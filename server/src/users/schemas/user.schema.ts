// src/users/schemas/user.schema.ts - UPDATED
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  password?: string;

  @Prop()
  name: string;

  @Prop()
  googleId?: string;

  @Prop({ required: false })
  phone: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: String, default: null, required: false })
  emailVerificationToken?: string | null;

  @Prop({ type: String, default: null, required: false })
  resetPasswordToken?: string | null;

 @Prop({ type: Date, default: null, required: false })
  resetPasswordExpires?: Date | null;

  @Prop({ default: 'user', enum: ['user', 'admin'] })
  role: 'user' | 'admin';

  // ✅ REPLACE OLD SUBSCRIPTION FIELDS WITH THESE:
  // @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Plan', default: null })
  // currentPlan: string;

  // @Prop({ type: String, default: 'free' })
  // currentPlanName: string;

  // @Prop({ type: Date, default: Date.now })
  // planStartDate: Date;

  // @Prop({ type: Date, default: null })
  // planEndDate?: Date;

  // @Prop({ default: true })
  // subscriptionActive: boolean;

  // // ✅ STRIPE INTEGRATION
  // @Prop({ type: String, default: null })
  // paypalSubscriptionId?: string;

  // @Prop({ type: String, default: null })
  // paypalCustomerId?: string; // PayPal Payer ID

  // ✅ MONTHLY USAGE TRACKING
  // @Prop({
  //   type: {
  //     videos: { type: Number, default: 0 },
  //     images: { type: Number, default: 0 },
  //     resetDate: { type: Date, default: Date.now }
  //   },
  //   default: () => ({
  //     videos: 0,
  //     images: 0,
  //     resetDate: new Date()
  //   })
  // })
  // monthlyUsage: {
  //   videos: number;
  //   images: number;
  //   resetDate: Date;
  // };

  // ✅ CURRENT LIMITS (Base + Carryover)
  // @Prop({
  //   type: {
  //     videoLimit: { type: Number, default: 4 },
  //     imageLimit: { type: Number, default: 4 },
  //     accountLimit: { type: Number, default: 1 }
  //   },
  //   default: () => ({
  //     videoLimit: 4,
  //     imageLimit: 4,
  //     accountLimit: 1
  //   })
  // })
  // currentLimits: {
  //   videoLimit: number;
  //   imageLimit: number;
  //   accountLimit: number;
  // };

  // Keep your existing fields
  // @Prop({ default: null })
  // dob?: string;

  @Prop({ default: null })
  country?: string;

  // @Prop({ default: null })
  // city?: string;

  // @Prop({ default: null })
  // postalCode?: string;

  // @Prop()
  // profileImage?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
