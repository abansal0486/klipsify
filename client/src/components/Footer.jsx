import React from 'react';
import twitter from "../assets/line-md_twitter-x.svg";
import facebook from "../assets/ic_twotone-facebook.svg";
import instagram from "../assets/flowbite_instagram-solid.svg";
import linkedin from "../assets/devicon-plain_linkedin.svg";
import youtube from "../assets/Vector (2).svg";

const Footer = ({ onContactClick }) => {
    return (
        <footer className="bg-white pt-3 md:pt-0 pb-11 px-2 ">
            <div className="max-w-[1140px] mx-auto flex flex-col md:mt-[50px] items-center">
                {/* Brand and Tagline */}
                <div className="text-center mb-2">
                    <h2 className="text-[20px] md:text-[30px] font-montserrat font-bold mb-3 tracking-tight text-[#1A1A1A]">
                        Klipsify
                    </h2>
                    <p className="text-[#676767] text-[10px] md:text-[14px] max-w-[400px] mx-auto font-montserrat leading-normal">
                        AI-powered social media automation for modern creators
                    </p>
                </div>

                {/* Social Icons */}
                <div className="flex space-x-3 mb-2 mt-2 ">
                    <a href="/" className="group w-[30px] h-[30px] flex items-center justify-center rounded-full bg-white shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.25)] hover:-translate-y-1 transition-all duration-300 border border-gray-100 text-[#4B4B4B] hover:text-black" aria-label="X">
                        <img src={twitter} alt="X" className="w-5 h-5 filter grayscale brightness-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a href="/" className="group w-[30px] h-[30px] flex items-center justify-center rounded-full bg-white shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.25)] hover:-translate-y-1 transition-all duration-300 border border-gray-100 text-[#4B4B4B] hover:text-black" aria-label="Facebook">
                        <img src={facebook} alt="Facebook" className="w-5 h-5 filter grayscale brightness-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a href="/" className="group w-[30px] h-[30px] flex items-center justify-center rounded-full bg-white shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.25)] hover:-translate-y-1 transition-all duration-300 border border-gray-100 text-[#4B4B4B] hover:text-black" aria-label="Instagram">
                        <img src={instagram} alt="Instagram" className="w-5 h-5 filter grayscale brightness-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a href="/" className="group w-[30px] h-[30px] flex items-center justify-center rounded-full bg-white shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.25)] hover:-translate-y-1 transition-all duration-300 border border-gray-100 text-[#4B4B4B] hover:text-black" aria-label="LinkedIn">
                        <img src={linkedin} alt="LinkedIn" className="w-5 h-5 filter grayscale brightness-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a href="/" className="group w-[30px] h-[30px] flex items-center justify-center rounded-full bg-white shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.25)] hover:-translate-y-1 transition-all duration-300 border border-gray-100 text-[#4B4B4B] hover:text-black" aria-label="YouTube">
                        <img src={youtube} alt="YouTube" className="w-5 h-5 filter grayscale brightness-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>

                {/* Bottom Bar */}
                <div className="w-full font-montserrat pt-2 flex flex-col md:flex-row justify-between items-center text-[10px] md:text-[14px] font-medium text-gray-500">
                    <p className="mb-4 md:mb-0">
                        © 2026 MY BRAND. All rights reserved.
                    </p>
                    <div className="flex space-x-6">
                        <a href="#privacy" className="hover:text-black text-[10px] md:text-[14px] transition-colors">Privacy</a>
                        <a href="#terms" className="hover:text-black text-[10px] md:text-[14px] transition-colors">Terms</a>
                        <a href="#contact" className="hover:text-black text-[10px] md:text-[14px] transition-colors" onClick={onContactClick}>Contact</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
