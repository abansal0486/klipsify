import vector from "../assets/Vector (3).svg";
import centreImage from "../assets/aboutContentImage.svg";

export default function AboutContent() {
    return (
        <section className="relative w-full py-20 px-6 bg-gradient-to-br from-[#f8e8e8] via-[#ffffff] to-[#e8f0f8] overflow-hidden">
            <div className="max-w-4xl mx-auto text-center relative z-10">
                <h2 className="text-4xl md:text-6xl font-['DM_Serif_Display'] text-gray-900 mb-2">
                    Meet
                </h2>
                <h1 className="text-4xl md:text-[80px] font-bold font-playfair italic md:p-3  text-outline mb-6 md:mb-15 uppercase">
                    MY BRAND
                </h1>

                <div className="space-y-2 text-[10px] font-poppins md:text-[14px] leading-relaxed  mx-auto">
                    <p className="text-black">
                        At <span className="text-black">MY BRAND</span>, we believe marketing should be smart, simple, and unstoppable. Founded and led by visionary entrepreneur Benny Ashkenazi, our team is a powerhouse of creativity, technology, and innovation—driven by one mission: to help businesses and creators dominate the digital space with effortless, high-impact content.
                    </p>
                    <p className="text-black">
                        We created <span className="text-black font-semibold">MY BRAND</span> as the world's first fully automated AI Marketing Generator. Think of it as your personal marketing studio, strategy planner, and posting assistant—all in one powerful tool.
                    </p>
                </div>

                <div className="mt-16 relative flex justify-center items-center">
                    {/* Background Blob Vector */}
                    <img
                        src={vector}
                        alt=""
                        className="absolute w-full max-w-[565.52px] h-auto opacity-80"
                    />

                    {/* Main Workspace Illustration */}
                    <img
                        src={centreImage}
                        alt="Creative AI Workspace Illustration"
                        className="relative z-10 max-w-full h-auto w-[600px]"
                    />
                </div>
            </div>
        </section>
    );
}
