import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Lock, Camera, Trash2, Pencil, Check, X,
  User, Mail, Phone, Globe, Sparkles, ShieldCheck,
} from "lucide-react";
import google from "../../assets/google-icon.svg";
import { useDispatch, useSelector } from "react-redux";
import { getUser, updateUser } from "../../redux/actions/userActions";

export default function UserProfile() {
  const dispatch = useDispatch();
  const { profile: reduxProfile, loading } = useSelector((state) => state.user);

  useEffect(() => { dispatch(getUser()); }, [dispatch]);

  const [profile, setProfile] = useState({ name: "", email: "", phone: "", country: "", photo: null });
  const [originalProfile, setOriginalProfile] = useState(profile);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (reduxProfile) {
      const p = {
        name:    reduxProfile.name    || "",
        email:   reduxProfile.email   || "",
        phone:   reduxProfile.phone   || "",
        country: reduxProfile.country || "India",
        photo:   reduxProfile.photo   || null,
      };
      setProfile(p);
      setOriginalProfile(p);
    }
  }, [reduxProfile]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) setProfile((p) => ({ ...p, photo: URL.createObjectURL(file) }));
  };

  const handleEdit = () => { setOriginalProfile(profile); setIsEditing(true); };
  const handleCancel = () => { setProfile(originalProfile); setIsEditing(false); };
  const handleSave = async () => {
    try { await dispatch(updateUser(profile)); setIsEditing(false); }
    catch (err) { console.error("Failed to update profile", err); }
  };

  const initials = profile.name ? profile.name.slice(0, 2).toUpperCase() : "U";

  if (loading && !reduxProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-10 h-10 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 md:px-6 pt-8 pb-12">

      {/* ── PAGE HEADER ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shadow-purple-200">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">Account</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">My Profile</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your personal information and preferences</p>
      </div>

      <div className="max-w-2xl space-y-5">

        {/* ── PROFILE CARD ── */}
        <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50 rounded-2xl">
              <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Gradient top accent */}
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

          {/* Avatar section */}
          <div className="px-6 pt-6 pb-5 flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-gray-100">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg shadow-purple-200 overflow-hidden">
                {profile.photo
                  ? <img src={profile.photo} alt="profile" className="w-full h-full object-cover" />
                  : initials
                }
              </div>
              {/* Camera overlay */}
              <button
                onClick={() => fileInputRef.current.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white flex items-center justify-center shadow-md hover:scale-105 transition-transform"
              >
                <Camera size={12} className="text-white" />
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoChange} />
            </div>

            {/* Name + email + actions */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-lg font-extrabold text-gray-900 truncate">{profile.name || "Your Name"}</h2>
              <p className="text-sm text-gray-400 truncate">{profile.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                {profile.photo && (
                  <button
                    onClick={() => setProfile((p) => ({ ...p, photo: null }))}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition"
                >
                  <Camera size={12} /> Change Photo
                </button>
              </div>
            </div>

            {/* Edit / Save / Cancel */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-200 hover:from-purple-500 hover:to-pink-400 transition-all"
                  >
                    <Check size={13} /> Save
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="divide-y divide-gray-100">
            <ProfileField
              icon={<User size={13} />}
              label="Full Name"
              value={profile.name}
              isEditing={isEditing}
              placeholder="Enter your name"
              onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
            />
            <ProfileField
              icon={<Mail size={13} />}
              label="Email Address"
              value={profile.email}
              isEditing={false}
              locked
            />
            <ProfileField
              icon={<Phone size={13} />}
              label="Phone Number"
              value={profile.phone}
              isEditing={isEditing}
              placeholder="Enter phone number"
              onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
            />

            {/* Country — select */}
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Globe size={13} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Country</p>
                {isEditing ? (
                  <select
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                    value={profile.country}
                    onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                  >
                    <option>India</option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>Canada</option>
                    <option>Australia</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-gray-700">{profile.country || "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer save bar — shown when editing */}
          {isEditing && (
            <div className="px-6 py-4 bg-purple-50/60 border-t border-purple-100 flex items-center justify-between gap-3">
              <p className="text-xs text-purple-600 font-medium">Editing profile — unsaved changes</p>
              <div className="flex gap-2">
                <button onClick={handleCancel} className="h-9 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition">
                  Cancel
                </button>
                <button onClick={handleSave} className="h-9 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-bold shadow-md shadow-purple-200 hover:from-purple-500 hover:to-pink-400 transition-all flex items-center gap-2">
                  <Check size={14} /> Save Changes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── PASSWORD CARD ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
          <div className="px-6 py-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-gray-900 mb-1">Password & Security</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                To change or reset your password, visit the{" "}
                <Link to="/forgot-password" className="text-purple-600 font-semibold hover:underline">
                  password reset page
                </Link>{" "}
                so we can verify your identity.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="flex-shrink-0 h-8 px-4 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition flex items-center gap-1.5"
            >
              <ShieldCheck size={12} /> Reset
            </Link>
          </div>
        </div>

        {/* ── CONNECTED ACCOUNTS CARD ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400" />
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-extrabold text-gray-900">Connected Accounts</h3>
            <p className="text-xs text-gray-400 mt-0.5">Services you use to sign in to Clipsyfy</p>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 hover:border-purple-200 hover:bg-purple-50/30 transition">
              <div className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center flex-shrink-0 shadow-sm p-1.5">
                <img src={google} alt="Google" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">Google</p>
                <p className="text-xs text-gray-400 truncate">{profile.email || profile.name}</p>
              </div>
              <button className="flex-shrink-0 h-8 px-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
                Disconnect
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── FIELD ROW ── */
function ProfileField({ icon, label, value, isEditing, placeholder, onChange, locked }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          {locked && (
            <span className="text-[9px] font-bold text-gray-300 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              locked
            </span>
          )}
        </div>
        {isEditing && !locked ? (
          <input
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <p className="text-sm font-semibold text-gray-700 truncate">{value || <span className="text-gray-300 font-normal">—</span>}</p>
        )}
      </div>
    </div>
  );
}
