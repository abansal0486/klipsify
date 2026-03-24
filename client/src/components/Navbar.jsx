import { useRef, useState, useEffect } from "react";
import ProfileDropdown from "./ProfileDropdown";
import { Menu, X, Home, Sparkles, Gem, Turntable, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../redux/actions/authAction";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth?.user);

  useEffect(() => {
    function handleOutside(e) {
      if (!open) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener("pointerdown", handleOutside, true);
    return () => window.removeEventListener("pointerdown", handleOutside, true);
  }, [open]);

  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="h-14 md:h-16 z-50 w-full relative flex items-center justify-between px-4 md:px-6
      bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-sm">

      {/* Gradient accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-60 pointer-events-none" />

      {/* ── LEFT: mobile menu + logo ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition"
        >
          {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        {/* LOGO */}
        <div
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-200">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-base md:text-lg font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">klip</span>
            <span className="text-gray-800">sify</span>
          </span>
        </div>
      </div>

      {/* ── CENTER: plan badge ── */}
      <div className="hidden md:flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-semibold text-gray-500">Free Plan</span>
      </div>

      {/* ── RIGHT: upgrade + avatar ── */}
      <div className="flex items-center gap-2 md:gap-3">

        <button
          onClick={() => navigate("/dashboard/subscription")}
          className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold
            bg-gradient-to-r from-purple-600 to-pink-500 text-white
            hover:from-purple-500 hover:to-pink-400
            shadow-md shadow-purple-200 hover:shadow-purple-300
            transition-all duration-200"
        >
          <Zap size={11} className="fill-current" />
          <span className="hidden md:inline">Upgrade</span>
        </button>

        <div ref={containerRef} className="relative hidden md:block">
          <button
            onClick={() => setOpen((p) => !p)}
            className={`relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200
              bg-gradient-to-br from-purple-500 to-pink-500 text-white
              ring-2 ring-offset-2 ring-offset-white shadow-md shadow-purple-200
              ${open ? "ring-purple-400" : "ring-transparent hover:ring-purple-400/60"}`}
          >
            {initial}
          </button>
          {open && <ProfileDropdown />}
        </div>

      </div>

      {/* ── MOBILE MENU ── */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full bg-white border-b border-gray-200 px-4 py-5 shadow-lg flex flex-col gap-5 z-50">

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-3">Navigation</p>
            <MobileMenuItem icon={<Home size={17} />}      label="Studio"       onClick={() => { navigate("/dashboard"); setIsMobileMenuOpen(false); }} />
            <MobileMenuItem icon={<Sparkles size={17} />}  label="Gallery"      onClick={() => { navigate("/dashboard/gallery"); setIsMobileMenuOpen(false); }} />
            <MobileMenuItem icon={<Turntable size={17} />} label="Brand"        onClick={() => { navigate("/dashboard/brand"); setIsMobileMenuOpen(false); }} />
            <MobileMenuItem icon={<Gem size={17} />}       label="Subscription" onClick={() => { navigate("/dashboard/subscription"); setIsMobileMenuOpen(false); }} />
          </div>

          <div className="h-px bg-gray-100" />

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-3">Account</p>
            <MobileMenuItem icon={<span className="text-sm font-bold text-purple-600">{initial}</span>} label="Profile" onClick={() => { navigate("/dashboard/profile"); setIsMobileMenuOpen(false); }} />
            <MobileMenuItem label="Logout" danger onClick={() => dispatch(logoutUser())} />
          </div>

        </div>
      )}
    </div>
  );
}

function MobileMenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left
        ${danger
          ? "text-red-500 hover:bg-red-50"
          : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
        }`}
    >
      {icon && <span className={danger ? "text-red-400" : "text-gray-400"}>{icon}</span>}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
