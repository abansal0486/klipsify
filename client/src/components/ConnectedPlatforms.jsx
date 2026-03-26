import chef from "../assets/chef.jpg";
import spa from "../assets/spa.jpg";
import tiktok from "../assets/tiktok.jpg";
import moonPrincess from "../assets/moonPrincess.jpg";
import storyboard from "../assets/storyboard.jpg";


  /* static section*/


const ConnectedPlatforms = () => {
  const platforms = [
    {
      id: 1,
      image: spa,
      alt: "Spa Promo",
    },
    {
      id: 2,
      image: chef,
      alt: "Chef Services Promo",
    },
    {
      id: 3,
      image: moonPrincess,
      alt: "Moon Princess",
    },
    {
      id: 4,
      image: storyboard,
      alt: "Storyboard Concept",
    },
    {
      id: 5,
      image: tiktok,
      alt: "TikTok Ad",
    },
  ];

  return (
    <section className="relative px-4 md:px-0 md:mb-[100px] mt-[50px]">
      <div className="max-w-[1140px] mx-auto bg-white rounded-t-[40px]  p-3 md:p-12">
        <div className="text-center mb-10">
          <span className="inline-block md:mb-[15px] font-montserrat  px-4 py-1.5 bg-[#FFDECD] text-[#F05602] text-[8px] md:text-xs rounded-full mb-3 tracking-[0.1em]">
            CONNECTED PLATFORMS
          </span>
          <h2 className="text-[20px] md:text-[38px] font-bold font-montserrat text-[#1A1A1A] mb-4 tracking-tight leading-tight">
            Create Once, Share Everywhere
          </h2>
          <p className="text-gray-500 font-montserrat text-[12px] md:text-[16px]  mx-auto">
            Design your content once and let Klipsify automatically distribute
            it across all your social channels.
          </p>
        </div>

        <div className="flex flex-wrap justify-center md:grid md:grid-cols-5 gap-4 md:gap-5">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="relative w-[calc(50%-8px)] sm:w-[calc(33.33%-12px)] md:w-full h-[300px] md:h-[400px] rounded-[10px] overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
            >
              <img
                src={platform.image}
                alt={platform.alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};













  /* automatic slider section */


// const ConnectedPlatforms = () => {
//   const platforms = [
//     {
//       id: 1,
//       image: spa,
//       label: "Spa Promo",
//     },
//     {
//       id: 2,
//       image: chef,
//       label: "Chef Services",
//     },
//     {
//       id: 3,
//       image: moonPrincess,
//       label: "Moon Princess",
//     },
//     {
//       id: 4,
//       image: storyboard,
//       label: "Storyboard Concept",
//     },
//     {
//       id: 5,
//       image: tiktok,
//       label: "TikTok Ad",
//     },
//   ];

//   // Double the platforms for seamless looping
//   const loopedPlatforms = [...platforms, ...platforms];

//   return (
//     <section className="relative px-4 md:px-0 pb-20 mt-[50px] overflow-hidden">
//       <div className="max-w-[1140px] mx-auto bg-white rounded-t-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 p-3 md:p-12">
//         {/* Header Section */}
//         <div className="text-center mb-10">
//           <span className="inline-block md:mb-[15px] font-montserrat px-4 py-1.5 bg-[#FFDECD] text-[#F05602] text-[8px] md:text-xs rounded-full mb-3 tracking-[0.1em]">
//             CONNECTED PLATFORMS
//           </span>
//           <h2 className="text-[20px] md:text-[38px] font-bold font-montserrat text-[#1A1A1A] mb-4 tracking-tight leading-tight">
//             Create Once, Share Everywhere
//           </h2>
//           <p className="text-gray-500 font-montserrat text-[12px] md:text-[16px] mx-auto">
//             Design your content once and let Klipsify automatically distribute
//             it across all your social channels.
//           </p>
//         </div>

//         {/* Image Slider Marquee */}
//         <div className="relative overflow-hidden w-full">
//           <div className="flex animate-marquee hover:pause whitespace-nowrap">
//             {loopedPlatforms.map((platform, index) => (
//               <div
//                 key={`${platform.id}-${index}`}
//                 className="flex-shrink-0 w-[180px] md:w-[220px] h-[320px] md:h-[400px] rounded-[15px] overflow-hidden group cursor-pointer shadow-lg relative mr-4 md:mr-6"
//               >
//                 <img
//                   src={platform.image}
//                   alt={platform.label}
//                   className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
//                 />
//                 <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all duration-300" />
//                 <div className="absolute bottom-4 left-4">
//                   <p className="text-white font-montserrat font-bold text-[10px] uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all">
//                     {platform.label}
//                   </p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       <style>{`
//         @keyframes marquee {
//           0% { transform: translateX(0); }
//           100% { transform: translateX(-50%); }
//         }
//         .animate-marquee {
//           display: flex;
//           animation: marquee 30s linear infinite;
//           width: max-content;
//         }
//         .hover\\:pause:hover {
//           animation-play-state: paused;
//         }
//       `}`}</style>
//     </section>
//   );
// };


















/* move with buttons section*/

// const ConnectedPlatforms = () => {
//   const scrollRef = useRef(null);
//   const [activeIndex, setActiveIndex] = useState(0);

//   const platforms = [
//     { id: 1, image: spa, alt: "Spa Promo", label: "Spa Promo" },
//     { id: 2, image: chef, alt: "Chef Services Promo", label: "Chef Services" },
//     { id: 3, image: moonPrincess, alt: "Moon Princess", label: "Moon Princess" },
//     { id: 4, image: storyboard, alt: "Storyboard Concept", label: "Storyboard Concept" },
//     { id: 5, image: tiktok, alt: "TikTok Ad", label: "TikTok Ad" },
//   ];

//   const handleScroll = () => {
//     if (scrollRef.current) {
//       const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
//       const maxScroll = scrollWidth - clientWidth;
      
//       if (maxScroll > 0) {
//         const percentage = scrollLeft / maxScroll;
//         const newIndex = Math.round(percentage * (platforms.length - 1));
//         if (newIndex !== activeIndex) {
//           setActiveIndex(newIndex);
//         }
//       }
//     }
//   };

//   const scrollToIndex = (index) => {
//     if (scrollRef.current) {
//       const { scrollWidth, clientWidth } = scrollRef.current;
//       const maxScroll = scrollWidth - clientWidth;
//       if (maxScroll > 0) {
//         const targetScroll = (index / (platforms.length - 1)) * maxScroll;
//         scrollRef.current.scrollTo({
//            left: targetScroll,
//            behavior: 'smooth'
//         });
//         setActiveIndex(index);
//       }
//     }
//   };

//   const scroll = (direction) => {
//     const { current } = scrollRef;
//     if (current) {
//       const scrollAmount = 300;
//       if (direction === "left") {
//         current.scrollLeft -= scrollAmount;
//       } else {
//         current.scrollLeft += scrollAmount;
//       }
//     }
//   };

//   return (
//     <section className="relative px-4 md:px-0 pb-20 mt-[50px]">
//       <div className="max-w-[1140px] mx-auto bg-white rounded-t-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 p-3 md:p-12 relative overflow-hidden">
//         {/* Header Section */}
//         <div className="text-center mb-10">
//           <span className="inline-block md:mb-[15px] font-montserrat px-4 py-1.5 bg-[#FFDECD] text-[#F05602] text-[8px] md:text-xs rounded-full mb-3 tracking-[0.1em]">
//             CONNECTED PLATFORMS
//           </span>
//           <h2 className="text-[20px] md:text-[38px] font-bold font-montserrat text-[#1A1A1A] mb-4 tracking-tight leading-tight">
//             Create Once, Share Everywhere
//           </h2>
//           <p className="text-gray-500 font-montserrat text-[12px] md:text-[16px] mx-auto">
//             Design your content once and let Klipsify automatically distribute
//             it across all your social channels.
//           </p>
//         </div>

//         {/* Manual Slider Container */}
//         <div className="relative group px-1">
//           {/* Controls */}
//           <button
//             onClick={() => scroll("left")}
//             className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 p-2 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all border border-gray-100 hidden md:block"
//           >
//             <ChevronLeft className="w-6 h-6 text-[#F05602]" />
//           </button>

//           <button
//             onClick={() => scroll("right")}
//             className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 p-2 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all border border-gray-100 hidden md:block"
//           >
//             <ChevronRight className="w-6 h-6 text-[#F05602]" />
//           </button>

//           {/* Scrolling Content */}
//           <div
//             ref={scrollRef}
//             onScroll={handleScroll}
//             className="flex gap-4 md:gap-6 overflow-x-auto scroll-smooth no-scrollbar"
//           >
//             {platforms.map((platform) => (
//               <div
//                 key={platform.id}
//                 className="flex-shrink-0 w-[240px] md:w-[280px] h-[340px] md:h-[420px] rounded-[15px] overflow-hidden group cursor-pointer shadow-md relative transition-all duration-300 hover:shadow-xl"
//               >
//                 <img
//                   src={platform.image}
//                   alt={platform.alt}
//                   className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
//                 />
//                 <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-all duration-300" />
//                 <div className="absolute bottom-4 left-4">
//                   <p className="text-white font-montserrat font-bold text-[10px] uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all">
//                     {platform.label}
//                   </p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Navigation Dots (Indicator) */}
//         <div className="flex justify-center gap-3 mt-10">
//           {platforms.map((_, index) => (
//             <div
//               key={index}
//               onClick={() => scrollToIndex(index)}
//               className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-300 ${
//                 index === activeIndex ? "bg-[#F05602] scale-125" : "bg-gray-200 hover:bg-gray-300"
//               }`}
//             />
//           ))}
//         </div>
//       </div>

//       <style>{`
//         .no-scrollbar::-webkit-scrollbar { display: none; }
//         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
//       `}</style>
//     </section>
//   );
// };

export default ConnectedPlatforms;
