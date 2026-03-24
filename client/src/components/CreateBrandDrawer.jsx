import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import ProductInput from "./ProductInput";
import IndustryInput from "./IndustryInput";
import { X, Plus, Sparkles, Tag, FileText, Megaphone, Briefcase, Package, ImagePlus, Trash2 } from "lucide-react";

export default function CreateBrandDrawer({ close, onCreate }) {
  const [brand, setBrand] = useState({
    name: "", industry: "", description: "", slogan: "", logo: null, products: [],
  });

  const logoInputRef = useRef(null);

  const updateField = (field, value) => setBrand((b) => ({ ...b, [field]: value }));
  const addProduct  = () => updateField("products", [...brand.products, { name: "", description: "", image: null }]);
  const removeProduct = (idx) =>
    updateField("products", brand.products.filter((_, i) => i !== idx));

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) updateField("logo", URL.createObjectURL(file));
    e.target.value = "";
  };

  const initials = brand.name?.slice(0, 2).toUpperCase() || "BR";
  const gradients = [
    "from-purple-500 to-pink-500",
    "from-blue-500 to-purple-500",
    "from-emerald-500 to-teal-400",
    "from-orange-400 to-pink-500",
    "from-indigo-500 to-blue-500",
  ];
  const gradient = gradients[(brand.name?.charCodeAt(0) || 0) % gradients.length];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/30" />

      <div
        className="relative w-full md:w-[520px] bg-white h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── GRADIENT TOP BAR ── */}
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-200">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Create Brand</h2>
              <p className="text-[11px] text-gray-400">Fill in your brand details below</p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── BRAND PREVIEW CARD ── */}
        <div className="mx-6 mt-5 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-extrabold shadow-md flex-shrink-0 transition-all duration-300 overflow-hidden`}>
            {brand.logo
              ? <img src={brand.logo} alt="logo" className="w-full h-full object-contain p-1" />
              : initials
            }
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">
              {brand.name || <span className="text-gray-400 font-normal">Your brand name</span>}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {brand.industry || "Industry"}{brand.slogan ? ` · "${brand.slogan}"` : ""}
            </p>
          </div>
        </div>

        {/* ── FORM ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Brand Info section */}
          <SectionLabel icon={<Tag size={13} />} label="Brand Info" />

          {/* Logo upload */}
          <Field label="Brand Logo" icon={<ImagePlus size={13} />}>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            {brand.logo ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <div className="w-12 h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                  <img src={brand.logo} alt="logo" className="w-full h-full object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">Logo uploaded</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Click change to replace</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current.click()}
                    className="h-7 px-2.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-500 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("logo", null)}
                    className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current.click()}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50/40 bg-gray-50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 group-hover:border-purple-300 flex items-center justify-center shadow-sm flex-shrink-0 transition">
                  <ImagePlus size={16} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-500 group-hover:text-purple-600 transition-colors">Upload logo</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">PNG, SVG, JPG recommended</p>
                </div>
              </button>
            )}
          </Field>

          <Field label="Brand Name" icon={<Briefcase size={13} />}>
            <input
              placeholder="e.g. NovaTech"
              className="brand-input"
              value={brand.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </Field>

          <Field label="Industry" icon={<Briefcase size={13} />}>
            <IndustryInput
              value={brand.industry}
              onChange={(v) => updateField("industry", v)}
            />
          </Field>

          <Field label="Slogan" icon={<Megaphone size={13} />}>
            <input
              placeholder="e.g. Innovate the Future"
              className="brand-input"
              value={brand.slogan}
              onChange={(e) => updateField("slogan", e.target.value)}
            />
          </Field>

          <Field label="Description" icon={<FileText size={13} />}>
            <textarea
              placeholder="Brief description of your brand…"
              rows={3}
              className="brand-input resize-none"
              value={brand.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </Field>

          {/* Products section */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel icon={<Package size={13} />} label="Products" />
              {brand.products.length > 0 && (
                <button
                  onClick={addProduct}
                  className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg transition"
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {brand.products.length === 0 ? (
              <button
                onClick={addProduct}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl
                  border-2 border-dashed border-gray-200 hover:border-purple-400
                  bg-gray-50 hover:bg-purple-50 py-8
                  transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 group-hover:border-purple-300 group-hover:bg-purple-50 flex items-center justify-center shadow-sm transition-all duration-200">
                  <Plus size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-gray-400 group-hover:text-purple-500 transition-colors">
                  Add your first product
                </p>
              </button>
            ) : (
              <div className="space-y-2">
                {brand.products.map((_, i) => (
                  <ProductInput
                    key={i}
                    index={i}
                    brand={brand}
                    updateField={updateField}
                    onRemove={() => removeProduct(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex gap-3">
          <button
            onClick={close}
            className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(brand)}
            className="flex-1 h-11 rounded-xl text-sm font-bold
              bg-gradient-to-r from-purple-600 to-pink-500 text-white
              hover:from-purple-500 hover:to-pink-400
              shadow-md shadow-purple-200 transition-all duration-200
              flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            Create Brand
          </button>
        </div>

        <style>{`
          .brand-input {
            width: 100%;
            background: #fff;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            padding: 10px 13px;
            font-size: 13px;
            color: #111827;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .brand-input::placeholder { color: #9ca3af; }
          .brand-input:focus {
            border-color: #a855f7;
            box-shadow: 0 0 0 3px rgba(168,85,247,0.1);
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
}

function SectionLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-purple-400">{icon}</span>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">{icon}</span>
        <label className="text-xs font-bold text-gray-500">{label}</label>
      </div>
      {children}
    </div>
  );
}
