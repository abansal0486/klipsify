// src/payment/payment.controller.ts - COMPLETE FIXED VERSION
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  Res,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaypalService } from './paypal.service';
// import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
// import { RecreatePlanDto } from './dto/recreate-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InjectModel, InjectModel as MongoInjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PLANS, getPlanById } from './constants/plans.constants';
// import { Plan, PlanDocument } from '../plans/schemas/plan.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../subscriptions/schemas/subscription.schema';
@ApiTags('PayPal Integration')
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paypalService: PaypalService,
    // @MongoInjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) { }

  // Create stripe subscription
  @ApiOperation({ summary: 'Create Stripe Subscription' })
  @Post('create-intent')
  async createPaymentIntent(
    @Req() req: any,
    @Body() body: { email: string; priceId: string; paymentMethodId: string, metadata?: Record<string, any> }
  ) {
    console.log('Creating payment intent for:', body.email, 'Price ID:', body.priceId);
    return this.paypalService.createSubscriptionAuto(
      body.email,
      body.priceId,
      body.paymentMethodId,
      body.metadata
    );
  }

  // create payment checkout (by aman on 18 march)@Post('create-checkout-session')
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body()
    body: {
      priceId: string;
      email: string;
      userId?: string;
    }
  ) {
    return this.paypalService.createCheckoutSession(body);
  }



  // stripe webhook
  @Post('stripe/webhook')
  @ApiOperation({ summary: '🧪 Test Webhook Event Save' })
  async handleWebhook(@Req() req: any, @Res() res: any) {
    try {
      console.log(
        'Stripe webhook body is Buffer:', typeof (req.body),
        Buffer.isBuffer(req.body), // ✅ TRUEre
      );
      console.log("---------working");
      await this.paypalService.verifyAndProcess(req);
      return res.json({ received: true });
    } catch (err: any) {
      return res
        .status(err.status || HttpStatus.INTERNAL_SERVER_ERROR)
        .send(err.message || 'Webhook failed');
    }
  }

  // get Plan Details 
  @Get('plans/details')
  @ApiOperation({ summary: '📋 Get All Active Plans with Full Details (Cached)' })
  async getAllPlansWithDetails() {
    return await this.paypalService.getAllPlansWithDetailsCached();
  }

  // ✅ UPDATED: subscribeDirect with duplicate prevention
  @Post('subscribe-direct')
  @ApiOperation({ summary: '🚀 Create Subscription with PayPal Plan ID' })
  async subscribeDirect(@Body() dto: {
    userId: string;
    paypalPlanId: string;
    planName: string;
    planType: string; // ✅ NEW: SAME/UPGRADE/DOWNGRADE/NEW
    planData: {
      name: string;
      displayName: string;
      price: number;
      videoLimit: number;
      imageLimit: number;
      accountLimit: number;
    }
  }) {
    try {
      console.log('🚀 Creating direct PayPal subscription:', dto);

      // ✅ NEW: Check if upgrading/downgrading and cancel old subscription
      if (dto.planType !== 'SAME' && dto.planType !== 'NEW') {
        console.log(`🔄 User is ${dto.planType}ing - checking for old subscription...`);

        const user = await this.subscriptionModel.findOne({ userId: dto.userId });

        if (user?.subscriptionId && user?.isActive) {
          console.log(`❌ Cancelling old subscription: ${user.subscriptionId}`);

          try {
            await this.paypalService.cancelStripeSubscription(
              user.subscriptionId
            );
            console.log(`✅ Old subscription cancelled successfully`);
          } catch (cancelError) {
            console.error(`⚠️ Failed to cancel old subscription:`, cancelError.message);
            // Continue anyway - new subscription will replace it
          }
        }
      }
    } catch (error) {
      console.error('❌ Direct subscription creation failed:', error);
      throw new HttpException({
        success: false,
        error: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }

  // ✅ Get user's billing transactions
  @UseGuards(JwtAuthGuard)
  @Get('transactions/me')
  @ApiOperation({ summary: '💳 Get My Billing Transactions' })
  async getMyTransactions(@Req() req: any, @Query('limit') limit?: string) {
    try {
      const userId = req.user._id;
      const transactions = await this.paypalService.getTransactionsByUser(
        userId,
        limit ? parseInt(limit) : 50
      );

      return {
        success: true,
        count: transactions.length,
        transactions: transactions,
        message: 'Transactions retrieved successfully'
      };
    } catch (error) {
      throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  // 🔹 By email
  @Get('subscriptions/by-email')
  getByEmail(@Query('email') email: string) {
    return this.paypalService.getSubscriptionsByCustomerEmail(email);
  }

  // ✅ EXISTING ENDPOINTS (Keep these)
  //  @Post('setup/create-product')
  // @ApiOperation({ summary: 'Step 1: Create PayPal Product' })
  // async createProduct() {
  //   try {
  //     const product = await this.paypalService.createProduct();
  //     return {
  //       success: true,
  //       productId: product.id,
  //       message: '✅ Product created! Use this productId for creating plans'
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }


  //  @Post('setup/create-plan')
  // @ApiOperation({ summary: 'Step 2: Create PayPal Plan' })
  // async createPaypalPlan(@Body() dto: CreatePlanDto) {
  //   try {
  //     const result = await this.paypalService.createPaypalPlan(dto.productId, dto.planId);
  //     return {
  //       success: true,
  //       paypalPlanId: result.paypalPlanId,    // ✅ FIXED
  //       planName: result.planName,             // ✅ FIXED
  //       price: result.price,                   // ✅ FIXED (already formatted as $XX)
  //       message: `✅ PayPal plan created for ${result.planName}` // ✅ FIXED
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }


  // @Post('subscribe')
  // @ApiOperation({ summary: 'Step 3: Create User Subscription' })
  // async subscribe(@Body() dto: CreateSubscriptionDto & { paypalPlanId: string }) { // ✅ Add paypalPlanId to DTO
  //   try {
  //     // ✅ Pass all 3 required parameters
  //     const result = await this.paypalService.createUserSubscription(
  //       dto.userId, 
  //       dto.planId, 
  //       dto.paypalPlanId
  //     );

  //     const approvalUrl = result.subscription.links.find(link => link.rel === 'approve');

  //     return {
  //       success: true,
  //       subscriptionId: result.subscription.id,
  //       approvalUrl: approvalUrl?.href,
  //       planName: result.plan.displayName,
  //       price: result.plan.displayPrice, // ✅ Use displayPrice from constants
  //       message: `🔗 Redirect user to approvalUrl to complete payment`
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }




  // ✅ NEW MANAGEMENT ENDPOINTS
  // ✅ NEW MANAGEMENT ENDPOINTS
  // @Get('products')
  // @ApiOperation({ summary: '📋 List All PayPal Products' })
  // async listPaypalProducts() {
  //   try {
  //     const products = await this.paypalService.listPaypalProducts();
  //     return {
  //       success: true,
  //       products: products,
  //       message: `Found ${products.length} PayPal products`
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Get('plans')
  // @ApiOperation({ summary: '📋 List All PayPal Plans' })
  // async listPaypalPlans() {
  //   try {
  //     return await this.paypalService.listPaypalPlans();
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message
  //     };
  //   }
  // }

  // @Get('status')
  // @ApiOperation({ summary: '📊 Check PayPal Integration Status' })
  // async getIntegrationStatus() {
  //   try {
  //     const status = await this.paypalService.getIntegrationStatus();
  //     return {
  //       success: true,
  //       ...status
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  //  @Get('plan/:planId')
  // @ApiOperation({ summary: '🔍 Get Specific PayPal Plan Details' })
  // async getPaypalPlan(@Param('planId') planId: string) {
  //   try {
  //     const plan = await this.paypalService.getPaypalPlan(planId);
  //     return {
  //       success: true,
  //       plan: plan,
  //       message: `PayPal plan details for ${planId}`
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Post('setup/recreate-plan')
  // @ApiOperation({ summary: '🔄 Recreate PayPal Plan with New Pricing' })
  // async recreatePaypalPlan(@Body() dto: RecreatePlanDto) {
  //   try {
  //     const result = await this.paypalService.recreatePaypalPlan(dto.productId, dto.planId);

  //     return {
  //       success: true,
  //       paypalPlanId: result.paypalPlanId,
  //       planName: result.planName,
  //       price: `$${result.price / 100}`,
  //       message: result.message
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Get('cancel')
  // @ApiOperation({ summary: '❌ Payment Cancel Handler' })
  // async paymentCancel(
  //   @Query('planId') planId: string,
  //   @Query('subscription_id') subscriptionId?: string
  // ) {
  //   console.log('❌ Payment Cancelled', {
  //     planId,
  //     subscriptionId
  //   });

  //   return {
  //     success: false,
  //     message: 'Payment was cancelled by user',
  //     planId: planId,
  //     subscriptionId: subscriptionId,
  //     redirectTo: process.env.FRONTEND_URL + '/pricing'
  //   };
  // }

  // ✅ UPDATED: subscribeDirect with duplicate prevention
  //  @Post('subscribe-direct')
  // @ApiOperation({ summary: '🚀 Create Subscription with PayPal Plan ID' })
  // async subscribeDirect(@Body() dto: { 
  //   userId: string; 
  //   paypalPlanId: string;
  //   planName: string;
  //   planType: string; // ✅ NEW: SAME/UPGRADE/DOWNGRADE/NEW
  //   planData: {
  //     name: string;
  //     displayName: string;
  //     price: number;
  //     videoLimit: number;
  //     imageLimit: number;
  //     accountLimit: number;
  //   }
  // }) {
  //   try {
  //     console.log('🚀 Creating direct PayPal subscription:', dto);

  //     // ✅ NEW: Check if upgrading/downgrading and cancel old subscription
  //     if (dto.planType !== 'SAME' && dto.planType !== 'NEW') {
  //       console.log(`🔄 User is ${dto.planType}ing - checking for old subscription...`);

  //       const user = await this.userModel.findById(dto.userId);

  //       if (user?.paypalSubscriptionId && user?.subscriptionActive) {
  //         console.log(`❌ Cancelling old subscription: ${user.paypalSubscriptionId}`);

  //         try {
  //           await this.paypalService.cancelSubscription(
  //             user.paypalSubscriptionId,
  //             `User ${dto.planType.toLowerCase()}ed to ${dto.planName}`
  //           );
  //           console.log(`✅ Old subscription cancelled successfully`);
  //         } catch (cancelError) {
  //           console.error(`⚠️ Failed to cancel old subscription:`, cancelError.message);
  //           // Continue anyway - new subscription will replace it
  //         }
  //       }
  //     }

  //     const result = await this.paypalService.createSubscriptionDirect(
  //       dto.userId, 
  //       dto.paypalPlanId,
  //       dto.planName,
  //       dto.planData
  //     );

  //     if (result.isDuplicate) {
  //       console.log('⏭️ Duplicate subscription detected - no PayPal redirect needed');
  //       return {
  //         success: true,
  //         subscriptionId: result.id,
  //         isDuplicate: true,
  //         message: '✅ Limits added to your subscription!',
  //         approvalUrl: null,
  //       };
  //     }

  //     const approvalUrl = result.links?.find(link => link.rel === 'approve');

  //     if (!approvalUrl) {
  //       throw new Error('No approval URL received from PayPal');
  //     }

  //     return {
  //       success: true,
  //       subscriptionId: result.id,
  //       approvalUrl: approvalUrl.href,
  //       planName: dto.planName,
  //       isDuplicate: false,
  //       message: '🔗 Redirect user to PayPal to complete payment'
  //     };
  //   } catch (error) {
  //     console.error('❌ Direct subscription creation failed:', error);
  //     throw new HttpException({ 
  //       success: false, 
  //       error: error.message 
  //     }, HttpStatus.BAD_REQUEST);
  //   }
  // }





  // ✅ UPDATED: Payment success handler with carryover and same-plan detection
  //  @Get('success')
  // @ApiOperation({ summary: '✅ Payment Success Handler' })
  // async paymentSuccess(
  //   @Query('planName') planName: string,
  //   @Query('userId') userId: string,
  //   @Query('subscription_id') subscriptionId: string, // ✅ PayPal sends this
  //   @Query('token') token: string, // ✅ PayPal sends this
  //   @Query('ba_token') baToken: string, // ✅ PayPal sends this (optional)
  //   @Res() res: any
  // ) {
  //   try {
  //     console.log('🎉 Payment Success Callback Received:', { 
  //       planName, 
  //       userId, 
  //       subscriptionId,
  //       token,
  //       baToken 
  //     });

  //     // ✅ CRITICAL CHECK: Verify subscription_id exists
  //     if (!subscriptionId) {
  //       console.error('❌ CRITICAL: No subscription_id in PayPal callback!');
  //       console.error('Query params received:', { planName, userId, token, baToken });
  //       throw new Error('Missing subscription_id from PayPal callback');
  //     }

  //     // ✅ STEP 1: Match plan from constants
  //     let matchedPlan = PLANS.find(p => 
  //       p.planName.toLowerCase() === planName.toLowerCase() ||
  //       p.displayName.toLowerCase() === planName.toLowerCase() ||
  //       p.planId.toLowerCase() === planName.toLowerCase()
  //     );

  //     // ✅ If not found, try partial matching
  //     if (!matchedPlan) {
  //       const planNameLower = planName.toLowerCase().replace(/\s+/g, '');
  //       matchedPlan = PLANS.find(p => 
  //         p.planName.toLowerCase().replace(/\s+/g, '').includes(planNameLower) ||
  //         planNameLower.includes(p.planName.toLowerCase().replace(/\s+/g, ''))
  //       );
  //     }

  //     if (!matchedPlan) {
  //       throw new Error(`Plan "${planName}" not found in constants`);
  //     }

  //     console.log('✅ Matched plan:', {
  //       searchedFor: planName,
  //       matched: matchedPlan.planName,
  //       limits: {
  //         videos: matchedPlan.videoAmount,
  //         images: matchedPlan.imageAmount
  //       },
  //       price: matchedPlan.price // ✅ LOG: Verify if price is in cents or dollars
  //     });

  //     const newPlanData = {
  //       videoLimit: matchedPlan.videoAmount,
  //       imageLimit: matchedPlan.imageAmount,
  //       accountLimit: 1,
  //       price: matchedPlan.price,
  //       isFree: matchedPlan.planType === 'free'
  //     };

  //     // ✅ STEP 2: Get user
  //     const user = await this.userModel.findById(userId);
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     let finalLimits = {
  //       videoLimit: newPlanData.videoLimit,
  //       imageLimit: newPlanData.imageLimit,
  //       accountLimit: newPlanData.accountLimit,
  //     };

  //     // ✅ STEP 3: Determine plan types
  //     const currentPlanName = user.currentPlanName?.toLowerCase() || 'free';
  //     const isCurrentlyOnFree = currentPlanName.toLowerCase().includes('free') || 
  //                               currentPlanName.toLowerCase().includes('flight') || 
  //                               !user.subscriptionActive;
  //     const isNewPlanFree = matchedPlan.planType === 'free' || matchedPlan.price === 0;
  //     const isSamePlan = user.currentPlanName?.toLowerCase() === planName.toLowerCase();

  //     console.log(`📊 Plan Analysis:`, {
  //       currentPlan: user.currentPlanName,
  //       newPlan: planName,
  //       isCurrentlyOnFree,
  //       isNewPlanFree,
  //       isSamePlan
  //     });

  //     // ✅ STEP 4: Apply carryover rules
  //     let shouldCarryover = false;
  //     let transactionType = 'SUBSCRIBE';

  //     if (isCurrentlyOnFree && !isNewPlanFree) {
  //       // ❌ Free → Paid: NO carryover
  //       console.log('❌ Free to Paid: NO carryover');
  //       shouldCarryover = false;
  //       transactionType = 'SUBSCRIBE';

  //       user.monthlyUsage = {
  //         videos: 0,
  //         images: 0,
  //         resetDate: new Date(),
  //       };
  //     } else if (!isCurrentlyOnFree && !isNewPlanFree) {
  //       // ✅ Paid → Paid: YES carryover
  //       console.log('✅ Paid to Paid: YES carryover');
  //       shouldCarryover = true;

  //       const videoUsed = user.monthlyUsage?.videos || 0;
  //       const imageUsed = user.monthlyUsage?.images || 0;

  //       const videoRemaining = Math.max(0, (user.currentLimits?.videoLimit || 0) - videoUsed);
  //       const imageRemaining = Math.max(0, (user.currentLimits?.imageLimit || 0) - imageUsed);

  //       console.log(`📊 Carryover:`, {
  //         videoRemaining,
  //         imageRemaining,
  //       });

  //       finalLimits = {
  //         videoLimit: newPlanData.videoLimit + videoRemaining,
  //         imageLimit: newPlanData.imageLimit + imageRemaining,
  //         accountLimit: newPlanData.accountLimit,
  //       };

  //       // ✅ Determine transaction type
  //       if (isSamePlan) {
  //         transactionType = 'RESTOCK';
  //       } else {
  //         const currentPlanInConstants = PLANS.find(p => 
  //           p.planName.toLowerCase() === user.currentPlanName?.toLowerCase() ||
  //           p.displayName.toLowerCase() === user.currentPlanName?.toLowerCase()
  //         );

  //         if (currentPlanInConstants) {
  //           if (matchedPlan.videoAmount > currentPlanInConstants.videoAmount) {
  //             transactionType = 'UPGRADE';
  //           } else if (matchedPlan.videoAmount < currentPlanInConstants.videoAmount) {
  //             transactionType = 'DOWNGRADE';
  //           } else {
  //             transactionType = 'UPGRADE';
  //           }
  //         } else {
  //           transactionType = 'UPGRADE';
  //         }
  //       }

  //       console.log(`🔄 Keeping existing usage for paid plan`);
  //     } else {
  //       // Free → Free or other edge cases
  //       console.log('⏭️ No carryover (free plan or edge case)');
  //       shouldCarryover = false;
  //       transactionType = 'SUBSCRIBE';

  //       user.monthlyUsage = {
  //         videos: 0,
  //         images: 0,
  //         resetDate: new Date(),
  //       };
  //     }

  //     console.log(`✅ Final limits:`, finalLimits);
  //     console.log(`📋 Transaction type:`, transactionType);

  //     // ✅ STEP 5: Activate subscription
  //     const isDuplicate = false;
  //     const updatedUser = await this.paypalService.activateUserSubscriptionDirect(
  //       userId,
  //       subscriptionId,
  //       planName,
  //       finalLimits,
  //       isDuplicate,
  //       new Date(), // ✅ FIX: Use current date for plan start
  //       new Date(), // ✅ FIX: Use current date for plan end
  //       "active"
  //     );

  //     console.log(`✅ User activated:`, {
  //       planName: updatedUser.currentPlanName,
  //       limits: updatedUser.currentLimits,
  //     });

  //     // ✅ STEP 6: Create transaction record (UPDATED WITH FIXES)
  //     if (!isNewPlanFree) {
  //       try {
  //         // ✅ FIX 1: Create unique transaction ID with timestamp
  //         const uniqueTransactionId = `${subscriptionId}-success-${Date.now()}`;

  //         console.log('💾 [TRANSACTION] Creating transaction with details:', {
  //           userId: userId,
  //           amount: newPlanData.price,
  //           amountInDollars: (newPlanData.price / 100).toFixed(2),
  //           planName: planName,
  //           transactionId: uniqueTransactionId,
  //           subscriptionId: subscriptionId,
  //           transactionType: transactionType
  //         });

  //         const transaction = await this.paypalService.createTransaction({
  //           userId: userId,
  //           amount: newPlanData.price,
  //           currency: 'USD',
  //           planName: planName,
  //           status: 'completed',
  //           transactionId: uniqueTransactionId, // ✅ FIX: Now unique
  //           subscriptionId: subscriptionId,
  //           payerId: undefined,
  //           paymentMethod: 'paypal',
  //           description: `${transactionType}: ${planName}`,
  //           expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // ✅ FIX: Extended to 1 year
  //           metadata: {
  //             videoLimit: finalLimits.videoLimit,
  //             imageLimit: finalLimits.imageLimit,
  //             accountLimit: finalLimits.accountLimit,
  //             type: transactionType,
  //             carryover: {
  //               applied: shouldCarryover,
  //               fromFreePlan: isCurrentlyOnFree
  //             },
  //             priceInDollars: (newPlanData.price / 100).toFixed(2)
  //           }
  //         });

  //         if (transaction) {
  //           console.log('✅ [TRANSACTION] Successfully created:', {
  //             transactionId: transaction._id,
  //             dbTransactionId: transaction.transactionId,
  //             amount: transaction.amount,
  //             amountInDollars: `$${(transaction.amount / 100).toFixed(2)}`,
  //             planName: transaction.planName,
  //             status: transaction.status
  //           });
  //         } else {
  //           console.error('❌ [TRANSACTION] createTransaction returned null/undefined!');
  //         }
  //       } catch (transError) {
  //         // ✅ FIX 2: Enhanced error logging
  //         console.error('❌ [TRANSACTION] Creation FAILED with full details:', {
  //           errorMessage: transError.message,
  //           errorName: transError.name,
  //           errorCode: transError.code,
  //           mongooseErrors: transError.errors,
  //           stackTrace: transError.stack?.split('\n').slice(0, 3).join('\n')
  //         });

  //         // ✅ Optional: Uncomment to see error in browser
  //         // throw new HttpException(
  //         //   { success: false, error: 'Transaction creation failed: ' + transError.message },
  //         //   HttpStatus.INTERNAL_SERVER_ERROR
  //         // );
  //       }
  //     } else {
  //       console.log('⏭️ Skipping transaction creation (free plan)');
  //     }

  //     // ✅ STEP 7: Redirect to frontend
  //     const encodedPlanName = encodeURIComponent(planName);
  //     const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  //     const redirectUrl = `${frontendUrl}/user/billing?success=true&plan=${encodedPlanName}&subscription=${subscriptionId}`;

  //     console.log('🔗 Redirecting to frontend:', redirectUrl);

  //     return res.redirect(redirectUrl);

  //   } catch (error) {
  //     console.error('❌ Payment success handling failed:', {
  //       message: error.message,
  //       stack: error.stack?.split('\n').slice(0, 5).join('\n')
  //     });

  //     const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  //     const redirectUrl = `${frontendUrl}/user/billing?success=false&error=${encodeURIComponent(error.message)}`;

  //     return res.redirect(redirectUrl);
  //   }
  // }






  // ✅ NEW WEBHOOK EVENT ENDPOINTS

  // @UseGuards(JwtAuthGuard)
  // @Get('webhooks/me')
  // @ApiOperation({ summary: '📜 Get My Webhook Events History' })
  // async getMyWebhookEvents(@Req() req: any, @Query('limit') limit?: string) {
  //   try {
  //     const userId = req.user._id;
  //     const events = await this.paypalService.getWebhookEventsByUser(
  //       userId,
  //       limit ? parseInt(limit) : 50
  //     );

  //     return {
  //       success: true,
  //       count: events.length,
  //       events: events,
  //       message: 'Webhook events retrieved successfully'
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin')
  // @Get('webhooks/all')
  // @ApiOperation({ summary: '📜 Get All Webhook Events (Admin)' })
  // async getAllWebhookEvents(@Query('limit') limit?: string) {
  //   try {
  //     const events = await this.paypalService.getAllWebhookEvents(limit ? parseInt(limit) : 100 );

  //     return {
  //       success: true,
  //       count: events.length,
  //       events: events,
  //       message: 'All webhook events retrieved successfully'
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @UseGuards(JwtAuthGuard)
  // @Get('webhooks/subscription/:subscriptionId')
  // @ApiOperation({ summary: '📜 Get Webhook Events by Subscription ID' })
  // async getWebhookEventsBySubscription(@Param('subscriptionId') subscriptionId: string) {
  //   try {
  //     const events = await this.paypalService.getWebhookEventsBySubscription(subscriptionId);

  //     return {
  //       success: true,
  //       count: events.length,
  //       events: events,
  //       message: `Webhook events for subscription ${subscriptionId}`
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }



  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin')
  // @Get('transactions/all')
  // @ApiOperation({ summary: '💳 Get All Billing Transactions (Admin)' })
  // async getAllTransactions(@Query('limit') limit?: string) {
  //   try {
  //     const transactions = await this.paypalService.getAllTransactions(limit ? parseInt(limit) : 100);

  //     return {
  //       success: true,
  //       count: transactions.length,
  //       transactions: transactions,
  //       message: 'All transactions retrieved successfully'
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }


  // @UseGuards(JwtAuthGuard)
  // @Get('transactions/subscription/:subscriptionId')
  // @ApiOperation({ summary: '💳 Get Transactions by Subscription ID' })
  // async getTransactionsBySubscription(@Param('subscriptionId') subscriptionId: string) {
  //   try {
  //     const transactions = await this.paypalService.getTransactionsBySubscription(subscriptionId);

  //     return {
  //       success: true,
  //       count: transactions.length,
  //       transactions: transactions,
  //       message: `Transactions for subscription ${subscriptionId}`
  //     };
  //   } catch (error) {
  //     throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Post('test/save-webhook')
  // @ApiOperation({ summary: '🧪 Test Webhook Event Save' })
  // async testWebhookSave(@Body() testData: { userId: string }) {
  //   try {
  //     console.log("test webhook save");
  //     const testEvent = new this.paypalService['webhookEventModel']({
  //       eventType: 'TEST_EVENT',
  //       eventId: `TEST-${Date.now()}`,
  //       userId: testData.userId,
  //       subscriptionId: 'TEST-SUB-123',
  //       planName: 'Test Plan',
  //       rawData: { test: true },
  //       processed: true,
  //       receivedAt: new Date()
  //     });

  //     const saved = await testEvent.save();

  //     return {
  //       success: true,
  //       message: 'Test webhook event saved!',
  //       savedId: saved._id,
  //       savedData: saved
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       error: error.message,
  //       errorDetails: error
  //     };
  //   }
  // }


  // @Get('plans/details')
  // @ApiOperation({ summary: '📋 Get All Active Plans with Full Details' })
  // async getAllPlansWithDetails() {
  //   try {
  //     // Step 1: Get list of all plans
  //     const plansListResponse = await this.paypalService.listPaypalPlans();

  //     if (!plansListResponse.success) {
  //       throw new Error('Failed to fetch plans list');
  //     }

  //     // Step 2: Filter only ACTIVE plans
  //     const activePlans = plansListResponse.plans.filter(plan => plan.status === 'ACTIVE');
  //     console.log(`✅ Found ${activePlans.length} active plans`);

  //     // Step 3: Fetch detailed info for each active plan
  //     const plansWithDetails = await Promise.all(
  //       activePlans.map(async (plan) => {
  //         try {
  //           const detailsResponse = await this.paypalService.getPaypalPlan(plan.id);

  //           // Extract price from billing cycles
  //           const billingCycle = detailsResponse.billing_cycles?.[0];
  //           const priceValue = billingCycle?.pricing_scheme?.fixed_price?.value;
  //           const price = priceValue ? parseFloat(priceValue) : 0;

  //           // ✅ Find matching plan from constants
  //           const planNameLower = plan.name.toLowerCase();
  //           let matchedConstantPlan = PLANS.find(p => 
  //             p.planName.toLowerCase() === planNameLower ||
  //             p.displayName.toLowerCase() === planNameLower ||
  //             planNameLower.includes(p.planName.toLowerCase().replace(/\s+/g, '')) ||
  //             planNameLower.includes(p.planId.toLowerCase())
  //           );

  //           // ✅ Extract limits from constants or default to 0
  //           const videoLimit = matchedConstantPlan?.videoAmount || 0;
  //           const imageLimit = matchedConstantPlan?.imageAmount || 0;
  //           const accountLimit = 1;
  //           const isPopular = matchedConstantPlan?.isPopular || false;

  //           console.log('📋 Plan mapping:', {
  //             paypalPlanName: plan.name,
  //             matchedConstant: matchedConstantPlan?.planName || 'NOT FOUND',
  //             limits: { videoLimit, imageLimit }
  //           });

  //           return {
  //             _id: plan.id,
  //             paypalPlanId: plan.id,
  //             name: (matchedConstantPlan?.planId || plan.name).replace(/\s+/g, '-'),
  //             displayName: plan.name,
  //             price: price,
  //             priceInCents: Math.round(price * 100),
  //             currency: 'USD',
  //             description: plan.description || matchedConstantPlan?.description || '',
  //             isPopular: isPopular,
  //             videoLimit: videoLimit,
  //             imageLimit: imageLimit,
  //             accountLimit: accountLimit,
  //             status: plan.status,
  //             billingInterval: billingCycle?.frequency?.interval_unit || 'MONTH',
  //             billingIntervalCount: billingCycle?.frequency?.interval_count || 1,
  //             paypalData: detailsResponse
  //           };
  //         } catch (error) {
  //           console.error(`❌ Failed to fetch details for plan ${plan.id}:`, error.message);
  //           return null;
  //         }
  //       })
  //     );

  //     // Filter out any failed plan fetches
  //     const validPlans = plansWithDetails.filter(plan => plan !== null);

  //     console.log(`✅ Returning ${validPlans.length} plans with full details`);

  //     return {
  //       success: true,
  //       plans: validPlans,
  //       total: validPlans.length
  //     };
  //   } catch (error) {
  //     console.error('❌ Error fetching plans with details:', error);
  //     return {
  //       success: false,
  //       error: error.message
  //     };
  //   }
  // }



  // @UseGuards(JwtAuthGuard)
  // @Post('subscription/cancel')
  // @ApiOperation({ summary: '❌ Cancel User Subscription and Downgrade to Free' })
  // async cancelSubscription(
  //   @Req() req: any,
  //   @Body() body: { reason?: string }
  // ) {
  //   try {
  //     const userId = req.user._id || req.user.id;
  //     const user = await this.userModel.findById(userId);

  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     if (!user.paypalSubscriptionId) {
  //       throw new Error('No active subscription found');
  //     }

  //     if (!user.subscriptionActive) {
  //       throw new Error('Subscription is already cancelled');
  //     }

  //     console.log(`❌ Cancelling subscription for user ${user.email}`);
  //     console.log(`PayPal Subscription ID: ${user.paypalSubscriptionId}`);

  //     // Step 1: Try to cancel subscription on PayPal
  //     let cancelledOnPayPal = false;
  //     try {
  //       await this.paypalService.cancelStripeSubscription(
  //         user.paypalSubscriptionId,
  //         // body.reason || 'User requested cancellation'
  //       );
  //       cancelledOnPayPal = true;
  //       console.log('✅ Successfully cancelled on PayPal');
  //     } catch (paypalError) {
  //       // ✅ Check if subscription doesn't exist (already cancelled or never existed)
  //       if (paypalError.message?.includes('RESOURCE_NOT_FOUND') || 
  //           paypalError.message?.includes('does not exist')) {
  //         console.log('⚠️ Subscription not found on PayPal - may already be cancelled');
  //         console.log('✅ Proceeding with local cancellation');
  //         cancelledOnPayPal = false; // Not found, but we'll proceed
  //       } else {
  //         // Real error - log but continue
  //         console.error('⚠️ PayPal cancellation error:', paypalError.message);
  //         console.log('⚠️ Continuing with local downgrade anyway...');
  //       }
  //     }

  //     // Step 2: Downgrade user to FREE plan (always do this)
  //     // const updatedUser = await this.paypalService.downgradeToFreePlan(userId);

  //     // Step 3: Create transaction record
  //     // try {
  //     //   await this.paypalService.createTransaction({
  //     //     userId: userId,
  //     //     amount: 0,
  //     //     currency: 'USD',
  //     //     planName: 'Free Plan',
  //     //     status: 'canceled',
  //     //     transactionId: `cancel-${Date.now()}`,
  //     //     subscriptionId: user.paypalSubscriptionId,
  //     //     paymentMethod: 'manual_cancellation',
  //     //     description: `Subscription cancelled - downgraded to Free Plan`,
  //     //     expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  //     //     metadata: {
  //     //       previousPlan: user.currentPlanName,
  //     //       reason: body.reason || 'User requested',
  //     //       type: 'CANCEL',
  //     //       downgradedToFree: true,
  //     //       cancelledOnPayPal: cancelledOnPayPal
  //     //     }
  //     //   });
  //     // } catch (transError) {
  //     //   console.error('Failed to create cancellation transaction:', transError);
  //     // }

  //     console.log('✅ User downgraded to FREE plan successfully');

  //     return {
  //       success: true,
  //       message: 'Subscription cancelled successfully. You have been moved to the Free Plan.',
  //       newPlan: 'Free Plan',
  //       // limits: updatedUser,
  //       note: cancelledOnPayPal 
  //         ? 'Subscription cancelled on PayPal' 
  //         : 'Subscription was already cancelled or not found on PayPal'
  //     };
  //   } catch (error) {
  //     console.error('❌ Cancellation failed:', error);
  //     throw new HttpException(
  //       { success: false, error: error.message },
  //       HttpStatus.BAD_REQUEST
  //     );
  //   }
  // }

  // @Post('setup/inactivate-all-plans')
  // @ApiOperation({ summary: '⏸️ Inactivate All Active PayPal Plans' })
  // async inactivateAllPlans() {
  //   try {
  //     const result = await this.paypalService.inactivateAllPaypalPlans();
  //     return {
  //       ...result,
  //       message: result.success 
  //         ? `✅ ${result.inactivated} plans inactivated successfully!` 
  //         : '❌ Failed to inactivate plans'
  //     };
  //   } catch (error) {
  //     throw new HttpException({ 
  //       success: false, 
  //       error: error.message 
  //     }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Post('setup/create-all-plans')
  // @ApiOperation({ summary: '🚀 Create All Plans from Constants' })
  // async createAllPlans(@Body() dto: { productId: string }) {
  //   try {
  //     const result = await this.paypalService.createAllPlansFromConstants(dto.productId);
  //     return {
  //       ...result,
  //       message: result.success
  //         ? `✅ ${result.created} of ${result.total} plans created successfully!`
  //         : '❌ Failed to create plans'
  //     };
  //   } catch (error) {
  //     throw new HttpException({ 
  //       success: false, 
  //       error: error.message 
  //     }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Post('setup/reset-all-plans')
  // @ApiOperation({ summary: '🔄 Reset All Plans (Inactivate Old + Create New)' })
  // async resetAllPlans(@Body() dto: { productId: string }) {
  //   try {
  //     this.logger.log('🔄 Starting plan reset process...');

  //     // Step 1: Inactivate all existing plans
  //     this.logger.log('⏸️ Step 1: Inactivating all existing plans...');
  //     const inactivateResult = await this.paypalService.inactivateAllPaypalPlans();

  //     this.logger.log(`✅ Inactivated ${inactivateResult.inactivated} plans`);

  //     // Wait 3 seconds for PayPal to process
  //     this.logger.log('⏳ Waiting 3 seconds for PayPal to process...');
  //     await new Promise(resolve => setTimeout(resolve, 3000));

  //     // Step 2: Create new plans from constants
  //     this.logger.log('🚀 Step 2: Creating new plans from constants...');
  //     const createResult = await this.paypalService.createAllPlansFromConstants(dto.productId);

  //     this.logger.log(`✅ Created ${createResult.created} new plans`);

  //     return {
  //       success: true,
  //       inactivated: inactivateResult,
  //       created: createResult,
  //       summary: {
  //         oldPlansInactivated: inactivateResult.inactivated,
  //         newPlansCreated: createResult.created,
  //         totalFailed: (inactivateResult.failed || 0) + (createResult.failed || 0)

  //       },
  //       message: '✅ All plans reset successfully!'
  //     };
  //   } catch (error) {
  //     this.logger.error('❌ Plan reset failed:', error);
  //     throw new HttpException({ 
  //       success: false, 
  //       error: error.message 
  //     }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  // @Post('setup/test-deactivate-plan')
  // @ApiOperation({ summary: '🧪 Test Deactivate Single Plan' })
  // async testDeactivatePlan(@Body() dto: { paypalPlanId: string }) {
  //   try {
  //     const result = await this.paypalService.deactivatePaypalPlan(dto.paypalPlanId);
  //     return {
  //       success: true,
  //       message: '✅ Plan deactivated successfully',
  //       planId: dto.paypalPlanId,
  //       result: result
  //     };
  //   } catch (error) {
  //     throw new HttpException({
  //       success: false,
  //       error: error.message,
  //       details: error.response?.data
  //     }, HttpStatus.BAD_REQUEST);
  //   }
  // }

  //  // 🔹 By metadata
  //   @Get('subscriptions/by-metadata')
  //   getByMetadata(
  //     @Query('key') key: string,
  //     @Query('value') value: string,
  //   ) {
  //     return this.paypalService.getSubscriptionsByMetadata(key, value);
  //   }


}

