import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription } from './schemas/subscription.schema';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { User } from '../users/schemas/user.schema';
@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) { }

  // 1. Create a subscription

  async createSubscription(dto: CreateSubscriptionDto) {
  const { userId } = dto;

  return this.subscriptionModel.create({
    userId,
    planName: 'free',
    startDate: new Date(),
    isActive: true,
    currentLimits: {
      videoLimit: 4,
      imageLimit: 4,
      accountLimit: 1,
    },
    monthlyUsage: {
      videos: 0,
      images: 0,
      resetDate: new Date(),
    },
  });
}
//   async create(createDto: CreateSubscriptionDto): Promise<Subscription> {
//   const { userId } = createDto;

//   const existing = await this.subscriptionModel.findOne({
//     user: userId,
//     isActive: true,
//   });
//   if (existing) {
//     throw new BadRequestException('User already has an active subscription');
//   }

//   // ✅ Get plan details
//   const plan = await this.subscriptionModel.db.model('Plan').findById(planId);
//   if (!plan) throw new NotFoundException('Plan not found');

//   // 💳 Assign initial credits based on plan
//   const created = new this.subscriptionModel({
//     user: userId,
//     plan: planId,
//     credits: plan.videoLimit + plan.imageLimit, // or a dedicated plan.credits field
//     startDate: new Date(),
//     renewDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // next month
//     isActive: true,
//   });

//   const savedSub = await created.save();

//   // ✅ Update user's subscription info
//   await this.userModel.findByIdAndUpdate(userId, {
//     $set: {
//       subscriptionPlanName: plan.name,
//       subscriptionActive: true,
//     },
//   });

//   return savedSub;
// }



  // 2. Get active subscription for a user
  async findByUser(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findOne({ user: userId, isActive: true })
      .populate('plan');

    if (!subscription) throw new NotFoundException('No active subscription found');

    return subscription;
  }

  // 3. Cancel all active subscriptions for a user
  async cancel(userId: string): Promise<void> {
  await this.subscriptionModel.updateMany(
    { user: userId, isActive: true },
    { $set: { isActive: false } },
  );

  await this.userModel.findByIdAndUpdate(userId, {
    $set: {
      subscriptionPlanName: null,
      subscriptionActive: false,
    },
  });
}


  // 4. Get all subscriptions (admin only)
  async findAll(): Promise<Subscription[]> {
    return await this.subscriptionModel.find().populate('user').populate('plan');
  }
}
