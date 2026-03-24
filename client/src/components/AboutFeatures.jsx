import { useState, useEffect } from "react";
import img1 from "../assets/contentCreation.svg";
import img2 from "../assets/youtubeNotes.svg";
import img3 from "../assets/marketing.svg";
import img4 from "../assets/storyTelling.svg";
const AboutFeatures = () => {
  const slides = [
    {
      title: "Generate engaging content",
      desc: "Create branded visuals in seconds.",
      img: img1,
    },
    {
      title: "Create marketing posts",
      desc: "Design beautiful social media posts.",
      img: img2,
    },
    {
      title: "Build your brand",
      desc: "Generate consistent branded content.",
      img: img3,
    },
    {
      title: "Boost engagement",
      desc: "Grow your audience with AI.",
      img: img4,
    },
  ];

  // clone first slide
  const extendedSlides = [...slides, slides[0]];

  const [current, setCurrent] = useState(0);
  const [transition, setTransition] = useState(true);

  useEffect(() => {
    const slider = setInterval(() => {
      setCurrent((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(slider);
  }, [current]);

  // reset position after clone
  useEffect(() => {
    if (current === slides.length) {
      setTimeout(() => {
        setTransition(false);
        setCurrent(0);
      }, 700);

      setTimeout(() => {
        setTransition(true);
      }, 750);
    }
  }, [current, slides.length]);

  return (
    <div className="w-full flex flex-col items-center mt-[25px] mb-[25px] md:mt-[50px] md:mb-[50px] px-4 md:px-0 font-montserrat">
      {/* Carousel Container with Neo-Brutalism Bottom Border */}
      <h1 className="text-[18px] md:text-[38px] font-montserrat font-bold text-black leading-tight mb-[24px] text-center mx-auto xl:whitespace-nowrap">
        What you can do with clipsify
      </h1>
      <div className="relative w-full max-w-[800px] md:max-w-none md:w-[1017px] group cursor-pointer">
        <div 
          className={`relative w-full overflow-hidden rounded-[32px] border border-gray-900 shadow-[0_10px_0_0_#111827] transition-all duration-300 transform group-hover:translate-y-[10px] group-hover:shadow-none`}
        >
          <div
            className={`flex md:h-[410px] ${transition ? "transition-transform duration-700" : ""}`}
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {extendedSlides.map((slide, index) => (
              <div
                key={index}
                className={`w-full md:h-[410px] flex-shrink-0 flex flex-col-reverse md:flex-row items-center justify-center md:justify-between px-6 py-12 md:py-10 md:px-24 gap-8 md:gap-0 ${
                  index % 2 === 0 ? "bg-[#D6FFB3]" : "bg-[#FFF4B3]"
                }`}
              >
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                  <h2 className="text-xl md:text-[30px] font-bold font-montserrat leading-tight text-gray-900">
                    {slide.title}
                  </h2>
                  <p className="text-xs md:text-xs text-gray-800 font-montserrat mt-4 md:mt-2 w-full max-w-[320px] leading-relaxed">
                    {slide.desc}
                  </p>
                </div>

                <img
                  src={slide.img}
                  alt=""
                  className="w-[220px] h-[220px] md:w-[480px] md:h-[350px] object-contain transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="flex gap-2 mt-8">
        {slides.map((_, index) => (
          <div
            key={index}
            onClick={() => setCurrent(index)}
            className={`cursor-pointer w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              current % slides.length === index
                ? index % 2 === 0
                  ? "bg-[#D6FFB3] scale-125 border border-gray-900"
                  : "bg-[#FFF4B3] scale-125 border border-gray-900"
                : "bg-gray-300 shadow-sm"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default AboutFeatures;
