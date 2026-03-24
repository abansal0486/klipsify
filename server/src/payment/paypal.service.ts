// src/payment/paypal.service.ts - COMPLETE UPDATED VERSION WITH DUPLICATE PREVENTION

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
// import { Plan, PlanDocument } from '../plans/schemas/plan.schema';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { WebhookEvent, WebhookEventDocument } from './schemas/webhook-event.schema';
import axios from 'axios';
import Stripe from 'stripe';
import { Request } from 'express';
import { PLANS, getPlanById, getPayablePlans } from './constants/plans.constants';
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
    // ✅ NEW: Cache for plans
  private plansCache: any[] | null = null;
  private plansCacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private stripe: Stripe;

  private baseURL = process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(WebhookEvent.name) private webhookEventModel: Model<WebhookEventDocument>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
    });
   }

  async getAccessToken() {
    console.log('🔍 PayPal Environment Check:', {
      NODE_ENV: process.env.NODE_ENV,
      baseURL: this.baseURL,
      clientId: process.env.PAYPAL_CLIENT_ID ? `${process.env.PAYPAL_CLIENT_ID.slice(0, 10)}...` : 'MISSING',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET ? `${process.env.PAYPAL_CLIENT_SECRET.slice(0, 10)}...` : 'MISSING'
    });

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error('PayPal auth failed:', error.response?.data);
      throw error;
    }
  }

  async createProduct() {
    const accessToken = await this.getAccessToken();

    const productData = {
      name: 'AI Social Media Platform Subscription',
      description: 'AI-powered social media platform with video and image generation for content creators and businesses',
      type: 'SERVICE',
      category: 'SOFTWARE'
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/catalogs/products`,
        productData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`✅ PayPal Product Created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Product creation failed:', error.response?.data);
      throw error;
    }
  }

 async createPaypalPlan(productId: string, planId: string) {
  // ✅ Get plan from constants instead of database
  const plan = getPlanById(planId);
  
  if (!plan) {
    throw new NotFoundException(`Plan ${planId} not found in constants`);
  }

  // ✅ Skip free and custom plans
  if (plan.planType === 'free' || plan.planType === 'custom' || plan.price === 0) {
    throw new Error(`Cannot create PayPal plan for ${plan.planType} plans`);
  }

  const accessToken = await this.getAccessToken();

  const paypalPlanData = {
    product_id: productId,
    name: plan.displayName,
    description: `${plan.description} - ${plan.videoAmount} videos, ${plan.imageAmount} images per month`,
    billing_cycles: [{
      frequency: {
        interval_unit: 'MONTH',
        interval_count: 1,
      },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: {
        fixed_price: {
          value: (plan.price / 100).toFixed(2),
          currency_code: 'USD',
        },
      },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0',
        currency_code: 'USD',
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  };

  try {
    const response = await axios.post(
      `${this.baseURL}/v1/billing/plans`,
      paypalPlanData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`✅ PayPal Plan Created: ${plan.displayName} -> ${response.data.id}`);

    return {
      success: true,
      paypalPlanId: response.data.id,
      planId: plan.planId,
      planName: plan.displayName,
      price: plan.displayPrice,
      paypalResponse: response.data
    };
  } catch (error) {
    this.logger.error(`Plan creation failed for ${plan.displayName}:`, error.response?.data);
    throw error;
  }
}


 async createUserSubscription(userId: string, planId: string, paypalPlanId: string) {
  // ✅ Get plan from constants
  const plan = getPlanById(planId);
  const user = await this.userModel.findById(userId);
  
  if (!user) {
    throw new NotFoundException('User not found');
  }
  if (!plan) {
    throw new NotFoundException(`Plan ${planId} not found in constants`);
  }

  if (!paypalPlanId) {
    throw new Error(`Plan ${plan.displayName} doesn't have PayPal integration. Provide paypalPlanId.`);
  }

  const accessToken = await this.getAccessToken();

  const subscriptionData = {
    plan_id: paypalPlanId, // ✅ Use the passed paypalPlanId
    custom_id: userId,
    application_context: {
      brand_name: 'AI Social Media Platform',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
      },
      return_url: `${process.env.FRONTEND_URL}/payment/success?planId=${planId}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?planId=${planId}`,
    },
  };

  try {
    const response = await axios.post(
      `${this.baseURL}/v1/billing/subscriptions`,
      subscriptionData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      subscription: response.data,
      plan: plan
    };
  } catch (error) {
    this.logger.error('Subscription creation failed:', error.response?.data);
    throw error;
  }
}


  async listPaypalProducts() {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseURL}/v1/catalogs/products?page_size=20`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.products;
    } catch (error) {
      this.logger.error('Failed to list PayPal products:', error.response?.data);
      throw error;
    }
  }

  async listPaypalPlans() {
  const accessToken = await this.getAccessToken();

  try {
    // ✅ Add pagination parameters to get more plans
    const response = await axios.get(
      `${this.baseURL}/v1/billing/plans?product_id=PROD-3FX667607R695603Y&page_size=20&page=1&total_required=true`, // ✅ Get 20 plans
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const plans = response.data?.plans || [];
    const totalItems = response.data?.total_items || plans.length;

    this.logger.log(`✅ Found ${plans.length} plans (Total: ${totalItems})`);

    return {
      success: true,
      plans: plans,
      totalItems: totalItems,
      message: `Found ${plans.length} PayPal plans (Total: ${totalItems})`
    };
  } catch (error) {
    console.log('Failed to list PayPal plans:', error.response?.data);
    return {
      success: false,
      plans: [],
      totalItems: 0,
      message: error.response?.data?.message
    };
  }
}


 async getIntegrationStatus() {
  try {
    // ✅ Use constants instead of database
    const payablePlans = getPayablePlans();
    const paypalProducts = await this.listPaypalProducts();
    const paypalPlans = await this.listPaypalPlans();

    const plansList = payablePlans.map(plan => ({
      planId: plan.planId,
      name: plan.displayName,
      price: plan.displayPrice,
      videoAmount: plan.videoAmount,
      imageAmount: plan.imageAmount,
      autoPosting: plan.autoPosting
    }));

    return {
      summary: {
        totalPlans: payablePlans.length,
        paypalProducts: paypalProducts.length,
        paypalPlans: paypalPlans?.plans?.length
      },
      plans: plansList,
      paypalProducts: paypalProducts,
      message: 'Integration status retrieved successfully'
    };
  } catch (error) {
    this.logger.error('Failed to get integration status:', error.response?.data);
    throw error;
  }
}


  async getPaypalPlan(planId: string) {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseURL}/v1/billing/plans/${planId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get PayPal plan ${planId}:`, error.response?.data);
      throw error;
    }
  }

  // ✅ Get subscription details from PayPal
  async getSubscription(subscriptionId: string) {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseURL}/v1/billing/subscriptions/${subscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get subscription ${subscriptionId}:`, error.response?.data);
      throw error;
    }
  }

  // ✅ Cancel subscription
  async cancelSubscription(subscriptionId: string, reason: string) {
  try {
    console.log(`❌ Attempting to cancel PayPal subscription: ${subscriptionId}`);

    const accessToken = await this.getAccessToken();

    const response = await axios.post(
      `${this.baseURL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        reason: reason
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('✅ PayPal subscription cancelled successfully');
    return true;
  } catch (error) {
    const errorData = error.response?.data;
    console.error('❌ PayPal cancellation error:', errorData || error.message);

    // ✅ If subscription not found, throw specific error
    if (errorData?.name === 'RESOURCE_NOT_FOUND' || error.response?.status === 404) {
      throw new Error('RESOURCE_NOT_FOUND: The subscription does not exist on PayPal');
    }

    // ✅ If already cancelled (422 status)
    if (error.response?.status === 422) {
      console.log('⚠️ Subscription may already be cancelled');
      throw new Error('Subscription already cancelled');
    }

    throw new Error(`PayPal error: ${errorData?.message || error.message}`);
  }
}


// Cancel subscription
async cancelStripeSubscription(subscriptionId:string) {
  console.log(`❌ Attempting to cancel Stripe subscription: ${subscriptionId}`);
    return await this.stripe.subscriptions.cancel(subscriptionId);
    // {
    //     cancel_at_period_end: true,
    // }
};


  // ✅ UPDATED: createSubscriptionDirect with duplicate prevention
  // ✅ UPDATED: createSubscriptionDirect with duplicate prevention
async createSubscriptionDirect(
  userId: string, 
  paypalPlanId: string, 
  planName: string, 
  planData: any
) {
  const user = await this.userModel.findById(userId);
  if (!user) {
    throw new NotFoundException('User not found');
  }

  // NEW: Check if user already has ACTIVE subscription for SAME plan
  // if (user.paypalSubscriptionId && user.subscriptionActive) {
  //   try {
  //     const existingSubStatus = await this.getSubscription(user.paypalSubscriptionId);
      
  //     console.log('Existing subscription found:', {
  //       subscriptionId: user.paypalSubscriptionId,
  //       status: existingSubStatus.status,
  //       planId: existingSubStatus.plan_id,
  //       requestedPlanId: paypalPlanId,
  //     });

  //     // SAME PLAN: Return existing subscription (prevent duplicate)
  //     if (existingSubStatus.plan_id === paypalPlanId && existingSubStatus.status === 'ACTIVE') {
  //       console.log('⚠️ User already has ACTIVE subscription for this plan!');
  //       console.log('⏭️ PREVENTING duplicate subscription creation');
  //       return {
  //         ...existingSubStatus,
  //         isDuplicate: true,
  //         message: 'User already has active subscription - adding limits instead',
  //         links: existingSubStatus.links || [],
  //       };
  //     }

  //     // DIFFERENT PLAN: Cancel old one first
  //     console.log('🔄 User switching plans - cancelling old subscription first');
  //     await this.cancelSubscription(user.paypalSubscriptionId, 'Upgrading to new plan');
  //   } catch (error) {
  //     console.error('Error checking existing subscription:', error.message);
  //     // Continue with new subscription if check fails...
  //   }
  // }

  // ✅ Create new subscription only if no active subscription exists
  const accessToken = await this.getAccessToken();
  
  const customData = { userId, planName };
  const encodedPlanName = encodeURIComponent(planName);
  
  // ✅ FIX: Use proper return_url format that PayPal will append subscription_id to
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  const subscriptionData = {
    plan_id: paypalPlanId,
    custom_id: JSON.stringify(customData),
    application_context: {
      brand_name: 'AI Social Media Platform',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      landing_page: 'BILLING',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
      },
      // ✅ FIX: PayPal automatically adds subscription_id, token, and ba_token
      return_url: `${backendUrl}/payment/success?planName=${encodedPlanName}&userId=${userId}`,
      cancel_url: `${backendUrl}/payment/cancel?planName=${encodedPlanName}&userId=${userId}`,
    },
  };

  try {
    const response = await axios.post(
      `${this.baseURL}/v1/billing/subscriptions`,
      subscriptionData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`✅ NEW subscription created: ${response.data.id} for user ${userId}`);
    return response.data;
  } catch (error) {
    this.logger.error('Direct subscription creation failed:', error.response?.data);
    throw error;
  }
}


  async handleWebhook(webhookData: any) {
  const { event_type, resource } = webhookData;

  this.logger.log(`🔔 Processing webhook: ${event_type}`);
  console.log(`\n🔔 Webhook received: ${event_type}`);

  let userId: string | null = null;
  try {
    if (resource?.custom_id) {
      try {
        const customData = JSON.parse(resource.custom_id);
        userId = customData.userId;
      } catch (parseError) {
        userId = resource.custom_id;
      }
    }
  } catch (err) {
    this.logger.error('❌ Error extracting userId from custom_id:', err);
  }

  // ✅ ALWAYS try to save webhook event (even with invalid userId)
  const savedEvent = await this.saveWebhookEvent(
    webhookData, 
    userId || 'unknown', 
    userId ? true : false, 
    userId ? undefined : 'No userId in custom_id'
  );

  if (savedEvent) {
    console.log('✅ Webhook event saved to database');
  } else {
    console.log('⚠️ Webhook event NOT saved (see errors above)');
  }

  if (!userId) {
    this.logger.error('❌ No userId found in webhook - cannot process');
    return;
  }

  try {
    // Process the webhook based on event type
    switch (event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.handleSubscriptionActivated(resource);
        break;

      case 'PAYMENT.SALE.COMPLETED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED':
        await this.handlePaymentCompleted(resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await this.handleSubscriptionCancelled(resource);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await this.handleSubscriptionSuspended(resource);
        break;

      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.handleSubscriptionExpired(resource);
        break;

      default:
        this.logger.log(`ℹ️ Unhandled webhook event: ${event_type}`);
    }
  } catch (error) {
    this.logger.error(`❌ Webhook processing failed:`, error);
    // Don't throw - webhook was already saved
  }
}


  private async calculateCarryoverLimits(userId: string, newPlanData: any) {
    try {
      const user = await this.userModel.findById(userId);
      
      if (!user) {
        this.logger.warn(`⚠️ User ${userId} not found for carryover calculation`);
        return newPlanData;
      }

      // const videoUsed = user.monthlyUsage?.videos || 0;
      // const imageUsed = user.monthlyUsage?.images || 0;
      
      // const videoRemaining = Math.max(0, (user.currentLimits?.videoLimit || 0) - videoUsed);
      // const imageRemaining = Math.max(0, (user.currentLimits?.imageLimit || 0) - imageUsed);

      // this.logger.log(`📊 Carryover calculation for user ${userId}:`);
      // this.logger.log(`   Videos: Used=${videoUsed}, Limit=${user.currentLimits?.videoLimit || 0}, Remaining=${videoRemaining}`);
      // this.logger.log(`   Images: Used=${imageUsed}, Limit=${user.currentLimits?.imageLimit || 0}, Remaining=${imageRemaining}`);

      const carryoverLimits = {
        // videoLimit: newPlanData.videoLimit + videoRemaining,
        // imageLimit: newPlanData.imageLimit + imageRemaining,
        accountLimit: newPlanData.accountLimit
      };

      this.logger.log(`✅ New limits with carryover:`, carryoverLimits);
      return carryoverLimits;
    } catch (error) {
      this.logger.error('❌ Error calculating carryover:', error);
      return newPlanData;
    }
  }

  async handleSubscriptionActivated(resource: any) {
    console.log(`\n✅ WEBHOOK: Activating subscription ${resource.id}`);
    
    let customData;
    let userId: string | null = null;
    let planName: string = 'unknown';
    let status: string = 'unknown';

    try {
      customData = JSON.parse(resource.custom_id);
      userId = customData.userId;
      planName = customData.planName || 'unknown';
      status = customData.status || 'unknown';
    } catch (err) {
      userId = resource.custom_id;
      customData = { userId, planName };
    }

    const subscriptionId = resource.id;

    if (!userId) {
      throw new Error('User ID not found in subscription custom_id');
    }

    let planData = this.getPlanDataByName(planName);
    
    if (!planData) {
      this.logger.warn(`⚠️ Plan ${planName} not found in mapping, using defaults`);
      planData = { videoLimit: 0, imageLimit: 0, accountLimit: 0 };
    }

    const finalLimits = await this.calculateCarryoverLimits(userId, planData);

    const updatedUser = await this.activateUserSubscriptionDirect(
      userId,
      subscriptionId,
      planName,
      finalLimits,
      false,
      new Date(),
      new Date(),
      status
    );

   try {
  // ✅ Get plan from constants
  const planData = getPlanById(planName) || PLANS.find(p => p.planName === planName || p.displayName === planName);
  if (planData) {
    await this.createTransaction({
      userId: userId,
      amount: planData.price,
      currency: 'USD',
      planName: planName,
      status: 'completed',
      transactionId: `${subscriptionId}`,
      subscriptionId: subscriptionId,
      payerId: resource.subscriber?.payer_id || null,
      description: `Subscription activated: ${planName}`,
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  }
} catch (transError) {
  this.logger.error('❌ Failed to create transaction:', transError);
}


    console.log(`✅ User ${userId} activated successfully with carryover limits\n`);
    return updatedUser;
  }

  async handlePaymentCompleted(resource: any) {
  this.logger.log(`💳 Payment completed for subscription: ${resource.id}`);

  let customData;
  let userId: string;

  try {
    customData = JSON.parse(resource.custom_id);
    userId = customData.userId;
  } catch (err) {
    userId = resource.custom_id;
    customData = { userId };
  }

  if (!userId) {
    this.logger.error('❌ User ID not found in payment completed event');
    return;
  }

  const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
    'monthlyUsage.videos': 0,
    'monthlyUsage.images': 0,
    'monthlyUsage.resetDate': new Date(),
  }, { new: true });

  try {
    const amount = resource.billing_info?.last_payment?.amount?.value;
    const currency = resource.billing_info?.last_payment?.amount?.currency_code;
    const paymentTime = resource.billing_info?.last_payment?.time;
    const cyclesCompleted = resource.billing_info?.cycle_executions?.[0]?.cycles_completed || 1;

    if (amount && paymentTime) {
      await this.createTransaction({
        userId: userId,
        amount: parseFloat(amount) * 100,
        currency: currency || 'USD',
        planName: customData.planName || 'Unknown', //|| updatedUser?.currentPlanName 
        status: 'completed',
        transactionId: `payment-${paymentTime}-${resource.id}`,
        subscriptionId: resource.id,
        payerId: resource.subscriber?.payer_id || null,
        description: cyclesCompleted > 1 
          ? `Monthly renewal: ${customData.planName || 'subscription'}` 
          : `Initial payment: ${customData.planName || 'subscription'}`,
        expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        metadata: {
          type: cyclesCompleted > 1 ? 'RENEWAL' : 'SUBSCRIBE', // ✅ Distinguish renewal from first payment
          billingCycle: cyclesCompleted,
          nextBillingTime: resource.billing_info?.next_billing_time
        }
      });
    } else {
      this.logger.warn('⚠️ Payment completed but no amount found in webhook');
    }
  } catch (transError) {
    this.logger.error('❌ Failed to create payment transaction:', transError);
  }

  this.logger.log(`🔄 Monthly usage reset for user ${userId}`);
  return updatedUser;
}


  async handleSubscriptionCancelled(resource: any) {
  this.logger.log(`❌ Subscription cancelled: ${resource.id}`);

  let userId: string;
  let planName: string = 'Unknown';
  
  try {
    const customData = JSON.parse(resource.custom_id);
    userId = customData.userId;
    planName = customData.planName || 'Unknown';
  } catch (err) {
    userId = resource.custom_id;
  }

  if (!userId) {
    this.logger.error('❌ User ID not found in cancellation event');
    return;
  }
try {
    console.log(`🔽 Downgrading user ${userId} to FREE plan...`);
    await this.downgradeToFreePlan(userId);
    console.log(`✅ User ${userId} downgraded to FREE plan successfully`);
  } catch (downgradeError) {
    this.logger.error('Failed to downgrade user to FREE plan:', downgradeError);
  }
  // ✅ NEW: Create transaction record for cancellation
  try {
    await this.createTransaction({
      userId: userId,
      amount: 0,  // No money involved
      currency: 'USD',
      planName: planName,
      status: 'cancelled',
      transactionId: `${resource.id}-cancelled-${Date.now()}`,
      subscriptionId: resource.id,
      payerId: resource.subscriber?.payer_id || null,
      paymentMethod: 'paypal',
      description: `Subscription cancelled: ${planName}`,
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      metadata: {
        type: 'CANCEL',
        reason: resource.status_change_note || 'User cancelled subscription',
        cancelledAt: new Date(),
        originalAmount: resource.billing_info?.last_payment?.amount?.value 
          ? parseFloat(resource.billing_info.last_payment.amount.value) * 100 
          : 0
      }
    });
    
    this.logger.log(`✅ Cancellation transaction created for ${planName}`);
  } catch (transError) {
    this.logger.error('❌ Failed to create cancellation transaction:', transError);
  }

  // Update user subscription status
  const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
    subscriptionActive: false,
    planEndDate: new Date(),
  }, { new: true });

  this.logger.log(`❌ Subscription cancelled for user ${userId}`);
  return updatedUser;
}


  async handleSubscriptionSuspended(resource: any) {
  this.logger.warn(`⚠️ Subscription suspended: ${resource.id}`);

  let userId: string;
  let planName: string = 'Unknown';
  
  try {
    const customData = JSON.parse(resource.custom_id);
    userId = customData.userId;
    planName = customData.planName || 'Unknown';
  } catch (err) {
    userId = resource.custom_id;
  }

  if (!userId) {
    this.logger.error('❌ User ID not found in suspension event');
    return;
  }

  // ✅ NEW: Create transaction record for suspension
  try {
    await this.createTransaction({
      userId: userId,
      amount: 0,
      currency: 'USD',
      planName: planName,
      status: 'suspended',
      transactionId: `${resource.id}-suspended-${Date.now()}`,
      subscriptionId: resource.id,
      payerId: resource.subscriber?.payer_id || null,
      paymentMethod: 'paypal',
      description: `Subscription suspended: ${planName}`,
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      metadata: {
        type: 'SUSPEND',
        reason: 'Payment failed - subscription paused',
        suspendedAt: new Date()
      }
    });
    
    this.logger.log(`⚠️ Suspension transaction created for ${planName}`);
  } catch (transError) {
    this.logger.error('❌ Failed to create suspension transaction:', transError);
  }

  const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
    subscriptionActive: false,
  }, { new: true });

  this.logger.log(`⚠️ Subscription suspended for user ${userId}`);
  return updatedUser;
}


  async handleSubscriptionExpired(resource: any) {
  this.logger.warn(`⏰ Subscription expired: ${resource.id}`);

  let userId: string;
  let planName: string = 'Unknown';
  
  try {
    const customData = JSON.parse(resource.custom_id);
    userId = customData.userId;
    planName = customData.planName || 'Unknown';
  } catch (err) {
    userId = resource.custom_id;
  }

  if (!userId) {
    this.logger.error('❌ User ID not found in expiration event');
    return;
  }

  // ✅ NEW: Create transaction record for expiration
  try {
    await this.createTransaction({
      userId: userId,
      amount: 0,
      currency: 'USD',
      planName: planName,
      status: 'expired',
      transactionId: `${resource.id}-expired-${Date.now()}`,
      subscriptionId: resource.id,
      payerId: resource.subscriber?.payer_id || null,
      paymentMethod: 'paypal',
      description: `Subscription expired: ${planName}`,
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      metadata: {
        type: 'EXPIRE',
        reason: 'Subscription period ended',
        expiredAt: new Date()
      }
    });
    
    this.logger.log(`⏰ Expiration transaction created for ${planName}`);
  } catch (transError) {
    this.logger.error('❌ Failed to create expiration transaction:', transError);
  }

  const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
    subscriptionActive: false,
    planEndDate: new Date()
  }, { new: true });

  this.logger.log(`⏰ Subscription expired for user ${userId}`);
  return updatedUser;
}


  async deactivatePaypalPlan(paypalPlanId: string) {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/billing/plans/${paypalPlanId}/deactivate`,
        {
          reason: 'Updating pricing'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`🔄 PayPal plan deactivated: ${paypalPlanId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to deactivate plan ${paypalPlanId}:`, error.response?.data);
      throw error;
    }
  }
/**
 * Inactivate all active PayPal plans
 */
async inactivateAllPaypalPlans() {
  try {
    const plansResponse = await this.listPaypalPlans();
    
    if (!plansResponse.success || !plansResponse.plans) {
      return {
        success: false,
        message: 'Failed to fetch plans',
        total: 0,
        inactivated: 0,
        failed: 0,
        results: []
      };
    }

    const activePlans = plansResponse.plans.filter(plan => plan.status === 'ACTIVE');
    
    this.logger.log(`Found ${activePlans.length} active plans to inactivate`);

    const results: Array<{
      planId: string;
      name: string;
      oldStatus?: string;
      newStatus?: string;
      status?: string;
      error?: string;
      success: boolean;
    }> = []; // ✅ Added proper type

    for (const plan of activePlans) {
      try {
        await this.deactivatePaypalPlan(plan.id);
        
        results.push({
          planId: plan.id,
          name: plan.name,
          oldStatus: 'ACTIVE',
          newStatus: 'INACTIVE',
          success: true
        });
        
        this.logger.log(`✅ Inactivated: ${plan.name} (${plan.id})`);
      } catch (error) {
        results.push({
          planId: plan.id,
          name: plan.name,
          status: 'failed',
          error: error.message,
          success: false
        });
        
        this.logger.error(`❌ Failed to inactivate: ${plan.name}`);
      }
    }

    return {
      success: true,
      total: activePlans.length,
      inactivated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  } catch (error) {
    this.logger.error('Failed to inactivate all plans:', error);
    throw error;
  }
}

/**
 * Create all plans from constants
 */
async createAllPlansFromConstants(productId: string) {
  productId= 'PROD-3FX667607R695603Y';
  const payablePlans = getPayablePlans(); // Get all paid plans from constants
  
  this.logger.log(`Creating ${payablePlans.length} PayPal plans from constants...`);
  
  const results: Array<{
    planId: string;
    planName: string;
    paypalPlanId?: string;
    price?: string;
    error?: string;
    success: boolean;
  }> = []; // ✅ Added proper type

  for (const plan of payablePlans) {
    try {
      const result = await this.createPaypalPlan(productId, plan.planId);
      
      results.push({
        planId: plan.planId,
        planName: plan.displayName,
        paypalPlanId: result.paypalPlanId,
        price: plan.displayPrice,
        success: true
      });
      
      this.logger.log(`✅ Created: ${plan.displayName} -> ${result.paypalPlanId}`);
      
      // Wait 1 second between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      results.push({
        planId: plan.planId,
        planName: plan.displayName,
        error: error.message,
        success: false
      });
      
      this.logger.error(`❌ Failed: ${plan.displayName} - ${error.message}`);
    }
  }

  return {
    success: true,
    total: payablePlans.length,
    created: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results
  };
}

  // async recreatePaypalPlan(productId: string, planId: string) {
  //   const plan = await this.planModel.findById(planId);

  //   if (!plan) {
  //     throw new Error('Plan not found');
  //   }

  //   if (plan.paypalPlanId) {
  //     await this.deactivatePaypalPlan(plan.paypalPlanId);
  //     await this.planModel.findByIdAndUpdate(planId, {
  //       paypalPlanId: null
  //     });
  //   }

  //   const result = await this.createPaypalPlan(productId, planId);

  //   return {
  //     success: true,
  //     paypalPlanId: result.paypalPlan.id,
  //     planName: result.internalPlan.displayName,
  //     price: result.internalPlan.price,
  //     message: `PayPal plan recreated for ${result.internalPlan.displayName} with updated pricing`
  //   };
  // }

 async activateUserSubscription(userId: string, subscriptionId: string, planId: string) {
  // ✅ Get plan from constants
  const plan = getPlanById(planId);
  
  if (!plan) {
    throw new NotFoundException(`Plan ${planId} not found in constants`);
  }

  const updatedUser = await this.userModel.findByIdAndUpdate(
    userId,
    {
      currentPlan: null, // ✅ No longer storing plan reference
      currentPlanName: plan.planId,
      paypalSubscriptionId: subscriptionId,
      subscriptionActive: true,
      planStartDate: new Date(),
      planEndDate: null,
      'currentLimits.videoLimit': plan.videoAmount,
      'currentLimits.imageLimit': plan.imageAmount,
      'currentLimits.accountLimit': 1, // Default to 1
      'monthlyUsage.videos': 0,
      'monthlyUsage.images': 0,
      'monthlyUsage.resetDate': new Date(),
    },
    { new: true }
  );

  this.logger.log(`✅ User ${userId} activated with ${plan.displayName} plan`);
  return updatedUser;
}


  private getPlanDataByName(planName: string): any {
  this.logger.log(`🔍 Looking up plan data for: "${planName}"`);

  // ✅ Use constants instead of hardcoded map
  const plan = PLANS.find(p => 
    p.planName === planName || 
    p.displayName === planName ||
    p.planId === planName
  );

  if (plan) {
    const result = {
      videoLimit: plan.videoAmount,
      imageLimit: plan.imageAmount,
      accountLimit: 1 // Default to 1, you can add accountLimit to your constants if needed
    };
    
    this.logger.log(`✅ Found plan data:`, result);
    return result;
  }

  this.logger.warn(`⚠️ Plan "${planName}" not found in constants`);
  return null;
}


  // ✅ UPDATED: activateUserSubscriptionDirect with isDuplicate parameter
  async activateUserSubscriptionDirect(
    userId: string, 
    subscriptionId: string,
    planName: string,
    planData: any,
    isDuplicate: boolean = false,
    planStart: Date,
    planEnd: Date,
    status: string
  ) {

    if (!planData) {
      this.logger.warn('⚠️ No plan data provided, using defaults');
      planData = {
        videoLimit: 0,
        imageLimit: 0,
        accountLimit: 0
      };
    }

    this.logger.log(`🔄 Activating user ${userId} with plan ${planName}`);

    // if (status === 'canceled' || status === 'cancelled') {
    //   videoLimit = planData.videoLimit;
    //   imageLimit = planData.imageLimit;
    //   accountLimit = planData.accountLimit;
    // } else {
    //   videoLimit = 0;
    //   imageLimit = 0;
    //   accountLimit = 0;
    // }

    const updateData: any = {
      currentPlanName: planName,
      paypalSubscriptionId: subscriptionId,
      subscriptionActive: status === 'active' ? true : false,
      planStartDate: planStart || new Date(),
      planEndDate: planEnd || null,
      'currentLimits.videoLimit': status === 'active' ? planData.videoLimit : 0,
      'currentLimits.imageLimit': status === 'active' ? planData.imageLimit : 0,
      'currentLimits.accountLimit': status === 'active' ? planData.accountLimit : 1
    };

    // ✅ NEW: Don't reset usage for duplicate/same plan purchase (restocking)
    if (!isDuplicate) {
      updateData['monthlyUsage.videos'] = 0;
      updateData['monthlyUsage.images'] = 0;
      updateData['monthlyUsage.resetDate'] = new Date();
    } else {
      this.logger.log(`⏭️ Not resetting usage (duplicate purchase - restocking)`);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!updatedUser) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    this.logger.log(`✅ User ${userId} activated with ${planName} plan`);
    
    return updatedUser;
  }

  async verifyWebhookSignature(headers: any, webhookData: any): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    
    const verificationData = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: webhookData
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/notifications/verify-webhook-signature`,
        verificationData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(`🔐 Webhook verification result: ${response.data.verification_status}`);
      return response.data.verification_status === 'SUCCESS';
    } catch (error) {
      this.logger.error('Webhook verification failed:', error.response?.data);
      return false;
    }
  }

  async saveWebhookEvent(
  webhookData: any, 
  userId: string, 
  processed: boolean = true, 
  errorMessage?: string | null
) {
  try {
    console.log('💾 [saveWebhookEvent] Starting save...', {
      eventType: webhookData.event_type,
      eventId: webhookData.id,
      userId: userId,
      processed: processed
    });

    const { event_type, id: eventId, resource } = webhookData;

    // ✅ Check if eventId exists
    if (!eventId) {
      this.logger.error('❌ [saveWebhookEvent] No eventId in webhook data');
      return null;
    }

    // ✅ Check for duplicate first (before creating new document)
    const existing = await this.webhookEventModel.findOne({ eventId }).exec();
    if (existing) {
      this.logger.warn(`⚠️ [saveWebhookEvent] Duplicate event: ${eventId}`);
      return existing;
    }

    const subscriptionId = resource?.id || null;
    
    let planName = null;
    try {
      if (resource?.custom_id) {
        const customData = JSON.parse(resource.custom_id);
        planName = customData.planName || null;
      } else if (resource?.plan?.name) {
        planName = resource.plan.name;
      }
    } catch (parseError) {
      this.logger.warn('⚠️ Could not parse planName from webhook data');
    }

    const status = resource?.status || null;
    const payerId = resource?.subscriber?.payer_id || resource?.payer?.payer_id || null;

    let amount: number | null = null;
    let currency: string | null = null;

    if (resource?.billing_info?.last_payment) {
      try {
        amount = parseFloat(resource.billing_info.last_payment.amount.value) * 100;
        currency = resource.billing_info.last_payment.amount.currency_code;
      } catch (amountError) {
        this.logger.warn('⚠️ Could not parse amount from webhook data');
      }
    }

    // ✅ FIX: Handle 'unknown' userId - don't save if invalid
    if (userId === 'unknown' || !userId) {
      this.logger.error('❌ [saveWebhookEvent] Invalid userId, cannot save to DB');
      console.error('Webhook data:', JSON.stringify(webhookData, null, 2));
      return null;
    }

    // ✅ Validate userId is a valid ObjectId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      this.logger.error(`❌ [saveWebhookEvent] Invalid ObjectId format: ${userId}`);
      return null;
    }

    console.log('💾 [saveWebhookEvent] Creating webhook event document...');

    const webhookEvent = new this.webhookEventModel({
      eventType: event_type,
      eventId: eventId,
      userId: userId,
      subscriptionId: subscriptionId,
      planName: planName,
      amount: amount,
      currency: currency,
      status: status,
      payerId: payerId,
      rawData: webhookData,
      processed: processed,
      errorMessage: errorMessage,
      receivedAt: new Date()
    });

    console.log('💾 [saveWebhookEvent] Document created, calling save()...');
    
    const saved = await webhookEvent.save();
    
    console.log('✅ [saveWebhookEvent] Successfully saved!', {
      _id: saved._id,
      eventType: saved.eventType,
      eventId: saved.eventId,
      userId: saved.userId
    });
    
    this.logger.log(`✅ Webhook event saved: ${event_type} for user ${userId}`);
    
    return saved;
  } catch (error) {
    // ✅ Better error logging
    console.error('❌ [saveWebhookEvent] Save failed:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errors: error.errors // Mongoose validation errors
    });

    if (error.code === 11000) {
      this.logger.warn(`⚠️ Duplicate webhook event: ${webhookData.id}`);
      return null;
    }

    if (error.name === 'ValidationError') {
      this.logger.error('❌ Mongoose validation error:', error.errors);
      // Log each validation error
      Object.keys(error.errors).forEach(key => {
        this.logger.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
    
    this.logger.error(`❌ Failed to save webhook event:`, error);
    // ✅ Don't throw - return null so webhook processing can continue
    return null;
  }
}


  async createTransaction(data: {
    userId: string;
    amount: number;
    currency?: string;
    planName: string;
    status: string;
    transactionId: string;
    subscriptionId?: string;
    payerId?: string;
    paymentMethod?: string;
    description?: string;
    expireAt?: Date;
    metadata?: Record<string, any>;
  }) {
    try {
      console.log('💾 Saving transaction:',data, {
        userId: data.userId,
        amount: data.amount,
        planName: data.planName,
        transactionId: data.transactionId
      });

      const transaction = new this.transactionModel({
        userId: data.userId,
        amount: data.amount,
        currency: data.currency || 'USD',
        planName: data.planName,
        status: data.status || 'pending',
        transactionId: data.transactionId,
        subscriptionId: data.subscriptionId || null,
        payerId: data.payerId || null,
        paymentMethod: data.paymentMethod || 'stripe',
        description: data.description || null,
        expireAt: data.expireAt || null,
        metadata: data.metadata ? { ...data.metadata } : null,
      });
console.log('🏗️ Model instance toObject:', JSON.stringify(transaction.toObject(), null, 2));
      const saved = await transaction.save();

      return saved;
    } catch (error) {
      if (error.code === 11000) {
        console.warn(`⚠️ Duplicate transaction ID, updating: ${data.transactionId}`);
        
         const updated = await this.transactionModel.findOneAndUpdate(
      { transactionId: data.transactionId },
      {
        $set: {                                          // ✅ ADD $set
          userId: data.userId,
          amount: data.amount,
          currency: data.currency || 'USD',
          planName: data.planName,
          status: data.status,
          subscriptionId: data.subscriptionId || null,
          payerId: data.payerId || null,
          paymentMethod: data.paymentMethod || 'stripe',
          description: data.description || null,
          expireAt: data.expireAt || null,
          metadata: data.metadata ? { ...data.metadata } : null,
        }
      },
      { new: true }
    );
        
        return updated;
      }
      
      this.logger.error('❌ Failed to save transaction:', error.message);
      throw error;
    }
  }

  async getWebhookEventsByUser(userId: string, limit: number = 50) {
    return this.webhookEventModel
      .find({ userId })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .exec();
  }

  async getAllWebhookEvents(limit: number = 100) {
    return this.webhookEventModel
      .find()
      .populate('userId', 'name email')
      .sort({ receivedAt: -1 })
      .limit(limit)
      .exec();
  }

  async getWebhookEventsBySubscription(subscriptionId: string) {
    return this.webhookEventModel
      .find({ subscriptionId })
      .sort({ receivedAt: -1 })
      .exec();
  }

  // async getTransactionsByUser(userId: string, limit: number = 50) {
  //   const transactions = await this.transactionModel
  //     .find({ userId })
  //     .populate('_id', 'name email role')
  //     .sort({ createdAt: -1 })
  //     .limit(limit)
  //     .exec();

  //      const enrichedTransactions = await Promise.all(
  //       transactions.map(async (txn: any) => {
  //         const user = await this.userModel.findById(txn.userId);

  //         return {
  //           ...txn.toObject(),
  //           user: user
  //             ? {
  //                 name: user.name,
  //                 email: user.email,
  //                 role: user.role,
  //               }
  //             : null,
  //         };
  //       }),
  //     );

  //   return enrichedTransactions;
  // }

  async getTransactionsByUser(userId: string, limit: number = 50) {
  const [transactions, user] = await Promise.all([
    this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec(),
    this.userModel.findById(userId),
  ]);

  return transactions.map((txn: any) => ({
    ...txn.toObject(),

    user: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
        }
      : null,

    invoice: {
      companyName: 'Samba',
      companyEmail: 'support@samba.com',
      companyLogo: `${process.env.APP_URL}/public/logo.png`,

      from: 'Samba',
      to: user?.email || null,

      planName: txn.planName,
      price: txn.amount,
      priceFormatted: `$${(txn.amount / 100).toFixed(2)}`,

      startDate: txn.createdAt,
      expiryDate: txn.expireAt || null,

      invoiceId: `INV-${txn._id.toString().slice(-6).toUpperCase()}`,
      transactionId: txn._id,
    },
  }));
}

  async getAllTransactions(limit: number = 100) {
    return this.transactionModel
      .find()
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getTransactionsBySubscription(subscriptionId: string) {
    return this.transactionModel
      .find({ subscriptionId })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ✅ NEW: Downgrade user to FREE plan
async downgradeToFreePlan(userId: string) {
  try {
    console.log(`🔽 Downgrading user ${userId} to FREE plan...`);

    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // ✅ Define FREE plan limits
    const freePlanLimits = {
      videoLimit: 2,
      imageLimit: 4,
      accountLimit: 1
    };

    // ✅ Update user to FREE plan
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          currentPlanName: 'Free Plan',
          subscriptionActive: false,
          paypalSubscriptionId: null,
          currentLimits: freePlanLimits,
          'monthlyUsage.videos': 0,
          'monthlyUsage.images': 0,
          'monthlyUsage.resetDate': new Date(),
          subscriptionCancelledAt: new Date(),
          planEndDate: new Date()
        }
      },
      { new: true }
    );

    console.log('✅ User downgraded to FREE plan:', {
      userId: userId,
      newPlan: 'Free Plan',
      limits: freePlanLimits
    });

    return updatedUser;
  } catch (error) {
    console.error('❌ Error downgrading to free plan:', error);
    throw error;
  }
}
async getAllPlansWithDetailsCachedold() {
    const now = Date.now();

    // Return cached data if still valid
    if (this.plansCache && (now - this.plansCacheTimestamp < this.CACHE_DURATION)) {
      console.log('✅ Returning cached plans (age: ' + Math.floor((now - this.plansCacheTimestamp) / 1000) + 's)');
      return {
        success: true,
        plans: this.plansCache,
        cached: true,
        cacheAge: now - this.plansCacheTimestamp
      };
    }

    try {
      console.log('🔄 Fetching fresh plans from PayPal...');
      
      // Fetch from PayPal (your existing logic)
      const plansListResponse = await this.listPaypalPlans();
      
      if (!plansListResponse.success) {
        // If API fails but we have stale cache, return it
        if (this.plansCache) {
          console.warn('⚠️ API failed, returning stale cache');
          return {
            success: true,
            plans: this.plansCache,
            cached: true,
            stale: true
          };
        }
        throw new Error('Failed to fetch plans list');
      }

      const activePlans = plansListResponse.plans.filter(plan => plan.status === 'ACTIVE');
      console.log(`✅ Found ${activePlans.length} active plans`);

      const plansWithDetails = await Promise.all(
        activePlans.map(async (plan) => {
          try {
            const detailsResponse = await this.getPaypalPlan(plan.id);
            
            const billingCycle = detailsResponse.billing_cycles?.[0];
            const priceValue = billingCycle?.pricing_scheme?.fixed_price?.value;
            const price = priceValue ? parseFloat(priceValue) : 0;

            const planNameLower = plan.name.toLowerCase();
            let matchedConstantPlan = PLANS.find(p => 
              p.planName.toLowerCase() === planNameLower ||
              p.displayName.toLowerCase() === planNameLower ||
              planNameLower.includes(p.planName.toLowerCase().replace(/\s+/g, '')) ||
              planNameLower.includes(p.planId.toLowerCase())
            );

            const videoLimit = matchedConstantPlan?.videoAmount || 0;
            const imageLimit = matchedConstantPlan?.imageAmount || 0;
            const accountLimit = 1;
            const isPopular = matchedConstantPlan?.isPopular || false;

            return {
              _id: plan.id,
              paypalPlanId: plan.id,
              planId: (matchedConstantPlan?.planId || plan.name).replace(/\s+/g, '-'),
              name: (matchedConstantPlan?.planId || plan.name).replace(/\s+/g, '-'),
              displayName: plan.name,
              price: price,
              priceInCents: Math.round(price * 100),
              currency: 'USD',
              description: plan.description || matchedConstantPlan?.description || '',
              isPopular: isPopular,
              videoLimit: videoLimit,
              imageLimit: imageLimit,
              accountLimit: accountLimit,
              status: plan.status,
              billingInterval: billingCycle?.frequency?.interval_unit || 'MONTH',
              billingIntervalCount: billingCycle?.frequency?.interval_count || 1,
            };
          } catch (error) {
            console.error(`❌ Failed to fetch details for plan ${plan.id}:`, error.message);
            return null;
          }
        })
      );

      const validPlans = plansWithDetails.filter(plan => plan !== null);

      // ✅ Update cache
      this.plansCache = validPlans;
      this.plansCacheTimestamp = now;

      console.log(`✅ Plans cached successfully (${validPlans.length} plans)`);

      return {
        success: true,
        plans: validPlans,
        total: validPlans.length,
        cached: false
      };
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      
      // Return stale cache if available
      if (this.plansCache) {
        console.warn('⚠️ Returning stale cache due to error');
        return {
          success: true,
          plans: this.plansCache,
          cached: true,
          stale: true,
          error: error.message
        };
      }

      throw error;
    }
  }

async getAllPlansWithDetailsCached() {
  const now = Date.now();

  // ✅ Return cache if valid
  if (
    this.plansCache &&
    now - this.plansCacheTimestamp < this.CACHE_DURATION
  ) {
    console.log(
      `✅ Returning cached Stripe plans (age: ${Math.floor(
        (now - this.plansCacheTimestamp) / 1000
      )}s)`
    );

    return {
      success: true,
      plans: this.plansCache,
      cached: true,
      cacheAge: now - this.plansCacheTimestamp,
    };
  }

  try {
    console.log('🔄 Fetching fresh plans from Stripe...');

    // 1️⃣ Fetch prices + expand product
    const prices = await this.stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    // 2️⃣ Filter allowed plans
    // const allowedNames = ['1 month', '6 month', '1 year'];

    const activePrices = prices.data.filter((price) => {
      const productName =
        (price.product as any)?.name?.toLowerCase() || '';
      // return allowedNames.includes(productName);
      return productName;
    });

    console.log(`✅ Found ${activePrices.length} active Stripe plans`);

    // 3️⃣ Normalize plans
    const plansWithDetails = activePrices.map((price) => {
      const product: any = price.product;
      const productName = product?.name || 'Unknown';

      const matchedPlan = PLANS.find((p) =>
        p.planName.toLowerCase() === productName.toLowerCase()
      );

      const amount = price.unit_amount || 0;
      const currency = price.currency?.toUpperCase() || 'USD';

      return {
        _id: price.id,
        stripePriceId: price.id,
        stripeProductId: product?.id,

        planId: matchedPlan?.planId || productName.replace(/\s+/g, '-').toLowerCase(),
        name: matchedPlan?.planId || productName.replace(/\s+/g, '-').toLowerCase(),
        displayName: productName,

        price: amount / 100,
        priceInCents: amount,
        currency,

        description:
          product?.description || matchedPlan?.description || '',

        isPopular: matchedPlan?.isPopular || false,

        videoLimit: matchedPlan?.videoAmount || 0,
        imageLimit: matchedPlan?.imageAmount || 0,
        accountLimit: 1,

        status: price.active ? 'ACTIVE' : 'INACTIVE',

        billingInterval: price.recurring?.interval?.toUpperCase() || 'MONTH',
        billingIntervalCount: price.recurring?.interval_count || 1,
      };
    });

    // 4️⃣ Update cache
    this.plansCache = plansWithDetails;
    this.plansCacheTimestamp = now;

    console.log(`✅ Stripe plans cached (${plansWithDetails.length})`);

    return {
      success: true,
      plans: plansWithDetails,
      total: plansWithDetails.length,
      cached: false,
    };
  } catch (error) {
    console.error('❌ Error fetching Stripe plans:', error);

    // ⚠️ Return stale cache if available
    if (this.plansCache) {
      console.warn('⚠️ Returning stale Stripe cache');

      return {
        success: true,
        plans: this.plansCache,
        cached: true,
        stale: true,
        error: error.message,
      };
    }

    throw error;
  }
}

  async createSubscriptionAuto(
  email: string,
  priceId: string,
  paymentMethodId: string,
  metadata?: {
    userId?: string;
  }
) {
  const stripe = this.stripe as Stripe;

  // 1. Find or create customer
  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer =
    customers.data[0] ?? (await stripe.customers.create({ email, metadata: {
        userId: metadata?.userId ?? '',
      }, }));

  // 2. Attach payment method & set as default
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customer.id,
  });

  await stripe.customers.update(customer.id, {
    metadata: {
      userId: metadata?.userId ?? '',
    },
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  // 3. Create AUTO subscription
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    collection_method: 'charge_automatically', // ✅ AUTO BILLING
    default_payment_method: paymentMethodId,
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    metadata: {
      userId: metadata?.userId ?? '',
    },
    expand: ['latest_invoice.payment_intent'],
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice | null;
  const paymentIntent = (invoice as any)?.payment_intent as Stripe.PaymentIntent | null;

  // 4. If payment required, return client secret
  if (paymentIntent?.status === 'requires_action') {
    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: paymentIntent.client_secret,
    };
  }

  // 5. Otherwise subscription is active
  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    clientSecret: null,
  };
}


// 2. Create Checkout Session (by aman on 18 march
async createCheckoutSession(body: {
  priceId: string;
  email: string;
  userId?: string;
}) {
  const stripe = this.stripe;

  // 1. (Optional but recommended) Find or create customer
  const existingCustomers = await stripe.customers.list({
    email: body.email,
    limit: 1,
  });

  const customer =
    existingCustomers.data[0] ??
    (await stripe.customers.create({
      email: body.email,
      metadata: {
        userId: body.userId ?? '',
      },
    }));

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', // 🔥 important for recurring

    customer: customer.id, // use existing customer

    payment_method_types: ['card'],

    line_items: [
      {
        price: body.priceId, // from Stripe dashboard
        quantity: 1,
      },
    ],

    success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing`,

    metadata: {
      userId: body.userId ?? '',
    },

    subscription_data: {
      metadata: {
        userId: body.userId ?? '',
      },
    },
  });

  // 3. Return URL for redirect
  return {
    url: session.url,
  };
}


  async verifyAndProcess(req: any): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      throw new BadRequestException('Missing Stripe signature');
    }

    let event: Stripe.Event;

    try {
      // Use a local rawBody variable with a safe fallback since `rawBody` isn't on the Express Request type
      const rawBody = (req as any).rawBody ?? (typeof req.body === 'string'
        ? Buffer.from(req.body)
        : Buffer.from(JSON.stringify(req.body ?? {})));

      console.log('Stripe raw body buffer:', Buffer.isBuffer(req.rawBody));
      console.log('Stripe raw body buffer2:', Buffer.isBuffer(req.body));
      event = this.stripe.webhooks.constructEvent(
        req.body, // 👈 RAW BUFFER
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );

      console.log('✅ Stripe webhook signature verified',event);
    } catch (err: any) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    await this.processStripeEvent(event);
  }

  private async getPlanByPriceId(priceId: string) {
    try {
      const priceData = await this.stripe.prices.retrieve(priceId, {
        expand: ['product'],
      });
      return {
        success: true,
        plan: priceData,
      };
    } catch (error) {
      console.error('❌ Error fetching Stripe plan:', error);
      throw new BadRequestException('Failed to retrieve plan');
    }
  }

  private async processStripeEvent(event: Stripe.Event) {
    console.log('Processing Stripe event:', event.type);
    // console.log('Event data:', event.data);
    const buildMetadata = (
    sub: Stripe.Subscription,
    item: any,
    product: any,
    type: string
  ) => ({
    type,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: String(sub.customer),
    stripePriceId: item?.price?.id,
    stripeProductId: product?.id,
    currentPeriodStart: item?.current_period_start,
    currentPeriodEnd: item?.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    subStatus: sub.status,
  });

    switch (event.type) {

    
      /* ==============================
         SUBSCRIPTION CREATED
      ============================== */
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];
        const planInfo = await this.getPlanByPriceId(item?.price?.id);
        // Normalize product which can be string | Product | DeletedProduct
        const product = planInfo.plan?.product as Stripe.Product;
console.log('🔍 [STRIPE created] RAW sub object keys:', Object.keys(sub));
  console.log('🔍 [STRIPE created] item:', JSON.stringify(item, null, 2));
  console.log('🔍 [STRIPE created] product:', JSON.stringify(product, null, 2));
  console.log('🔍 [STRIPE created] sub.metadata:', sub.metadata);
  console.log('🔍 [STRIPE created] sub.customer:', sub.customer);
        await this.createTransaction({
          userId: String(sub.metadata?.userId || sub.customer),
          amount: item?.price?.unit_amount || 0,
          currency: sub.currency || 'USD',
          planName: product.name,
          status: sub.status,
          transactionId: `${sub.id}`,
          subscriptionId: sub.id,
          payerId: String(sub.customer),
          paymentMethod: 'stripe',
          description: `Subscription activated: ${product.name}`,
          expireAt: new Date(item?.current_period_end * 1000),
          metadata: buildMetadata(sub, item, product, 'SUBSCRIBE'), 

        });

        let planData = this.getPlanDataByName(product.name);
    
        if (!planData) {
          this.logger.warn(`⚠️ Plan ${product.name} not found in mapping, using defaults`);
          planData = { videoLimit: 0, imageLimit: 0, accountLimit: 0 };
        }

        const finalLimits = await this.calculateCarryoverLimits(sub.metadata?.userId, planData);

        await this.activateUserSubscriptionDirect(
          String(sub.metadata?.userId || sub.customer),
          sub.id,
          product.name,
          finalLimits,
          false,
          new Date(item?.current_period_start * 1000),
          new Date(item?.current_period_end * 1000),
          sub.status
        );

        break;
      }

      /* ==============================
         SUBSCRIPTION UPDATED
      ============================== */
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];
        const planInfo = await this.getPlanByPriceId(item?.price?.id);
        // Normalize product which can be string | Product | DeletedProduct
        const product = planInfo.plan?.product as Stripe.Product;

        await this.createTransaction({
          userId: String(sub.metadata?.userId || sub.customer),
          amount: item?.price?.unit_amount || 0,
          currency: sub.currency || 'USD',
          planName: product.name,
          status: sub.status,
          transactionId: `${sub.id}`,
          subscriptionId: sub.id,
          payerId: String(sub.customer),
          paymentMethod: 'stripe',
          description: `Subscription activated: ${product.name}`,
          expireAt: new Date(item?.current_period_end * 1000),
          metadata: buildMetadata(sub, item, product, 'UPDATE'),

        });

          // 🔥 IMPORTANT PART
        //    if (sub.status !== 'active') {
        //      // Check if user still has ACTIVE subscriptions
        //   const activeSubscriptions = await this.transactionModel.countDocuments({
        //     userId: String(sub.metadata?.userId || sub.customer),
        //     status: 'active',
        //   });

        //   console.log('Active subscriptions count:', activeSubscriptions);

        //   // 🚫 If user still has active subscription → DO NOTHING
        //   if (activeSubscriptions > 0) {
        //     console.log('User still has active subscription. Skipping downgrade.');
        //     break;
        //   }

        // let planData = this.getPlanDataByName(product.name);
    
        // if (!planData) {
        //   this.logger.warn(`⚠️ Plan ${product.name} not found in mapping, using defaults`);
        //   planData = { videoLimit: 0, imageLimit: 0, accountLimit: 0 };
        // }

        // const finalLimits = await this.calculateCarryoverLimits(sub.metadata?.userId, planData);

        // await this.activateUserSubscriptionDirect(
        //   String(sub.metadata?.userId || sub.customer),
        //   sub.id,
        //   product.name,
        //   finalLimits,
        //   false,
        //   new Date(item?.current_period_start * 1000),
        //   new Date(item?.current_period_end * 1000),
        //   sub.status
        // );
        // }
         
        break;
      }

      /* ==============================
         SUBSCRIPTION DELETED
      ============================== */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];
        const planInfo = await this.getPlanByPriceId(item?.price?.id);
        // Normalize product which can be string | Product | DeletedProduct
        const product = planInfo.plan?.product as Stripe.Product;

        await this.createTransaction({
          userId: String(sub.metadata?.userId || sub.customer),
          amount: item?.price?.unit_amount || 0,
          currency: sub.currency || 'USD',
          planName: product.name,
          status: sub.status,
          transactionId: `${sub.id}`,
          subscriptionId: sub.id,
          payerId: String(sub.customer),
          paymentMethod: 'stripe',
          description: `Subscription activated: ${product.name}`,
          expireAt: new Date(item?.current_period_end * 1000),
         metadata: buildMetadata(sub, item, product, 'CANCEL'), 
        });

        // 🔥 IMPORTANT PART
          // Check if user still has ACTIVE subscriptions
          const activeSubscriptions = await this.transactionModel.countDocuments({
            userId: String(sub.metadata?.userId || sub.customer),
            status: 'active',
          });

          console.log('Active subscriptions count:', activeSubscriptions);

          // 🚫 If user still has active subscription → DO NOTHING
          if (activeSubscriptions == 1) {
            console.log('User still has active subscription. Skipping downgrade.');
            break;
          }


        let planData = this.getPlanDataByName(product.name);
    
        if (!planData) {
          this.logger.warn(`⚠️ Plan ${product.name} not found in mapping, using defaults`);
          planData = { videoLimit: 0, imageLimit: 0, accountLimit: 0 };
        }

        const finalLimits = await this.calculateCarryoverLimits(sub.metadata?.userId, planData);

        await this.activateUserSubscriptionDirect(
          String(sub.metadata?.userId || sub.customer),
          "",
          "",
          finalLimits,
          false,
          new Date(item?.current_period_start * 1000),
          new Date(item?.current_period_end * 1000),
          sub.status
        ); 
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }


 /**
   * Get subscriptions by metadata (ex: userId)
   */
  async getSubscriptionsByMetadata(
    metadataKey: string,
    metadataValue: string,
  ) {
    const subscriptions = await this.stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.items.data.price.product'],
    });

    return subscriptions.data
      .filter(
        (sub) => sub.metadata?.[metadataKey] === metadataValue,
      )
      .map(this.normalizeSubscription);
  }

  /**
   * Get subscriptions by customer email
   */
  async getSubscriptionsByCustomerEmail(email: string) {
    const customers = await this.stripe.customers.list({
      email,
      limit: 1,
    });

    if (!customers.data.length) {
      throw new NotFoundException('Stripe customer not found');
    }

    return this.getSubscriptionsByCustomerId(customers.data[0].id);
  }

   /**
   * Get subscriptions by customer ID
   */
  async getSubscriptionsByCustomerId(customerId: string) {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.items.data.price.product'],
    });

    return subscriptions.data.map(this.normalizeSubscription);
  }

   /**
   * Normalize Stripe subscription for frontend use
   */
  private normalizeSubscription(sub: Stripe.Subscription) {
    const item = sub.items.data[0];
    const price = item.price;
    const product = price.product as Stripe.Product;

    return {
      subscriptionId: sub.id,
      customerId: sub.customer,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,

      // currentPeriodStart: new Date(sub?.current_period_start * 1000),
      // currentPeriodEnd: new Date(sub?.current_period_end * 1000),

      plan: {
        priceId: price.id,
        productId: product.id,
        productName: product.name,
        amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval,
        intervalCount: price.recurring?.interval_count,
      },

      metadata: sub.metadata,
      createdAt: new Date(sub.created * 1000),
    };
  }


}