import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const INDUSTRIES = [
  "Technology",
  "Beauty & Skincare",
  "Fashion & Apparel",
  "Fitness & Wellness",
  "Food & Beverage",
  "Health & Pharma",
  "Education",
  "Finance & Fintech",
  "Travel & Hospitality",
  "Real Estate",
  "Automotive",
  "Entertainment & Media",
  "E-commerce & Retail",
  "Gaming",
  "Sports",
  "Home & Decor",
  "Pets & Animals",
  "Non-Profit",
  "Photography",
  "Music & Audio",
];

export default function IndustryInput({ value, onChange, placeholder = "e.g. Technology, Beauty, Fitness" }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState(value || "");
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);

  // Keep query in sync when value changes externally
  useEffect(() => { setQuery(value || ""); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? INDUSTRIES.filter((i) => i.toLowerCase().includes(query.toLowerCase()))
    : INDUSTRIES;

  const select = (industry) => {
    setQuery(industry);
    onChange(industry);
    setOpen(false);
  };

  const handleInput = (e) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="brand-input pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-500 transition-colors"
        >
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg shadow-gray-100/80 overflow-hidden">
          {/* Custom value hint */}
          {query.trim() && !INDUSTRIES.some((i) => i.toLowerCase() === query.toLowerCase()) && (
            <button
              type="button"
              onMouseDown={() => select(query.trim())}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-purple-50 border-b border-gray-100 transition-colors group"
            >
              <span className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-purple-600">+</span>
              </span>
              <span className="text-xs font-semibold text-purple-700 truncate">
                Use "<span className="font-bold">{query.trim()}</span>"
              </span>
            </button>
          )}

          {/* Filtered list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">No matches — press Enter to use custom</p>
            ) : (
              filtered.map((industry) => (
                <button
                  key={industry}
                  type="button"
                  onMouseDown={() => select(industry)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors
                    ${value === industry
                      ? "bg-purple-50 text-purple-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  <span>{industry}</span>
                  {value === industry && <Check size={12} className="text-purple-500 flex-shrink-0" strokeWidth={3} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
