import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogIn, Menu, X, LayoutDashboard } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../redux/actions/authAction";
import ProfileDropdown from "./ProfileDropdown";
import LogoutModal from "./LogoutModal";
import { toast } from "react-toastify";
import aiIcon from "../assets/ai-icon.svg";

export default function Header({ onContactClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const containerRef = useRef(null);
  const user = useSelector((s) => s.auth?.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    function handleOutside(e) {
      if (!profileOpen) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) setProfileOpen(false);
    }
    window.addEventListener("pointerdown", handleOutside, true);
    return () => window.removeEventListener("pointerdown", handleOutside, true);
  }, [profileOpen]);

  const handleContactClick = (e) => {
    e.preventDefault();
    setIsOpen(false); // Close mobile menu if open
    onContactClick();
  };

  return (
    <header className="w-full bg-[#F5f5f5]  text-[14px]">
      <div className="max-w-[1140px] mx-auto px-6 lg:px-0">
        <div className="flex items-center justify-between md:py-[20px] h-16">
          <div className="flex items-center gap-12">
            {/* logo */}
            <div className="flex items-center gap-2">
              <img className="w-4 h-4 md:w-8 md:h-8" src={aiIcon} alt="" />
              <h1 className="font-bold font-montserrat text-[16px] lg:text-[25px] md:text-[20px]">
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

          <div className="flex items-center gap-2 md:gap-4">
            {user ? (
              <div className="flex items-center font-montserrat font-normal gap-2 md:gap-4">
                <Link
                  to="/dashboard"
                  className="flex items-center justify-center font-montserrat font-medium md:gap-2 w-8 h-8 md:w-auto md:h-auto md:px-6 md:py-2 rounded-full bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white text-sm shadow-[0px_4px_15px_rgba(168,85,247,0.2)] hover:shadow-[0px_8px_25px_rgba(168,85,247,0.4)] hover:scale-[1.03] hover:brightness-110 transition-all duration-300 ease-out active:scale-95"
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Link>
                <div ref={containerRef} className="relative">
                  <button
                    onClick={() => setProfileOpen((p) => !p)}
                    className={`relative w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-200
                      bg-gradient-to-br from-[#F472B6] to-[#A855F7] text-white
                      ring-2 ring-offset-2 ring-offset-[#F5f5f5] shadow-md shadow-purple-200
                      ${profileOpen ? "ring-purple-400" : "ring-transparent hover:ring-purple-400/60"}`}
                  >
                    {initial}
                  </button>
                  {profileOpen && (
                    <ProfileDropdown 
                      onClose={() => setProfileOpen(false)} 
                      onLogout={() => { setShowLogoutModal(true); setProfileOpen(false); }} 
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center font-montserrat font-normal space-x-4">
                <p className="hidden lg:block">Already a klipsify User?</p>
                <Link
                  to="/login"
                  className="flex items-center font-montserrat font-medium gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white text-sm shadow-[0px_4px_15px_rgba(168,85,247,0.2)] hover:shadow-[0px_8px_25px_rgba(168,85,247,0.4)] hover:scale-[1.03] hover:brightness-110 transition-all duration-300 ease-out active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </Link>
              </div>
            )}

            {/* Hamburger Menu Toggle */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 focus:outline-none ml-1"
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
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-[#F5f5f5] border-t border-gray-200 px-6 py-6 space-y-6 shadow-lg">
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

          {!user && (
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
          )}
        </div>
      </div>

      <LogoutModal 
        isOpen={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => { 
          setShowLogoutModal(false);
          dispatch(logoutUser()); 
          toast.success("Logout successful");
          navigate("/"); 
        }}
      />
    </header>
  );
}
