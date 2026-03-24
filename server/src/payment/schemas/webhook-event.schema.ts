// src/payment/schemas/webhook-event.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type WebhookEventDocument = WebhookEvent & Document;

@Schema({ timestamps: true })
export class WebhookEvent {
  @Prop({ required: true })
  eventType: string; // BILLING.SUBSCRIPTION.ACTIVATED, PAYMENT.COMPLETED, etc.

  @Prop({ required: true })
  eventId: string; // PayPal's unique event ID

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string; // Reference to User

  @Prop({ type: String, default: null })
  subscriptionId?: string; // PayPal subscription ID

  @Prop({ type: String, default: null })
  planName?: string; // Plan name (Gladiator, Samurai, etc.)

  @Prop({ type: Number, default: null })
  amount?: number; // Payment amount in cents

  @Prop({ type: String, default: null })
  currency?: string; // USD, EUR, etc.

  @Prop({ type: String, default: null })
  status?: string; // ACTIVE, CANCELLED, SUSPENDED, etc.

  @Prop({ type: String, default: null })
  payerId?: string; // PayPal payer ID

  @Prop({ type: Object, required: true })
  rawData: Record<string, any>; // Full webhook payload

  @Prop({ type: Boolean, default: false })
  processed: boolean; // Whether this event was successfully processed

  @Prop({ type: String, default: null })
  errorMessage?: string; // If processing failed, store error

  @Prop({ type: Date, default: Date.now })
  receivedAt: Date; // When webhook was received
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// Index for faster queries
WebhookEventSchema.index({ userId: 1, eventType: 1, receivedAt: -1 });
WebhookEventSchema.index({ subscriptionId: 1 });
WebhookEventSchema.index({ eventId: 1 }, { unique: true }); // Prevent duplicate events
