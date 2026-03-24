import { useState } from "react";
import { ImagePlus, X } from "lucide-react";

export default function ProductInput({ index, brand, updateField, onRemove }) {
  const [preview, setPreview] = useState(null);

  const updateProduct = (field, value) => {
    const products = [...brand.products];
    products[index][field] = value;
    updateField("products", products);
  };

  const upload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      updateProduct("image", url);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px] font-extrabold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-gray-500">Product {index + 1}</span>
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex gap-3">

        {/* Image upload */}
        <label className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer
          bg-gray-50 border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all duration-150 group">
          <input type="file" className="hidden" onChange={upload} accept="image/*" />
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <ImagePlus size={18} className="text-gray-300 group-hover:text-purple-400 transition-colors" />
              <span className="text-[9px] text-gray-300 group-hover:text-purple-400 font-semibold transition-colors">Upload</span>
            </div>
          )}
        </label>

        {/* Fields */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <input
            placeholder="Product name"
            className="brand-input !py-2 text-sm"
            onChange={(e) => updateProduct("name", e.target.value)}
          />
          <textarea
            placeholder="Product description (optional)"
            rows={2}
            className="brand-input !py-2 text-sm resize-none"
            onChange={(e) => updateProduct("description", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
