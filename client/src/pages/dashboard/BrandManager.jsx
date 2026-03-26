import { useState } from "react";
import CreateBrandDrawer from "../../components/CreateBrandDrawer";
import EditBrandDrawer from "../../components/EditBrandDrawer";
import ProductGalleryDrawer from "../../components/ProductGalleryDrawer";
import { Sparkles, Plus, Turntable, Building2, Pencil } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { createProject, fetchProjects } from "../../redux/actions/projectAction";
import { useEffect } from "react";

const dummyBrands = [
  {
    name: "NovaTech",
    industry: "Technology",
    slogan: "Innovate the Future",
    description: "Next generation smart devices",
    logo: null,
    products: [
      { name: "Nova Laptop Pro",     image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8" },
      { name: "Nova Wireless Mouse", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3" },
      { name: "Nova Smart Monitor",  image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf" },
      { name: "Nova Laptop Pro",     image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8" },
      { name: "Nova Wireless Mouse", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3" },
      { name: "Nova Smart Monitor",  image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf" },
    ],
  },
  {
    name: "GlowSkin",
    industry: "Beauty",
    slogan: "Glow Naturally",
    description: "Premium skincare products",
    logo: null,
    products: [
      { name: "Vitamin C Serum",      image: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb" },
      { name: "Hydrating Face Cream", image: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd" },
    ],
  },
  {
    name: "UrbanFit",
    industry: "Fitness",
    slogan: "Train Smart",
    description: "Modern fitness gear",
    logo: null,
    products: [
      { name: "Smart Fitness Watch", image: "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b" },
      { name: "Training Shoes",      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff" },
    ],
  },
];

export default function BrandManager() {
  const dispatch = useDispatch();
  const { projects, loading } = useSelector((state) => state.project);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [editingBrand, setEditingBrand] = useState(null);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3002";

  // Map backend projects to UI structure
  const brands = (projects || []).map((p) => ({
    id: p._id,
    name: p.brandName || p.projectName,
    industry: p.industry || p.niche,
    slogan: p.slogan,
    description: p.description,
    logo: p.logoUrl ? `${API_URL}/${p.logoUrl}` : null,
    products: (p.products || []).map((prod) => ({
      name: prod.productName,
      image: prod.productImage ? `${API_URL}/${prod.productImage}` : null,
    })),
  }));

  const addBrand = async (brandData) => {
    try {
      const formData = new FormData();
      formData.append("projectName", brandData.name);
      formData.append("brandName", brandData.name);
      formData.append("industry", brandData.industry);
      formData.append("niche", brandData.industry);
      formData.append("description", brandData.description);
      formData.append("slogan", brandData.slogan);

      if (brandData.logo) {
        formData.append("logo", brandData.logo);
      }

      const productsWithNames = brandData.products.map((p, i) => {
        if (p.image) {
          formData.append("mediaFiles", p.image);
        }
        return {
          productName: p.name,
          productImage: "", // Backend will sync these with mediaFiles
        };
      });

      formData.append("products", JSON.stringify(productsWithNames));

      await dispatch(createProject(formData));
      setOpenDrawer(false);
    } catch (error) {
      console.error("Failed to create brand project:", error);
    }
  };

  const updateBrand = (updated) => {
    setEditingBrand((prev) =>
      prev.map((b) => (b.name === editingBrand.name ? updated : b))
    );
    setEditingBrand(null);
  };

  const deleteBrand = () => {
    setEditingBrand((prev) => prev.filter((b) => b.name !== editingBrand.name));
    setEditingBrand(null);
  };

  return (
    <div className="min-h-full text-gray-800">

      {/* ── HEADER ── */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shadow-purple-200">
                <Sparkles size={12} className="text-white" />
              </div>
              <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">
                Brand Studio
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              My Brands
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {brands.length === 0
                ? "No brands yet — create one to get started"
                : `${brands.length} brand${brands.length !== 1 ? "s" : ""} · ${brands.reduce((a, b) => a + b.products.length, 0)} products`}
            </p>
          </div>

          <button
            onClick={() => setOpenDrawer(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-bold
              bg-gradient-to-r from-purple-600 to-pink-500 text-white
              hover:from-purple-500 hover:to-pink-400
              shadow-md shadow-purple-200 hover:shadow-purple-300
              transition-all duration-200"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">New Brand</span>
          </button>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent mx-6" />

      {/* ── GRID ── */}
      <div className="px-6 py-6 font-geist">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-t-transparent"></div>
          </div>
        ) : brands.length === 0 ? (
          <EmptyState onCreateClick={() => setOpenDrawer(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {brands.map((brand, i) => (
              <BrandCard
                key={i}
                brand={brand}
                onClick={() => setSelectedBrand(brand)}
                onEdit={(e) => { e.stopPropagation(); setEditingBrand(brand); }}
              />
            ))}

            {/* ── ADD CARD ── */}
            <button
              onClick={() => setOpenDrawer(true)}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl
                border-2 border-dashed border-gray-300 hover:border-purple-400
                bg-white/60 hover:bg-purple-50/60
                min-h-[220px] transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 group-hover:bg-purple-100 group-hover:border-purple-300 flex items-center justify-center transition-all duration-200">
                <Plus size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors duration-200" />
              </div>
              <span className="text-sm font-semibold text-gray-400 group-hover:text-purple-500 transition-colors duration-200">
                Add Brand
              </span>
            </button>
          </div>
        )}
      </div>

      {openDrawer    && <CreateBrandDrawer close={() => setOpenDrawer(false)} onCreate={addBrand} />}
      {selectedBrand && <ProductGalleryDrawer brand={selectedBrand} close={() => setSelectedBrand(null)} />}
      {editingBrand  && (
        <EditBrandDrawer
          brand={editingBrand}
          close={() => setEditingBrand(null)}
          onUpdate={updateBrand}
          onDelete={deleteBrand}
        />
      )}
    </div>
  );
}

/* ─────────────── BRAND CARD ─────────────── */
const cardGradients = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-purple-500",
  "from-emerald-500 to-teal-400",
  "from-orange-400 to-pink-500",
  "from-indigo-500 to-blue-500",
];

function BrandCard({ brand, onClick, onEdit }) {
  const initials = brand.name.slice(0, 2).toUpperCase();
  const gradient = cardGradients[brand.name.charCodeAt(0) % cardGradients.length];

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl bg-white border border-gray-200
        hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100
        transition-all duration-200 overflow-hidden"
    >
      {/* Product image strip */}
      <div className="relative h-32 grid grid-cols-3 gap-0.5 overflow-hidden bg-gray-100">
        {brand.products.slice(0, 3).map((p, i) => (
          <div key={i} className="relative overflow-hidden">
            <img
              src={p.image}
              alt={p.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ))}
        {brand.products.length === 0 && (
          <div className="col-span-3 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
            <Building2 size={24} className="text-purple-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />

        {/* Edit button — top right, visible on hover */}
        <button
          onClick={onEdit}
          className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-white/90 border border-gray-200
            flex items-center justify-center text-gray-500
            opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0
            hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600
            transition-all duration-200 shadow-sm z-10"
        >
          <Pencil size={12} />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-extrabold shadow-md flex-shrink-0 overflow-hidden`}>
            {brand.logo
              ? <img src={brand.logo} alt="logo" className="w-full h-full object-contain p-0.5" />
              : initials
            }
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm truncate">{brand.name}</h3>
            <p className="text-[11px] text-gray-400 truncate">{brand.industry}</p>
          </div>
        </div>

        {brand.slogan && (
          <p className="text-xs text-gray-500 italic mb-3 line-clamp-1">"{brand.slogan}"</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {brand.products.length} product{brand.products.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[11px] font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
            View →
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── EMPTY STATE ─────────────── */
function EmptyState({ onCreateClick }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200 flex items-center justify-center mb-4 shadow-sm">
        <Turntable size={28} className="text-purple-400" />
      </div>
      <h3 className="text-base font-bold text-gray-700 mb-1">No brands yet</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-5">
        Create your first brand to start generating targeted content.
      </p>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-bold
          bg-gradient-to-r from-purple-600 to-pink-500 text-white
          shadow-md shadow-purple-200 hover:from-purple-500 hover:to-pink-400 transition-all duration-200"
      >
        <Plus size={15} />
        Create Brand
      </button>
    </div>
  );
}
