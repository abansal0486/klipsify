// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
// import { Plan, PlanDocument } from '../plans/schemas/plan.schema';
import { Transaction, TransactionDocument } from '../payment/schemas/transaction.schema';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 12;
  private readonly TOKEN_BUFFER_MS = 15 * 60 * 1000; // 15min

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {}

  // ==================== FIND METHODS ====================

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findByResetToken(token: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOne({ resetPasswordToken: token })
      .select('+password')
      .exec();

    if (!user?.resetPasswordExpires) return null;

    const isValid = user.resetPasswordExpires.getTime() > Date.now() - this.TOKEN_BUFFER_MS;
    return isValid ? user : null;
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ emailVerificationToken: token }).exec();
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return plainToInstance(UserResponseDto, user.toObject(), {
    excludeExtraneousValues: true,
  });
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .populate('currentPlan')
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ==================== CREATE & UPDATE ====================

  async createUser(data: Partial<User>): Promise<any> {
    if (!data.email) throw new BadRequestException('Email is required');

    const existing = await this.findByEmail(data.email);
    if (existing) throw new BadRequestException('Email already exists');

    const user = await this.userModel.create({
      ...data,
      // currentPlanName: data.currentPlanName || 'free',
      subscriptionActive: true,
      monthlyUsage: {
        videos: 0,
        images: 0,
        resetDate: new Date(),
      },
      // currentLimits: {
      //   videoLimit: data.currentLimits?.videoLimit || 4,
      //   imageLimit: data.currentLimits?.imageLimit || 4,
      //   accountLimit: data.currentLimits?.accountLimit || 1,
      // },
    });

    return {
      isSuccess: true,
      data: user,
      message: 'User created successfully',
    };
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<any> {
    const { role, currentPlan, password, ...allowed } = updateData as any;

    const filtered = Object.fromEntries(
      Object.entries(allowed).filter(([_, v]) => v != null)
    );

    if (Object.keys(filtered).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: filtered }, { new: true, runValidators: true })
      .select('-password')
      .exec();

    if (!user) throw new NotFoundException('User not found');

    return {
      isSuccess: true,
      data: user,
      message: 'Profile updated successfully',
    };
  }

  async deleteUser(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('User not found');
  }

  // ==================== PASSWORD ====================

  async changePassword(userId: string, { newPassword, currentPassword }: any): Promise<any> {
    const user = await this.userModel.findById(userId).select('+password').exec();
    if (!user) throw new NotFoundException('User not found');

    // Verify current password for non-OAuth users
    if (user.password && currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await user.save();

    return {
      isSuccess: true,
      message: 'Password updated successfully',
    };
  }

  // ==================== PLAN & USAGE ====================

  // async getUserPlanUsage(userId: string) {
  //   const user = await this.userModel.findById(userId).populate('currentPlan').exec();
  //   if (!user) throw new NotFoundException('User not found');

  //   const resetDate = new Date(user.monthlyUsage.resetDate);
  //   const nextResetDate = new Date(resetDate);
  //   nextResetDate.setDate(resetDate.getDate() + 30);

  //   return {
  //     planName: user.currentPlanName,
  //     planType: user.currentPlan ? (user.currentPlan as any).planType : 'free',
  //     videoLimit: user.currentLimits.videoLimit,
  //     videoUsed: user.monthlyUsage.videos,
  //     videoRemaining: Math.max(0, user.currentLimits.videoLimit - user.monthlyUsage.videos),
  //     imageLimit: user.currentLimits.imageLimit,
  //     imageUsed: user.monthlyUsage.images,
  //     imageRemaining: Math.max(0, user.currentLimits.imageLimit - user.monthlyUsage.images),
  //     currentResetDate: resetDate,
  //     nextResetDate,
  //     planStartDate: user.planStartDate,
  //     planEndDate: user.planEndDate,
  //     subscriptionActive: user.subscriptionActive,
  //   };
  // }

  async getUserCurrentLimits(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('monthlyUsage currentLimits currentPlan currentPlanName subscriptionActive')
      .exec();

    if (!user) throw new NotFoundException('User not found');

    return {
      isSuccess: true,
      data: user,
      message: 'Current limits retrieved successfully',
    };
  }

  // async assignFreePlan(userId: string): Promise<UserDocument> {
  //   const freePlan = await this.planModel.findOne({ planType: 'free' }).exec();
  //   if (!freePlan) throw new NotFoundException('Free plan not found');

  //   const user = await this.userModel
  //     .findByIdAndUpdate(
  //       userId,
  //       {
  //         currentPlan: freePlan._id,
  //         currentPlanName: freePlan.name,
  //         planStartDate: new Date(),
  //         planEndDate: null,
  //         subscriptionActive: true,
  //         currentLimits: {
  //           videoLimit: freePlan.videoLimit,
  //           imageLimit: freePlan.imageLimit,
  //           accountLimit: freePlan.accountLimit,
  //         },
  //         monthlyUsage: {
  //           videos: 0,
  //           images: 0,
  //           resetDate: new Date(),
  //         },
  //       },
  //       { new: true }
  //     )
  //     .exec();

  //   if (!user) throw new NotFoundException('User not found');
  //   return user;
  // }

  
async resetPasswordDirect(userId: string, hashedPassword: string): Promise<void> {
  await this.userModel
    .findByIdAndUpdate(userId, {
      $set: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    })
    .exec();
}


  // async canCreateContent(userId: string, contentType: 'video' | 'image'): Promise<boolean> {
  //   const user = await this.userModel.findById(userId).exec();
  //   if (!user?.subscriptionActive) return false;

  //   // Auto-reset if 30 days passed
  //   const daysSinceReset = Math.floor(
  //     (Date.now() - new Date(user.monthlyUsage.resetDate).getTime()) / (1000 * 60 * 60 * 24)
  //   );

  //   if (daysSinceReset >= 30) {
  //     await this.resetMonthlyUsage(userId);
  //     return true;
  //   }

  //   const usedKey = contentType === 'video' ? 'videos' : 'images';
  //   const limitKey = contentType === 'video' ? 'videoLimit' : 'imageLimit';

  //   return user.monthlyUsage[usedKey] < user.currentLimits[limitKey];
  // }

  async incrementUsage(userId: string, contentType: 'video' | 'image'): Promise<UserDocument> {
    const field = `monthlyUsage.${contentType === 'video' ? 'videos' : 'images'}`;
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $inc: { [field]: 1 } }, { new: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async resetMonthlyUsage(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: {
          'monthlyUsage.videos': 0,
          'monthlyUsage.images': 0,
          'monthlyUsage.resetDate': new Date(),
        },
      })
      .exec();
  }

  // ==================== TRANSACTIONS ====================

  async getTransactions(): Promise<Transaction[]> {
    return this.transactionModel.aggregate([
      {
        $addFields: { userIdObj: { $toObjectId: '$userId' } },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdObj',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          user: { _id: 1, name: 1, email: 1, role: 1 },
          amount: 1,
          currency: 1,
          planName: 1,
          status: 1,
          transactionId: 1,
          createdAt: 1,
          updatedAt: 1,
          expireAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return this.transactionModel.aggregate([
      { $match: { userId } },
      { $addFields: { userIdObj: { $toObjectId: '$userId' } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdObj',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: 1,
          user: { _id: 1, name: 1, email: 1, role: 1 },
          amount: 1,
          currency: 1,
          planName: 1,
          status: 1,
          transactionId: 1,
          createdAt: 1,
          updatedAt: 1,
          expireAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }
}
