import React, { useState, useEffect, useRef } from "react";
import bgImage from "../assets/Mask group (1).svg";
import starIcon from "../assets/material-symbols_star-rate.svg";
import whiteStarIcon from "../assets/Vector (6).svg";
import plusIcon from "../assets/Vector (5).svg";
import peopleIcon from "../assets/Vector (4).svg";

const Counter = ({ end, duration = 2000, suffix = "", decimals = 0, start = 0, useK = false, useM = false }) => {
  const [count, setCount] = useState(start);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      const currentCount = start + (end - start) * percentage;
      setCount(currentCount);

      if (percentage < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration, start]);

  const formatDisplay = (val) => {
    if (useM && val >= 1000000) return (val / 1000000).toFixed(0) + "M";
    if (useK && val >= 1000) return (val / 1000).toFixed(0) + "K";
    if (useK && val < 1000) return (val / 1000).toFixed(1) + "K"; // Show 0.1K etc if needed
    
    return decimals === 0 ? Math.floor(val).toLocaleString() : val.toFixed(decimals);
  };

  return (
    <span ref={elementRef}>
      {formatDisplay(count)}
      {suffix}
    </span>
  );
};

const RatingSection = () => {
  return (
    <section
      className="relative bg-[#000000] md:mb-6 py-6 px-4 md:px-3 overflow-hidden"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full -z-0"></div>

      <div className="max-w-[1140px] md:mt-[24px] mx-auto relative z-10 text-center">
        {/* Badge */}
        <div className="inline-block bg-[#FEFCE8] text-[#854D0E] text-[10px] md:text-xs font-bold px-4 py-1 rounded-full mb-8">
          LIMITED TIME OFFER
        </div>

        {/* Heading */}
        <h2 className="text-lg md:text-[38px] font-montserrat font-bold text-white mb-[10px] leading-tight mx-auto">
          Take Your Social Media to the Next Level
        </h2>

        {/* Subtext */}
        <p className="text-white text-[10px] font-montserrat md:text-[14px] mb-[30px] max-w-2xl mx-auto leading-relaxed">
          Join thousands of creators and businesses already using Klipsify to
          produce engaging content and scale faster.
        </p>

        {/* Stats */}
        <div className="flex justify-center mb-8 px-4 md:px-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-[900px] pt-10 md:pt-14 items-stretch">
            {/* Stat 1 */}
            <div className="p-[1.5px] bg-gradient-to-r from-[#F472B6] to-[#A855F7] rounded-[24px] group hover:-translate-y-2 transition h-full">
              <div className="bg-[#0A0A0A] h-full min-h-[140px] md:min-h-[155px] rounded-[23px] p-6 pt-12 flex flex-col items-center justify-between relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70px] h-[70px] p-[1.5px] bg-gradient-to-r from-[#F472B6] to-[#A855F7] rounded-full">
                  <div className="w-full h-full rounded-full flex items-center justify-center">
                    <img src={peopleIcon} alt="peopleIcon" className="w-8 h-8" />
                  </div>
                </div>
                <span className="text-3xl md:text-[40px] text-white font-semibold">
                  <Counter start={100} end={10000} suffix=" +" useK={true} />
                </span>
                <span className="text-xs md:text-sm text-white">
                  Active Users
                </span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="p-[1.5px] bg-gradient-to-r from-[#F472B6] to-[#A855F7] rounded-[24px] group hover:-translate-y-2 transition h-full">
              <div className="bg-[#0A0A0A] h-full min-h-[140px] md:min-h-[155px] rounded-[23px] p-6 pt-12 flex flex-col items-center justify-between relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70px] h-[70px] p-[1.5px] bg-gradient-to-r from-[#F472B6] to-[#A855F7] rounded-full">
                  <div className="w-full h-full  rounded-full flex items-center justify-center">
                    <img src={plusIcon} alt="plusIcon" className="w-8 h-8" />
                  </div>
                </div>
                <span className="text-3xl md:text-[40px] text-white font-semibold">
                  <Counter start={800000} end={1000000} suffix=" +" useM={true} />
                </span>
                <span className="text-xs md:text-sm text-white">
                  Post Created
                </span>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="p-[1.5px] bg-gradient-to-r from-[#F472B6] to-[#A855F7] rounded-[24px] group hover:-translate-y-2 transition h-full">
              <div className="bg-[#0A0A0A] h-full min-h-[140px] md:min-h-[155px] rounded-[23px] p-6 pt-12 flex flex-col items-center justify-between relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70px] h-[70px] p-[1.5px] bg-gradient-to-r from-[#F472B6] to-[#A855F7] rounded-full">
                  <div className="w-full h-full  rounded-full flex items-center justify-center">
                    <img src={whiteStarIcon} alt="whiteStarIcon" className="w-8 h-8" />
                  </div>
                </div>
                <span className="text-3xl md:text-[40px] text-white font-semibold">
                  <Counter start={0} end={4.9} decimals={1} suffix="/5" />
                </span>
                <span className="text-xs md:text-sm text-white">
                  Average Rating
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 mt-8">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <img key={s} src={starIcon} alt="starIcon" className="w-4 h-4" />
            ))}
          </div>
          <span className="text-xs text-white">
            Trusted by 10,000+ users worldwide
          </span>
        </div>
      </div>
    </section>
  );
};

export default RatingSection;

