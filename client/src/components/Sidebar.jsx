import { Home, Award, LogOut,Images, Crown } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../redux/actions/authAction";
import LogoutModal from "./LogoutModal";
import { toast } from "react-toastify";
import { useState } from "react";

export default function Sidebar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user     = useSelector((s) => s.auth?.user);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const initial  = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="hidden md:flex w-[72px] flex-col items-center
      bg-white/80 backdrop-blur-xl border-r border-gray-200/80
      relative py-5 gap-2">

      {/* Right gradient accent */}
      <div className="absolute top-8 right-0 bottom-8 w-[2px] bg-gradient-to-b from-purple-400/0 via-purple-400/30 to-pink-400/0 pointer-events-none" />

      {/* ── NAV ITEMS ── */}
      <nav className="flex flex-col items-center gap-1 w-full px-3 flex-1">
        <SidebarItem to="/dashboard"              icon={<Home size={19} />}      label="Studio"  end />
        <SidebarItem to="/dashboard/gallery"      icon={<Images size={19} />}  label="Gallery"     />
        <SidebarItem to="/dashboard/brand"        icon={<Award size={19} />} label="Brand"       />
        <SidebarItem to="/dashboard/subscription" icon={<Crown size={19} />}       label="Upgrade"     />
      </nav>

      {/* ── DIVIDER ── */}
      <div className="w-8 h-px bg-gray-200 my-1" />

      {/* ── BOTTOM ACTIONS ── */}
      <div className="flex flex-col items-center gap-1 w-full px-3">

        <SidebarButton
          icon={<LogOut size={18} />}
          label="Logout"
          danger
          onClick={() => setShowLogoutModal(true)}
        />

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

        {/* ── AVATAR / SETTINGS ── */}
        <button
          onClick={() => navigate("/dashboard/profile")}
          title={user?.name || user?.email || "Profile"}
          className="group flex flex-col items-center justify-center w-full py-2.5 rounded-xl border border-transparent
            hover:bg-purple-50 hover:border-purple-100 transition-all duration-200"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500
            flex items-center justify-center text-white text-sm font-bold
            ring-2 ring-offset-2 ring-offset-white ring-transparent
            group-hover:ring-purple-400 transition-all duration-200 shadow-md shadow-purple-200"
          >
            {initial}
          </div>
          <span className="text-[9px] font-bold mt-1 tracking-wide text-gray-400 group-hover:text-purple-500 transition-colors duration-200">
            Profile
          </span>
        </button>

      </div>
    </div>
  );
}

function SidebarItem({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex flex-col items-center justify-center w-full py-2.5 rounded-xl transition-all duration-200 cursor-pointer
         ${isActive
           ? "bg-gradient-to-b from-purple-500 to-pink-500 shadow-md shadow-purple-200"
           : "hover:bg-purple-50 border border-transparent hover:border-purple-100"
         }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`transition-colors duration-200 ${isActive ? "text-white" : "text-gray-400 group-hover:text-purple-500"}`}>
            {icon}
          </span>
          <span className={`text-[9px] font-bold mt-1 tracking-wide transition-colors duration-200 ${isActive ? "text-white" : "text-gray-400 group-hover:text-purple-500"}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function SidebarButton({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group flex flex-col items-center justify-center w-full py-2.5 rounded-xl border border-transparent transition-all duration-200
        ${danger
          ? "text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100"
          : "text-gray-400 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-100"
        }`}
    >
      <span>{icon}</span>
      <span className="text-[9px] font-bold mt-1 tracking-wide">{label}</span>
    </button>
  );
}
