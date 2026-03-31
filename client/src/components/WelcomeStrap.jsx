
export const WelcomeStrap = () => {
    return (
        <section className="py-4 md:py-4 px-6 md:px-0 bg-white relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-1/2 left-[-10%] -translate-y-1/2 w-[900px] h-[200px] bg-[rgb(236,174,187)] opacity-80 rounded-full blur-[120px] -z-0 animate-blob"></div>
            <div className="absolute top-1/2 right-[-10%] -translate-y-1/2 w-[900px] h-[200px] bg-[rgb(127,180,229)] opacity-80 rounded-full blur-[120px] -z-0 animate-blob" style={{ animationDelay: '2s' }}></div>

            <div className="max-w-[1140px] mx-auto relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                    {/* Left Content */}
                    <div className="flex-1">
                        <h2 className="text-lg md:text-6xl font-bold font-montserrat text-[#1A1A1A] leading-[1.2]">
                            Welcome to the future of content.
                        </h2>
                    </div>

                    {/* Right Content */}
                    <div className="flex-1 flex justify-center md:justify-end">
                        <p className="text-sm md:text-[40px] font-montserrat text-[#1A1A1A]">
                            Welcome to <span className="text-[##0E7676] font-bold">MY BRAND</span>
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
