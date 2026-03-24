import { Sparkles } from "lucide-react";
import SubscriptionCard from "../../components/Subscription";
import Pricing from "../../components/Pricing";

const SubscriptionPage = () => {
  return (
    <div className="min-h-full px-4 md:px-6 pt-8 pb-12">

      {/* ── PAGE HEADER ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shadow-purple-200">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">Billing</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
          Subscription
        </h1>
        <p className="text-sm text-gray-400 mt-1">Manage your plan and billing preferences</p>
      </div>

      {/* ── CURRENT PLAN ── */}
      <div className="max-w-2xl mb-8">
        <SubscriptionCard />
      </div>

      {/* ── DIVIDER ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent mb-8" />

      {/* ── PRICING PLANS ── */}
      <Pricing />

    </div>
  );
};

export default SubscriptionPage;
