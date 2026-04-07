import React from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import fbLogo from "../assets/facebookk.svg";
import igLogo from "../assets/instagram.svg";
import ttLogo from "../assets/tiktokk.svg";
import ytLogo from "../assets/logos_youtube-icon.svg";
import liLogo from "../assets/linkedIn.svg";
import xLogo from "../assets/miniInsta.svg";
import aiIcon from "../assets/ai-icon.svg";
const words = ["Growth", "Results","Content"];

const DynamicWord = () => {
  const [currentWord, setCurrentWord] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [wordIndex, setWordIndex] = React.useState(0);
  const [typingSpeed, setTypingSpeed] = React.useState(70);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const fullWord = words[wordIndex];

      if (!isDeleting) {
        setCurrentWord(fullWord.substring(0, currentWord.length + 1));
        setTypingSpeed(70);

        if (currentWord.length === fullWord.length) {
          setIsDeleting(true);
          setTypingSpeed(1500); // Pause when word is complete
        }
      } else {
        setCurrentWord(fullWord.substring(0, currentWord.length - 1));
        setTypingSpeed(40);

        if (currentWord.length === 0) {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
          setTypingSpeed(400); // Small pause before next word
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [currentWord, isDeleting, wordIndex, typingSpeed]);

  return (
    <span className="inline-block w-[130px] md:w-[260px] text-left">
      {currentWord}
      <span className="text-[#A855F7] animate-pulse ml-1 opacity-70">|</span>
    </span>
  );
};

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const PlatformIcon = ({ src, style, delay = 0 }) => (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: [0, -8, 0], // Subtle floating effect
      }}
      transition={{
        delay,
        duration: 0.6,
        type: "spring",
        stiffness: 80,
        y: {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay + 0.5, // Offset floating start
        },
      }}
      className="absolute w-6 h-6 md:w-[50px] md:h-[50px] bg-white rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.12)] flex items-center justify-center p-1 md:p-3 z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
      style={style}
    >
      <img src={src} alt="Platform" className="w-full h-full object-contain" />
    </motion.div>
  );

  const arcIcons = [
    { src: liLogo, style: { left: "15%", top: "84.6%" }, delay: 1.3 },
    { src: ttLogo, style: { left: "22%", top: "54%" }, delay: 1.1 },
    { src: fbLogo, style: { left: "35%", top: "36%" }, delay: 0.9 },
    { src: igLogo, style: { left: "60%", top: "36%" }, delay: 0.9 },
    { src: ytLogo, style: { left: "73%", top: "54%" }, delay: 1.1 },
    { src: xLogo, style: { left: "80%", top: "84.6%" }, delay: 1.3 },
  ];

  const dotRings = [
    { radius: 35, count: 8 },
    { radius: 60, count: 14 },
    { radius: 85, count: 20 },
    { radius: 110, count: 28 },
    { radius: 135, count: 36 },
    { radius: 160, count: 44 },
    { radius: 185, count: 52 },
    { radius: 210, count: 60 },
    { radius: 235, count: 68 },
    { radius: 260, count: 76 },
  ];

  return (
    <section className="relative w-full min-h-auto flex flex-col items-center md:mt-[100px] pt-10 pb-1 md:pb-1 overflow-hidden bg-[radial-gradient(circle_at_50%_85%,_rgba(168,85,247,0.25)_0%,_rgba(168,85,247,0.15)_25%,_rgba(255,255,255,0)_60%),linear-gradient(to_bottom,_#ffffff_50%,_rgba(255,255,255,0)_100%),linear-gradient(to_right,_#F8F7E9_0%,_#ffffff_50%,_#D4E6F3_100%)]">
      {/* Subtle dot pattern background */}
      <div className="max-w-[1200px] w-full mx-auto px-6 relative z-10 flex flex-col items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center w-full"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="flex justify-center mb-[14px]"
          >
            <span className="px-4 py-1.5 bg-[#EEF2FF] text-[#6366F1] text-[10px] md:text-xs font-bold rounded-full tracking-widest uppercase border border-[#6366F1]/10">
              AI-POWERED SOCIAL MEDIA TOOL
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="text-3xl md:text-[58px] font-montserrat font-bold text-black leading-tight mb-[24px] mx-auto xl:whitespace-nowrap"
          >
            Supercharge Your Marketing{" "}
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              <DynamicWord />
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={itemVariants}
            className="text-sm md:text-[14px] text-gray-500 font-montserrat mx-auto max-w-[900px] mb-[24px] leading-relaxed"
          >
            Klipsify helps you plan, create, and publish high-quality content
            across all your social platforms effortlessly. Save time, stay
            consistent, and grow your brand without the stress.
          </motion.p>

          {/* Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-[25px] w-full px-4 sm:px-0"
          >
            <button className="w-full sm:w-auto px-3 py-2 md:px-8 md:py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full shadow-lg shadow-pink-200/50 hover:scale-105 transition-transform duration-300">
              Start Free Today
            </button>
            <button className="w-full sm:w-auto px-3 py-2 md:px-8 md:py-4 bg-white text-black rounded-full border border-black flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors duration-300">
              <Play size={18} fill="black" /> Watch Demo
            </button>
          </motion.div>

          {/* Social Proof Row */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center mb-[17px]"
          >
            <p className="text-[11px] md:text-xs text-gray-500 tracking-wide mb-[10px]">
              Keeping your brand active 24/7 from everywhere
            </p>
            <div className="flex items-center mb-[17px]">
              {[fbLogo, igLogo, ttLogo, ytLogo, xLogo].map((logo, idx) => (
                <div
                  key={idx}
                  className="w-[30px] h-[30px] bg-white rounded-full shadow-md flex items-center justify-center p-1.5 border border-gray-100 hover:scale-110 transition-transform duration-300"
                >
                  <img
                    src={logo}
                    className="w-full h-full object-contain"
                    alt="Social"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* ── Arched Visual with Animated Dots ── */}
        <div className="relative w-full max-w-[901px] h-[220px] sm:h-[320px] md:h-[411px] -mt-[85px] sm:-mt-[120px] md:-mt-[156px] pointer-events-none">
          {/* Animated concentric dot arcs (SVG) */}
          <svg
            viewBox="0 0 800 420"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            {dotRings.map(({ radius, count }, ringIdx) =>
              Array.from({ length: count }).map((_, dotIdx) => {
                const angle = Math.PI + (dotIdx / (count - 1)) * Math.PI;
                const cx = 400 + radius * Math.cos(angle);
                const cy = 420 + radius * Math.sin(angle);

                // Calculate dot size based on vertical position (cy)
                // cy ranges from ~60 (top) to 420 (bottom)
                const normalizedY = Math.max(0, (cy - 60) / 360);
                const ringScale = 1.0 - (ringIdx / (dotRings.length - 1)) * 0.5;
                const dotRadius = (1.0 + normalizedY * 2.5) * ringScale; // smaller for outer rings, larger at bottom

                return (
                  <motion.circle
                    key={`${ringIdx}-${dotIdx}`}
                    cx={cx}
                    cy={cy}
                    r={dotRadius}
                    fill="#6D28D9"
                    initial={{ opacity: 0.3, scale: 0.6 }}
                    animate={{
                      opacity: [0.3, 0.8, 0.3],
                      scale: [0.6, 1.1, 0.6],
                    }}
                    transition={{
                      duration: 3,
                      delay: ringIdx * 0.2 + dotIdx * 0.02, // Wave outward effect
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                );
              }),
            )}
          </svg>

          {/* Central AI icon */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7, type: "spring" }}
            className="absolute md:bottom-3 md:left-[47%] left-[44%] bottom-0 -translate-x-1/2 w-8 h-8 sm:w-[55px] sm:h-[55px] md:w-[55px] md:h-[55px] bg-white rounded-xl sm:rounded-2xl shadow-2xl flex items-center justify-center p-2.5 sm:p-4 z-30 border border-indigo-100 pointer-events-auto"
          >
            <img
              src={aiIcon}
              alt="AI Icon"
              className="w-full h-full object-contain"
            />
          </motion.div>

          {/* Platform icons placed along the outer arc */}
          {arcIcons.map((icon, idx) => (
            <PlatformIcon
              key={idx}
              src={icon.src}
              style={icon.style}
              delay={icon.delay}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
