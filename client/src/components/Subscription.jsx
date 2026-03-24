import { Zap, Video, Image as ImageIcon, CheckCircle2, ArrowUpRight, Ban, Sparkles } from "lucide-react";

const Subscription = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

      <div className="px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">

        {/* Left — plan info */}
        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Zap size={10} className="text-white" />
            </div>
            <span className="text-[11px] font-bold text-purple-500 uppercase tracking-widest">Active Subscription</span>
          </div>

          {/* Plan name + badge */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h2 className="text-2xl font-extrabold text-gray-900">Basic Plan</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 size={10} />
              Active
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-4 max-w-sm">
            Elevate your content creation with our essential AI tools and features.
          </p>

          {/* Usage pills */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-xl">
              <Video size={13} className="text-purple-500" />
              <span className="text-xs font-bold text-purple-700">4 Videos</span>
              <span className="text-[10px] text-purple-400">/mo</span>
            </div>
            <div className="flex items-center gap-1.5 bg-pink-50 border border-pink-100 px-3 py-1.5 rounded-xl">
              <ImageIcon size={13} className="text-pink-500" />
              <span className="text-xs font-bold text-pink-700">4 Images</span>
              <span className="text-[10px] text-pink-400">/mo</span>
            </div>
          </div>
        </div>

        {/* Right — price + actions */}
        <div className="flex flex-col items-start sm:items-end gap-4 w-full sm:w-auto">
          <div className="text-left sm:text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">$10</span>
              <span className="text-sm text-gray-400">/month</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Billed monthly · Renews Feb 28</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                const el = document.getElementById("pricing");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex items-center justify-center gap-2 h-9 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-200 hover:from-purple-500 hover:to-pink-400 transition-all"
            >
              <Sparkles size={12} />
              Upgrade Plan
              <ArrowUpRight size={12} />
            </button>
            <button
              className="flex items-center justify-center gap-2 h-9 px-5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Ban size={12} />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
