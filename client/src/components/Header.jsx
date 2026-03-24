import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogIn, Menu, X } from "lucide-react";
import aiIcon from "../assets/ai-icon.svg";

export default function Header({ onContactClick }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleContactClick = (e) => {
    e.preventDefault();
    setIsOpen(false); // Close mobile menu if open
    onContactClick();
  };

  return (
    <header className="w-full bg-[#F5f5f5]  text-[14px]">
      <div className="max-w-[1140px] mx-auto px-6 md:px-0">
        <div className="flex items-center justify-between md:py-[20px] h-16">
          <div className="flex items-center gap-12">
            {/* logo */}
            <div className="flex items-center gap-2">
              <img className="w-6 h-6 md:w-8 md:h-8" src={aiIcon} alt="" />
              <h1 className="font-bold font-playfair text-[20px] md:text-[30px]">
                klipsify
              </h1>
            </div>

            {/* Desktop Menu */}
            <nav className="hidden font-montserrat md:flex gap-8 text-gray-600 font-medium items-center">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `transition-all duration-300 relative py-1 ${
                    isActive
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-[#F472B6] to-[#A855F7] font-bold"
                      : "text-gray-600 font-normal hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#F472B6] hover:to-[#A855F7]"
                  }`
                }
              >
                Home
              </NavLink>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("pricing")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="transition-all duration-300 relative py-1 text-gray-600 font-normal hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#F472B6] hover:to-[#A855F7]"
              >
                Pricing
              </a>
              <button
                onClick={handleContactClick}
                className="transition-all duration-300 relative py-1 text-gray-600 font-normal hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#F472B6] hover:to-[#A855F7]"
              >
                Contact Us
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center font-montserrat font-normal space-x-4">
              <p>Already a klipsify User?</p>
              <Link
                to="/login"
                className="flex items-center font-montserrat font-medium gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white text-sm shadow-[0px_4px_15px_rgba(168,85,247,0.2)] hover:shadow-[0px_8px_25px_rgba(168,85,247,0.4)] hover:scale-[1.03] hover:brightness-110 transition-all duration-300 ease-out active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            </div>

            {/* Hamburger Menu Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 -mr-2 focus:outline-none"
                aria-label="Toggle menu"
              >
                {isOpen ? (
                  <X className="w-6 h-6 text-gray-600" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-[#F5f5f5] border-t border-gray-200 px-6 py-6 space-y-6 shadow-lg">
          <nav className="flex flex-col space-y-4">
            <NavLink
              to="/"
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `font-montserrat text-[14px] transition-all duration-300 w-fit ${
                  isActive
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-[#F472B6] to-[#A855F7] font-bold"
                    : "text-gray-600 font-normal hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#F472B6] hover:to-[#A855F7]"
                }`
              }
            >
              Home
            </NavLink>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document
                  .getElementById("pricing")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="font-montserrat text-[14px] transition-all duration-300 w-fit text-gray-600 font-normal hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#F472B6] hover:to-[#A855F7]"
            >
              Pricing
            </a>
            <button
              onClick={handleContactClick}
              className="font-montserrat text-[14px] transition-all duration-300 w-fit text-gray-600 font-normal hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#F472B6] hover:to-[#A855F7]"
            >
              Contact Us
            </button>
          </nav>

          <div className="flex flex-col space-y-3 pt-6 border-t border-gray-200">
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white font-montserrat font-bold shadow-[0px_4px_15px_rgba(168,85,247,0.2)] hover:shadow-[0px_8px_25px_rgba(168,85,247,0.4)] hover:brightness-110 active:scale-95 transition-all duration-300 ease-out text-sm"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
