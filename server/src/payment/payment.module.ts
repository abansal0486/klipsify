// src/payment/payment.module.ts - UPDATED
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import { WebhookController } from './webhook.controller';
import { PaypalService } from './paypal.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
// import { Plan, PlanSchema } from '../plans/schemas/plan.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema'; // ✅ ADD THIS

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      // { name: Plan.name, schema: PlanSchema },
      { name: Transaction.name, schema: TransactionSchema }, // ✅ ADD THIS
      { name: WebhookEvent.name, schema: WebhookEventSchema } // ✅ ADD THIS
    ])
  ],
  controllers: [
    PaymentController,
    WebhookController
  ],
  providers: [PaypalService],
  exports: [PaypalService]
})
export class PaymentModule {}
