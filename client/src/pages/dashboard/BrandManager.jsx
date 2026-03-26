import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { Sparkles, Plus, Turntable, Building2, Pencil } from "lucide-react";

import CreateBrandDrawer from "../../components/CreateBrandDrawer";
import EditBrandDrawer from "../../components/EditBrandDrawer";
import ProductGalleryDrawer from "../../components/ProductGalleryDrawer";

import {
  fetchBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../../redux/actions/brandAction";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3002";

// Map a raw backend brand + its products to the UI shape
function mapBrand(b) {
  return {
    id: b._id,
    name: b.brandName,
    industry: b.industry || "",
    slogan: b.slogan || "",
    description: b.description || "",
    logo: b.logoViewUrl ? `${API_URL}/${b.logoViewUrl}` : null,
    products: (b.products || []).map((p) => ({
      id: p._id,
      name: p.productName,
      description: p.description || "",
      image: p.productImage ? `${API_URL}/${p.productImage}` : null,
    })),
  };
}

export default function BrandManager() {
  const dispatch = useDispatch();
  const { brands: rawBrands, loading } = useSelector((state) => state.brand);

  const [openDrawer, setOpenDrawer]     = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [editingBrand, setEditingBrand]   = useState(null);

  useEffect(() => { dispatch(fetchBrands()); }, [dispatch]);

  const brands = (rawBrands || []).map(mapBrand);

  // ── create ────────────────────────────────────────────────────────────────

  const handleCreate = async (brandData) => {
    if (!brandData.name?.trim()) {
      toast.error("Brand name is required");
      return;
    }
    try {
      // 1. Create brand (with optional logo)
      const brandForm = new FormData();
      brandForm.append("brandName", brandData.name.trim());
      if (brandData.industry)   brandForm.append("industry",    brandData.industry);
      if (brandData.description) brandForm.append("description", brandData.description);
      if (brandData.slogan)     brandForm.append("slogan",      brandData.slogan);
      if (brandData.logo instanceof File) brandForm.append("logo", brandData.logo);

      const newBrand = await dispatch(createBrand(brandForm));

      // 2. Add each product sequentially
      for (const p of brandData.products || []) {
        if (!p.name?.trim()) continue;
        const prodForm = new FormData();
        prodForm.append("productName", p.name.trim());
        if (p.description) prodForm.append("description", p.description);
        if (p.image instanceof File) prodForm.append("productImage", p.image);
        await dispatch(addProduct(newBrand._id, prodForm));
      }

      setOpenDrawer(false);
    } catch {
      // errors already toasted by action
    }
  };

  // ── update ────────────────────────────────────────────────────────────────

  const handleUpdate = async (updatedBrand) => {
    const original = editingBrand;
    try {
      // 1. Update brand fields + optional new logo
      const brandForm = new FormData();
      brandForm.append("brandName",    updatedBrand.name?.trim() || original.name);
      brandForm.append("industry",     updatedBrand.industry    || "");
      brandForm.append("description",  updatedBrand.description || "");
      brandForm.append("slogan",       updatedBrand.slogan      || "");
      if (updatedBrand.logoFile instanceof File) brandForm.append("logo", updatedBrand.logoFile);

      await dispatch(updateBrand(original.id, brandForm));

      // 2. Delete removed products
      const updatedIds = new Set((updatedBrand.products || []).map((p) => p.id).filter(Boolean));
      for (const p of original.products || []) {
        if (p.id && !updatedIds.has(p.id)) {
          await dispatch(deleteProduct(original.id, p.id));
        }
      }

      // 3. Update existing products (have id — name, description, or image changed)
      const originalProductMap = Object.fromEntries(
        (original.products || []).filter((p) => p.id).map((p) => [p.id, p])
      );
      for (const p of updatedBrand.products || []) {
        if (!p.id) continue;
        const orig = originalProductMap[p.id];
        const nameChanged  = orig?.name        !== p.name;
        const descChanged  = orig?.description !== p.description;
        const imageChanged = p.image instanceof File;
        if (!nameChanged && !descChanged && !imageChanged) continue;

        const prodForm = new FormData();
        prodForm.append("productName", p.name?.trim() || orig?.name || "");
        prodForm.append("description", p.description || "");
        if (imageChanged) prodForm.append("productImage", p.image);
        await dispatch(updateProduct(original.id, p.id, prodForm));
      }

      // 4. Add newly created products (no id)
      for (const p of updatedBrand.products || []) {
        if (p.id || !p.name?.trim()) continue;
        const prodForm = new FormData();
        prodForm.append("productName", p.name.trim());
        if (p.description)           prodForm.append("description",  p.description);
        if (p.image instanceof File) prodForm.append("productImage", p.image);
        await dispatch(addProduct(original.id, prodForm));
      }

      setEditingBrand(null);
    } catch {
      // errors already toasted by action
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    try {
      await dispatch(deleteBrand(editingBrand.id));
      setEditingBrand(null);
    } catch {
      // errors already toasted by action
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full text-gray-800">

      {/* HEADER */}
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

      <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent mx-6" />

      {/* GRID */}
      <div className="px-6 py-6 font-geist">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-t-transparent" />
          </div>
        ) : brands.length === 0 ? (
          <EmptyState onCreateClick={() => setOpenDrawer(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {brands.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                onClick={() => setSelectedBrand(brand)}
                onEdit={(e) => { e.stopPropagation(); setEditingBrand(brand); }}
              />
            ))}

            <button
              onClick={() => setOpenDrawer(true)}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl
                border-2 border-dashed border-gray-300 hover:border-purple-400
                bg-white/60 hover:bg-purple-50/60 min-h-[220px] transition-all duration-200"
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

      {openDrawer && (
        <CreateBrandDrawer close={() => setOpenDrawer(false)} onCreate={handleCreate} />
      )}
      {selectedBrand && (
        <ProductGalleryDrawer brand={selectedBrand} close={() => setSelectedBrand(null)} />
      )}
      {editingBrand && (
        <EditBrandDrawer
          brand={editingBrand}
          close={() => setEditingBrand(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ── brand card ──────────────────────────────────────────────────────────── */
const cardGradients = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-purple-500",
  "from-emerald-500 to-teal-400",
  "from-orange-400 to-pink-500",
  "from-indigo-500 to-blue-500",
];

function BrandCard({ brand, onClick, onEdit }) {
  const initials  = brand.name.slice(0, 2).toUpperCase();
  const gradient  = cardGradients[brand.name.charCodeAt(0) % cardGradients.length];

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl bg-white border border-gray-200
        hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100
        transition-all duration-200 overflow-hidden"
    >
      <div className="relative h-32 grid grid-cols-3 gap-0.5 overflow-hidden bg-gray-100">
        {brand.products.slice(0, 3).map((p, i) => (
          <div key={i} className="relative overflow-hidden">
            <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          </div>
        ))}
        {brand.products.length === 0 && (
          <div className="col-span-3 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
            <Building2 size={24} className="text-purple-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
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

/* ── empty state ─────────────────────────────────────────────────────────── */
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
