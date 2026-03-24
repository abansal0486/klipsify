import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../redux/actions/authAction";
import { useNavigate } from "react-router-dom";
import { User, LogOut, CreditCard, Settings } from "lucide-react";

export default function ProfileDropdown() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth?.user);

  const initial     = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const displayName = user?.name || "User";
  const email       = user?.email || "";

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate("/login");
  };

  return (
    <div className="absolute right-0 top-[calc(100%+10px)] w-56 z-50
      bg-white border border-gray-200
      rounded-2xl shadow-xl shadow-purple-100/60 overflow-hidden">

      {/* Gradient top accent */}
      <div className="h-[3px] bg-gradient-to-r from-purple-500 to-pink-500" />

      {/* ── USER INFO ── */}
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md shadow-purple-200">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
          <p className="text-[11px] text-gray-400 truncate">{email}</p>
        </div>
      </div>

      <div className="mx-3 h-px bg-gray-100" />

      {/* ── MENU ITEMS ── */}
      <div className="p-2 space-y-0.5">
        <DropdownItem icon={<User size={14} />}       label="Profile"      onClick={() => navigate("/dashboard/profile")} />
        <DropdownItem icon={<CreditCard size={14} />} label="Subscription" onClick={() => navigate("/dashboard/subscription")} />
        <DropdownItem icon={<Settings size={14} />}   label="Settings"     onClick={() => navigate("/dashboard/profile")} />
      </div>

      <div className="mx-3 h-px bg-gray-100" />

      <div className="p-2">
        <DropdownItem icon={<LogOut size={14} />} label="Logout" danger onClick={handleLogout} />
      </div>
    </div>
  );
}

function DropdownItem({ icon, label, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 text-left
        ${danger
          ? "text-red-500 hover:bg-red-50"
          : "text-gray-600 hover:bg-purple-50 hover:text-purple-700"
        }`}
    >
      <span className={danger ? "text-red-400" : "text-gray-400"}>{icon}</span>
      {label}
    </button>
  );
}
