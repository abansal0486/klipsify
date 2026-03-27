import React, { useState } from "react";
import { FaCheck, FaChevronUp, FaChevronDown } from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { fetchPlans, createCheckoutSession } from "../redux/actions/paymentActions";

const Pricing = () => {
  const [selected, setSelected] = useState("monthly");
  const [expandedPlan, setExpandedPlan] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const { plans: apiPlans } = useSelector((state) => state.payment);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  React.useEffect(() => {
    console.log("Pricing component mounted, fetching plans...");
    dispatch(fetchPlans());
  }, [dispatch]);

  console.log("Current API Plans:", apiPlans);

  const handleChoosePlan = async (plan) => {
    console.log("Plan chosen:", plan.name, "Selected period:", selected);

    if (plan.name === "Free Flight") {
      navigate("/dashboard");
      return;
    }

    try {
      // Extract priceId from prefetched apiPlans
      const interval = selected === "monthly" ? "MONTH" : "YEAR";
      console.log("Searching for interval:", interval, "in apiPlans");
      const apiPlan = apiPlans.find(
        (ap) =>
          ap.displayName.toLowerCase() === plan.name.toLowerCase() &&
          ap.billingInterval === interval
      );

      const priceId = apiPlan?.stripePriceId;

      if (!priceId) {
        toast.error(`Stripe Price ID not found for ${plan.name} (${selected}).`);
        return;
      }

      if (!user?.email) {
        toast.info("Please sign up first to add your email for the session.");
      }

      const email = user?.email || "anonymous@example.com";
      const userId = user?._id || user?.id || "";

      dispatch(createCheckoutSession(priceId, email, userId));
    } catch (error) {
      console.error("Stripe session error:", error);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const togglePlan = (name) => {
    setExpandedPlan((prev) => (prev === name ? null : name));
  };

  const allPlans = [
    {
      name: "Free Flight",
      monthlyPrice: "$0",
      yearlyPrice: "$0",
      description: "Free to start, easy take off",
      features: [
        { name: "Videos", value: "4" },
        { name: "Images", value: "10" },
        { name: "Auto Posting", value: "Off" },
      ],
      moreFeatures: [
        "2 team members",
        "512 MB media storage",
        "10 AI credit per month",
        "AI chat assistant",
        "Custom scheduling rules",
        "Built upload & editing",
        "Bulk upload & editing",
        "Performance reporting",
      ],
      popular: false,
      cta: "Start Free",
      stripePriceIdMonthly: "", // Free plan usually doesn't need a Stripe Price ID unless you want to track it
      stripePriceIdYearly: "",
    },
    {
      name: "Airborn",
      monthlyPrice: "$69",
      yearlyPrice: "$100",
      description: "Unleash your creativity",
      features: [
        { name: "Videos", value: "10" },
        { name: "Images", value: "40" },
        { name: "Auto Posting", value: "Yes" },
      ],
      moreFeatures: [
        "5 team members",
        "2 GB media storage",
        "50 AI credit per month",
        "AI chat assistant",
        "Custom scheduling rules",
        "Built upload & editing",
        "Bulk upload & editing",
        "Performance reporting",
      ],
      popular: true,
      cta: "Choose Plan",
      stripePriceIdMonthly: "", 
      stripePriceIdYearly: "",
    },
    {
      name: "Gladiator",
      monthlyPrice: "$124",
      yearlyPrice: "$150",
      description: "Boost your marketing reach",
      features: [
        { name: "Videos", value: "30" },
        { name: "Images", value: "100" },
        { name: "Auto Posting", value: "yes" },
      ],
      moreFeatures: [
        "10 team members",
        "10 GB media storage",
        "200 AI credit per month",
        "AI chat assistant",
        "Custom scheduling rules",
        "Built upload & editing",
        "Bulk upload & editing",
        "Performance reporting",
      ],
      popular: false,
      cta: "Choose Plan",
      stripePriceIdMonthly: "", 
      stripePriceIdYearly: "",
    },
  ];

  return (
    <section
      id="pricing"
      className="relative py-10 md:pt-[50px] overflow-hidden font-montserrat"
      style={{
        background:
          "linear-gradient(135deg, #fbc8d4 0%, #f5eef8 40%, #c9d8f9 100%)",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 md:px-20">
        <div className="text-center space-y-4 md:mb-16  mb-10">
          <h2 className="text-lg md:text-[38px] font-bold text-black tracking-wider">
            Flexible Plans for Every Creator
          </h2>
          <p className="text-xs md:text-[14px] text-gray-700 font-medium max-w-3xl mx-auto opacity-80">
            Powerful AI tools designed to help you create, schedule, and grow
            your social presence.
          </p>
        </div>

        <div className="flex flex-row justify-center items-center gap-4 md:mb-[40px] mb-[20px] bg-white/40 backdrop-blur-sm rounded-full w-fit mx-auto p-2 -mt-5">
          <button
            onClick={() => setSelected("monthly")}
            className={`rounded-full text-[12px] md:text-[14px] font-medium cursor-pointer py-2 md:py-3 px-8 md:px-14 tracking-wider transition-all duration-300 ${
              selected === "monthly"
                ? "bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white"
                : "bg-white/40 text-black border border-black"
            }`}
          >
            Monthly
          </button>

          <button
            onClick={() => setSelected("yearly")}
            className={`rounded-full text-[12px] md:text-[14px] font-medium cursor-pointer py-2 md:py-3 px-8 md:px-14 tracking-wider transition-all duration-300 ${
              selected === "yearly"
                ? "bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white"
                : "bg-white/40 text-black border border-black"
            }`}
          >
            Yearly
          </button>
        </div>

        <div className="bg-white/30 backdrop-blur-sm rounded-3xl p-4 md:p-8 mb-8 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
            {allPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-[2.5px] transition-all duration-500 group relative
                  ${
                    plan.popular
                      ? "md:-mx-3 z-10 transform md:-translate-y-10 md:scale-105 hover:md:-translate-y-16"
                      : "hover:-translate-y-6"
                  }`}
                style={{
                  background:
                    "linear-gradient(77.72deg, #1869CC 4.2%, #742AFE 47.06%, #E30BEB 100%)",
                }}
              >
                <div
                  onClick={() => handleChoosePlan(plan)}
                  className={`relative rounded-2xl p-6 md:p-6 flex flex-col transition-all duration-500 cursor-pointer h-full
                    hover:bg-[#3D3470] hover:shadow-[0_20px_40px_rgba(61,52,112,0.4)]
                    ${
                      plan.popular
                        ? "bg-[#1E1B4B] text-white"
                        : "bg-white text-[#231D4F] shadow-lg"
                    } ${expandedPlan === plan.name ? (plan.popular ? "ring-1 ring-purple-400/50" : "ring-1 ring-purple-400/50 shadow-[0_0_20px_rgba(139,92,246,0.3)]") : ""}`}
                >
                  {plan.popular && (
                    <div
                      className="absolute top-3 right-3 px-3 py-1.5 tracking-wider rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "#3D3470", color: "#E879F9" }}
                    >
                      MOST POPULAR
                    </div>
                  )}

                  <div className="text-center space-y-4 flex-grow md:min-h-[310px]">
                    <div className="space-y-2 flex flex-col items-start justify-start w-full">
                      <div
                        className={`text-xl md:text-[36px] items-start justify-start transition-colors duration-300 font-bold ${plan.popular ? "text-white mt-4 md:mt-10" : "text-[#231D4F] group-hover:text-white"}`}
                        style={{
                          lineHeight: "46px",
                          letterSpacing: "0px",
                        }}
                      >
                        {selected === "monthly"
                          ? plan.monthlyPrice
                          : plan.yearlyPrice}{" "}
                        <span className="text-[14px] md:text-[17px] font-light text-gray-400 group-hover:text-white/60">
                          /month
                        </span>
                      </div>
                      <h3
                        className={`text-lg md:text-[28px] mt-4 font-medium transition-colors duration-300 ${plan.popular ? "text-white" : "text-black group-hover:text-white"}`}
                      >
                        {plan.name}
                      </h3>
                      <div
                        className={`text-[13px] md:text-[15px] mt-1 text-left w-full transition-colors duration-300 ${plan.popular ? "text-white/80" : "text-[#848199]/60 group-hover:text-white/80"}`}
                      >
                        {plan.description}
                      </div>
                    </div>

                    <div className="space-y-4 mt-6">
                      {plan.features.map((feature, featureIndex) => (
                        <div
                          key={featureIndex}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E9E1FF] flex items-center justify-center group-hover:bg-[#4D4480]">
                              <FaCheck className="w-2.5 h-2.5 text-[#A855F7] group-hover:text-white" />
                            </div>
                            <span
                              className={`text-[13px] md:text-[15px] transition-colors duration-300 ${plan.popular ? "text-white" : "text-[#848199] group-hover:text-white"}`}
                            >
                              {feature.name}
                            </span>
                          </div>
                          <span
                            className={`text-[13px] md:text-[15px] transition-colors duration-300 ${plan.popular ? "text-white" : "text-[#848199] group-hover:text-white"}`}
                          >
                            {feature.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4 ">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlan(plan.name);
                        }}
                        className="flex items-center justify-center gap-2 group cursor-pointer"
                      >
                        <div
                          className="p-[1px] rounded-full transition-all duration-300"
                          style={{
                            background:
                              expandedPlan === plan.name
                                ? "linear-gradient(77.72deg, #1869CC 4.2%, #742AFE 47.06%, #E30BEB 100%)"
                                : "",
                          }}
                        >
                          <h2
                            className={`flex items-center gap-2 text-[10px] md:text-[12px] font-medium px-4 md:px-6 py-2 rounded-full transition-all duration-300 ${
                              plan.popular
                                ? "bg-[#231D4F] group-hover:bg-[#4D4480]"
                                : "bg-white group-hover:bg-white/10"
                            }`}
                          >
                            {" "}
                            {expandedPlan === plan.name ? (
                              <FaChevronUp
                                className={`w-3 h-3 ${plan.popular ? "text-white" : "text-black group-hover:text-white"}`}
                              />
                            ) : (
                              <FaChevronDown
                                className={`w-3 h-3 ${plan.popular ? "text-[#adadad]" : "text-[#adadad] group-hover:text-white/70"}`}
                              />
                            )}
                            <span
                              className={
                                expandedPlan === plan.name
                                  ? plan.popular
                                    ? "text-white"
                                    : "text-black group-hover:text-white"
                                  : plan.popular
                                    ? "text-[#adadad]"
                                    : "text-[#adadad] group-hover:text-white/70"
                              }
                            >
                              {expandedPlan === plan.name
                                ? "Show Less Features"
                                : "Show More Features"}
                            </span>
                          </h2>
                        </div>
                      </div>

                      {expandedPlan === plan.name && (
                        <div className="space-y-3 mt-4 text-left animate-fadeIn md:ml-2">
                          {plan.moreFeatures?.map((f, i) => (
                            <div
                              key={i}
                              className="flex items-center space-x-3 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                            >
                              <FaCheck
                                className={`w-3 h-3 ${plan.popular ? "text-white" : "text-gray-400 group-hover:text-white"}`}
                              />
                              <span
                                className={`text-[12px] md:text-[13px] font-medium transition-colors duration-300 ${plan.popular ? "text-white" : "text-gray-600 group-hover:text-white"}`}
                              >
                                {f}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="w-full py-2.5 md:py-3 px-8 rounded-full text-xs md:text-base font-bold transition-all duration-200 mt-4 tracking-wider cursor-pointer bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white shadow-lg shadow-pink-200/20 active:scale-95"
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
