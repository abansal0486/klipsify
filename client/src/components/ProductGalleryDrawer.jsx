import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Package, Tag, Sparkles, LayoutGrid, List } from "lucide-react";

const cardGradients = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-purple-500",
  "from-emerald-500 to-teal-400",
  "from-orange-400 to-pink-500",
  "from-indigo-500 to-blue-500",
];

export default function ProductGalleryDrawer({ brand, close }) {
  const [view, setView] = useState("grid");

  const initials = brand.name.slice(0, 2).toUpperCase();
  const gradient = cardGradients[brand.name.charCodeAt(0) % cardGradients.length];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/30" />

      <div
        className="relative w-full md:w-[580px] bg-white h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HERO HEADER ── */}
        <div className={`relative bg-gradient-to-br ${gradient} px-6 pt-8 pb-6 overflow-hidden`}>
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute top-4 right-12 w-16 h-16 rounded-full bg-white/10" />

          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition"
          >
            <X size={15} />
          </button>

          {/* Brand identity */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-lg font-extrabold shadow-lg backdrop-blur-sm">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white leading-tight">{brand.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 bg-white/15 border border-white/20 px-2 py-0.5 rounded-full">
                  <Tag size={9} />
                  {brand.industry}
                </span>
                <span className="text-[11px] text-white/60">
                  {brand.products.length} product{brand.products.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Slogan & description */}
          {(brand.slogan || brand.description) && (
            <div className="mt-4 relative z-10">
              {brand.slogan && (
                <p className="text-sm text-white font-semibold italic">"{brand.slogan}"</p>
              )}
              {brand.description && (
                <p className="text-xs text-white/70 mt-1">{brand.description}</p>
              )}
            </div>
          )}
        </div>

        {/* ── PRODUCTS TOOLBAR ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-purple-400" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Products</span>
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-white border border-gray-200 rounded-lg shadow-sm">
            <button
              onClick={() => setView("grid")}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${view === "grid" ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${view === "list" ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
            >
              <List size={13} />
            </button>
          </div>
        </div>

        {/* ── PRODUCTS CONTENT ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {brand.products.length === 0 ? (
            <EmptyProducts />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-3">
              {brand.products.map((product, i) => (
                <GridProductCard key={i} product={product} industry={brand.industry} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {brand.products.map((product, i) => (
                <ListProductCard key={i} product={product} industry={brand.industry} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── GRID CARD ── */
function GridProductCard({ product, industry }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="group rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100/60 transition-all duration-200">
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200" />}
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {!product.image && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={24} className="text-gray-300" />
          </div>
        )}
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-bold text-gray-800 truncate">{product.name || "Unnamed Product"}</p>
        {product.description
          ? <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
          : <p className="text-[11px] text-gray-400 mt-0.5">{industry}</p>
        }
      </div>
    </div>
  );
}

/* ── LIST CARD ── */
function ListProductCard({ product, industry, index }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-purple-300 hover:shadow-md hover:shadow-purple-100/50 transition-all duration-200">
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-gray-100" />}
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={16} className="text-gray-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{product.name || "Unnamed Product"}</p>
        <p className="text-[11px] text-gray-400 truncate">
          {product.description || industry}
        </p>
      </div>
      <span className="w-6 h-6 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-500 flex-shrink-0">
        {index + 1}
      </span>
    </div>
  );
}

/* ── EMPTY STATE ── */
function EmptyProducts() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200 flex items-center justify-center mb-4 shadow-sm">
        <Package size={28} className="text-purple-400" />
      </div>
      <h3 className="text-sm font-bold text-gray-700 mb-1">No products added</h3>
      <p className="text-xs text-gray-400 max-w-xs">Edit this brand to add products to your catalog.</p>
    </div>
  );
}
