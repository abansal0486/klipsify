// src/plans/constants/plans.constants.ts
export interface PlanFeatures {
  planId: string;           // Internal ID (e.g., 'free-flight')
  planName: string;         // Plan name (e.g., 'Free Flight')
  displayName: string;      // Display name for UI (same as planName or custom)
  description: string;      // Plan description
  videoAmount: number;      // Monthly video limit
  imageAmount: number;      // Monthly image limit
  autoPosting: boolean;     // Auto posting feature
  price: number;           // Price in cents (e.g., 6900 = $69)
  displayPrice: string;    // Display price for UI (e.g., '$69')
  planType: 'free' | 'starter' | 'pro' | 'business' | 'enterprise' | 'custom';
  isPopular?: boolean;
  paypalPlanId?: string;   // Only for paid plans
}

export const PLANS: readonly PlanFeatures[] = [
  {
    planId: 'free-flight',
    planName: 'Free Flight',
    displayName: 'Free Flight',
    description: 'Free to start, easy take off',
    videoAmount: 4,
    imageAmount: 10,
    autoPosting: false,
    price: 0,
    displayPrice: '$0',
    planType: 'free',
  },
  {
    planId: 'airborn',
    planName: 'Airborn',
    displayName: 'Airborn',
    description: 'Unleash your creativity',
    videoAmount: 10,
    imageAmount: 40,
    autoPosting: true,
    price: 6900, // $69
    displayPrice: '$69',
    planType: 'starter',
  },
  {
    planId: 'gladiator',
    planName: 'Gladiator',
    displayName: 'Gladiator',
    description: 'Boost your marketing reach',
    videoAmount: 30,
    imageAmount: 100,
    autoPosting: true,
    price: 12400, // $124
    displayPrice: '$124',
    planType: 'pro',
    isPopular: true,
  },
  {
    planId: 'samurai',
    planName: 'Samurai',
    displayName: 'Samurai',
    description: 'Creative power for unstoppable growth',
    videoAmount: 150,
    imageAmount: 300,
    autoPosting: true,
    price: 59900, // $599
    displayPrice: '$599',
    planType: 'business',
  },
  {
    planId: 'ninja-agency',
    planName: 'Ninja - Agency',
    displayName: 'Ninja - Agency',
    description: 'Built for elite creators',
    videoAmount: 1000,
    imageAmount: 2000,
    autoPosting: true,
    price: 289000, // $2890
    displayPrice: '$2890',
    planType: 'enterprise',
  },
  {
    planId: 'infinity',
    planName: 'INFINITY',
    displayName: 'INFINITY',
    description: '∞',
    videoAmount: -1, // Unlimited
    imageAmount: -1, // Unlimited
    autoPosting: true,
    price: 0,
    displayPrice: 'CONTACT US',
    planType: 'custom',
  },
] as const;

// Helper functions
export const getPlanById = (planId: string): PlanFeatures | undefined => {
  return PLANS.find(plan => plan.planId === planId);
};

export const getPayablePlans = (): PlanFeatures[] => {
  // Only return plans that need PayPal integration
  return PLANS.filter(plan => 
    plan.price > 0 && 
    plan.planType !== 'free' && 
    plan.planType !== 'custom'
  );
};

export const getFreePlan = (): PlanFeatures => {
  return PLANS.find(plan => plan.planType === 'free')!;
};
