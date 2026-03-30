import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  ImagePlus,
  X,
  ChevronDown,
  Wand2,
  Mic,
  Volume2,
  User,
  Zap,
  Wind,
  Briefcase,
  Drama,
  Upload,
  Image,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import {
  generateContent,
  uploadImage,
} from "../redux/actions/imageVideoAction";
import { fetchBrands } from "../redux/actions/brandAction";
import { toast } from "react-toastify";
import RecentGenerations from "./RecentGenerations";
import { useNavigate } from "react-router-dom";
import SideDrawer from "./SideDrawer";

const API_URL = import.meta.env.REACT_APP_API_URL || "http://localhost:3002";

function mapBrandForPromptBar(b) {
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

const typewriterPhrases = [
  "A cinematic sunset over Tokyo at golden hour...",
  "Product showcase with sleek 3D animation and studio lighting...",
  "Slow-motion coffee pour with dramatic dark background...",
  "Luxury car driving through rain-soaked city streets at night...",
  "A futuristic robot dancing in a neon-lit warehouse...",
  "Aerial drone shot of snow-capped mountains at sunrise...",
  "Fashion model walking in slow motion on a rooftop in Paris...",
  "Abstract fluid colors blending into a brand logo reveal...",
  "A cozy autumn cafe with falling leaves outside the window...",
  "Epic space journey through a colorful nebula galaxy...",
  "Minimalist product ad with bold typography and soft shadows...",
  "Ocean waves crashing at sunset with golden reflections...",
  "Time-lapse of a bustling city turning from day to night...",
  "A glowing portal opening in a misty enchanted forest...",
  "Wildfire spreading across a hilltop with cinematic smoke...",
];

export default function PromptBar() {
  const dispatch = useDispatch();
  const { brands: rawBrands } = useSelector((state) => state.brand);
  const [prompt, setPrompt] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState("video");
  const [selectedBrand, setSelectedBrand] = useState("Brand");
  const [brandStep, setBrandStep] = useState("list"); // "list" | "products"
  const [activeBrand, setActiveBrand] = useState(null); // brand object being browsed
  const [selectedContext, setSelectedContext] = useState(null); // { brand, product? }
  const [loading, setLoading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const navigate = useNavigate();
  const [drawerType, setDrawerType] = useState(null);

  const [ratio, setRatio] = useState("16:9");
  const [duration, setDuration] = useState("8s");

  const [audioPrompt, setAudioPrompt] = useState("");
  const [voiceGender, setVoiceGender] = useState("female");
  const [voiceTone, setVoiceTone] = useState("calm");
  const [hasSubtitle, setHasSubtitle] = useState(false);

  const containerRef = useRef(null);
  const [showStarDropdown, setShowStarDropdown] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  const referenceImages = useSelector(
    (state) => state.generation.referenceImages,
  );
  const logoImage = useSelector((state) => state.generation.logoImage);
  const promptText = useSelector((state) => state.generation.promptText);

  // Restore persisted state on mount
  useEffect(() => {
    if (promptText) setPrompt(promptText);
    if (promptText || referenceImages.length > 0 || logoImage)
      setIsExpanded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync prompt text to Redux so it survives navigation
  useEffect(() => {
    dispatch({ type: "SET_PROMPT_TEXT", payload: prompt });
  }, [prompt, dispatch]);

  useEffect(() => {
    dispatch(fetchBrands());
  }, [dispatch]);

  // ── Typewriter placeholder ──────────────────────────────────────────────

  const [twText, setTwText] = useState("");
  const [twPhrase, setTwPhrase] = useState(0);
  const [twChar, setTwChar] = useState(0);
  const [twDeleting, setTwDeleting] = useState(false);

  useEffect(() => {
    const current = typewriterPhrases[twPhrase];
    let timeout;
    if (!twDeleting && twChar === current.length) {
      timeout = setTimeout(() => setTwDeleting(true), 1800);
    } else if (twDeleting && twChar === 0) {
      timeout = setTimeout(() => {
        setTwDeleting(false);
        setTwPhrase((p) => {
          let next;
          do {
            next = Math.floor(Math.random() * typewriterPhrases.length);
          } while (next === p);
          return next;
        });
      }, 400);
    } else if (!twDeleting) {
      timeout = setTimeout(() => {
        setTwText(current.slice(0, twChar + 1));
        setTwChar((c) => c + 1);
      }, 55);
    } else {
      timeout = setTimeout(() => {
        setTwText(current.slice(0, twChar - 1));
        setTwChar((c) => c - 1);
      }, 28);
    }
    return () => clearTimeout(timeout);
  }, [twChar, twDeleting, twPhrase]);
  // ────────────────────────────────────────────────────────────────────────

  const referenceInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const audioRef = useRef(null);
  const textareaRef = useRef(null);
  const starRef = useRef(null);

  const user = useSelector((state) => state.auth?.user);

  const getUserId = () => {
    return user?.id || null;
  };

  // Reference Images Upload
  const handleReferenceUpload = async (files) => {
    if (!files?.length) return;
    setIsExpanded(true);

    const remainingSlots = 3 - referenceImages.length;
    if (remainingSlots <= 0) {
      toast.error("Maximum 3 reference images allowed");
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);

    try {
      setUploadingRef(true);
      const uploadedImages = [];

      for (const file of filesToUpload) {
        try {
          const url = await uploadImage(file);
          uploadedImages.push({ url, name: file.name });
        } catch (err) {
          console.error("Reference image upload failed:", err.message);
          toast.error(`Upload failed: ${err.message}`);
        }
      }

      if (uploadedImages.length > 0) {
        dispatch({ type: "SET_REFERENCE_IMAGES", payload: uploadedImages });
        toast.success("Reference image(s) uploaded");
      }
    } finally {
      setUploadingRef(false);
    }

    // Clear input
    if (referenceInputRef.current) referenceInputRef.current.value = "";
  };

  // Logo Upload
  const handleLogoUpload = async (file) => {
    if (!file) return;

    if (logoImage || uploadingLogo) {
      toast.error(
        "Logo already uploaded. Remove it first to upload a new one.",
      );
      return;
    }

    try {
      setIsExpanded(true);
      setUploadingLogo(true);

      const url = await uploadImage(file);

      dispatch({
        type: "SET_LOGO_IMAGE",
        payload: { url, name: file.name },
      });

      toast.success("Logo uploaded");
    } catch (err) {
      console.error("Logo upload failed:", err.message);
      toast.error("Logo upload failed: " + err.message);
    } finally {
      setUploadingLogo(false);
    }

    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const closeAllPopups = () => {
    setShowStarDropdown(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    const userId = getUserId();

    if (!userId) {
      toast.error("Please login first");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        userId,
        contentName: `${activeMode}-content`,
        prompt,
        aspectRatio: ratio,
        contentType: activeMode,
        ...(activeMode === "video" && {
          audioType: audioPrompt.trim() ? "voiceover" : "none",
          voiceOver: audioPrompt.trim() || undefined,
          voiceGender,
          hasSubtitle: audioPrompt.trim() ? hasSubtitle : false,
          videoDuration: duration,
        }),
        referenceImage:
          referenceImages.length > 0
            ? referenceImages.map((img) => img.url)
            : undefined,
        logo: logoImage ? logoImage.url : undefined,
      };

      await dispatch(generateContent(payload));

      toast.success("Generation started 🚀");

      // Reset
      setPrompt("");
      setAudioPrompt("");
      dispatch({ type: "SET_PROMPT_TEXT", payload: "" });

      // Navigate to gallery
      navigate("/dashboard/gallery");
    } catch (err) {
      console.error(err);
      toast.error("Generation failed");
    } finally {
      setLoading(false);
    }
  };

  // Close popup / collapse on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (starRef.current && !starRef.current.contains(e.target)) {
        setShowStarDropdown(false);
      }
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        const hasAnyContent =
          prompt.trim() ||
          referenceImages.length > 0 ||
          logoImage ||
          audioPrompt.trim();
        if (!hasAnyContent) setIsExpanded(false);
      }
    }

    window.addEventListener("pointerdown", handleOutside);
    return () => window.removeEventListener("pointerdown", handleOutside);
  }, [prompt, referenceImages, logoImage, audioPrompt]);

  const examplePrompts = [
    {
      title: "Sunset Ocean",
      desc: "A serene sunset over a calm ocean with golden hour lighting...",
    },
    {
      title: "Tokyo Street",
      desc: "A neon Tokyo street at night reflecting on wet pavement I want to make it more...",
    },
    {
      title: "Mountain Landscape",
      desc: "Snow-capped mountains with morning mist and cinematic light...",
    },
    {
      title: "Sunset Ocean",
      desc: "A serene sunset over a calm ocean with golden hour lighting...",
    },
    {
      title: "Tokyo Street",
      desc: "A neon Tokyo street at night reflecting on wet pavement...",
    },
    {
      title: "Mountain Landscape",
      desc: "Snow-capped mountains with morning mist and cinematic light...",
    },
  ];

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      const maxHeight = 260;
      if (el.scrollHeight > maxHeight) {
        el.style.height = maxHeight + "px";
        el.style.overflowY = "auto";
      } else {
        el.style.height = (el.scrollHeight || 64) + "px";
        el.style.overflowY = "hidden";
      }
    }
  }, [prompt]);

  return (
    <>
      <div className="relative z-10 flex flex-col items-center px-4 md:px-0 md:py-4 py-0  md:min-h-[calc(100vh-64px)]">
        {/* ── PREMIUM HEADER ── */}
        <div className="text-center mb-8 mt-6 px-4">
          <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur border border-purple-200/60 rounded-full px-4 py-1.5 mb-5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-semibold text-purple-700 tracking-wide uppercase">
              AI Content Studio
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-purple-700 via-pink-500 to-violet-600 bg-clip-text text-transparent leading-tight md:leading-snug">
            Create Anything
          </h1>
          <p className="text-sm md:text-base text-zinc-500 mt-3 max-w-md mx-auto leading-relaxed">
            Transform your ideas into stunning videos &amp; images powered by AI
          </p>
        </div>
        {/* ================= PROMPT BAR ================= */}
        <div
          ref={containerRef}
          className="relative w-full max-w-2xl mx-auto px-3 md:px-0"
        >
          {/* ================= MAIN BAR ================= */}
          <div className="relative">
            {/* Rotating Gradient Border */}
            <div className="absolute -inset-[2px] rounded-3xl pointer-events-none overflow-hidden">
              <div className="absolute inset-0 rounded-3xl animate-spinSlow bg-[conic-gradient(from_0deg,#ec4899,#8b5cf6,#3b82f6,#ec4899)] opacity-70 blur-sm" />
            </div>

            {/* Content Layer (Not clipped, allows dropdowns to float outside) */}
            <div
              className={`relative z-10 rounded-3xl border border-black/20 bg-white backdrop-blur-2xl transition-all duration-300 p-[2px] ${
                isExpanded
                  ? "shadow-[0_0_60px_rgba(168,85,247,0.35)]"
                  : "shadow-[0_0_30px_rgba(168,85,247,0.15)]"
              }`}
            >
              {/* ================= MODE SWITCH ================= */}
              <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-2">
                <div className="relative flex bg-black/[0.04] border border-black/[0.08] rounded-xl p-1 overflow-hidden">
                  {/* sliding indicator */}
                  <div
                    className={`
                absolute top-1 bottom-1
                w-[calc(50%-5px)]
                rounded-lg
                bg-gradient-to-r from-purple-500 to-pink-500
                transition-all duration-300
                ${activeMode === "video" ? "left-[calc(50%+2px)]" : "left-1"}
              `}
                  />
                  {/* IMAGE BUTTON */}
                  <button
                    onClick={() => {
                      setActiveMode("image");
                      closeAllPopups();
                    }}
                    className={`relative z-10 px-4 py-1.5 text-xs md:text-sm font-medium rounded-lg transition ${
                      activeMode === "image"
                        ? "text-white"
                        : "text-zinc-600 hover:text-black"
                    }`}
                  >
                    Image
                  </button>

                  {/* VIDEO BUTTON */}
                  <button
                    onClick={() => {
                      setActiveMode("video");
                      closeAllPopups();
                    }}
                    className={`relative z-10 px-4 py-1.5 text-xs md:text-sm font-medium rounded-lg transition ${
                      activeMode === "video"
                        ? "text-white"
                        : "text-zinc-600 hover:text-black"
                    }`}
                  >
                    Video
                  </button>
                </div>
              </div>
              {/* ================= SELECTED IMAGES ================= */}
              {isExpanded && (referenceImages.length > 0 || logoImage) && (
                <div className="px-4 md:px-6 pb-2">
                  <div className="flex gap-2 flex-wrap items-center">
                    {referenceImages.map((file, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-purple-400 shadow-sm">
                          <img
                            src={
                              file?.url?.startsWith("http")
                                ? file.url
                                : `${import.meta.env.VITE_API_URL}${file?.url}`
                            }
                            alt="ref"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 text-[7px] text-center text-white font-semibold py-0.5 rounded-b-xl">
                          REF
                        </div>
                        <button
                          onClick={() =>
                            dispatch({
                              type: "REMOVE_REFERENCE_IMAGE",
                              payload: index,
                            })
                          }
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-zinc-200 text-zinc-500 text-[9px] flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition shadow-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {logoImage && (
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-pink-400 bg-zinc-50 shadow-sm flex items-center justify-center p-1">
                          <img
                            src={
                              logoImage?.url?.startsWith("http")
                                ? logoImage.url
                                : `${import.meta.env.VITE_API_URL}${logoImage?.url}`
                            }
                            alt="logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-pink-500/80 text-[7px] text-center text-white font-semibold py-0.5 rounded-b-xl">
                          LOGO
                        </div>
                        <button
                          onClick={() =>
                            dispatch({ type: "REMOVE_LOGO_IMAGE" })
                          }
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-zinc-200 text-zinc-500 text-[9px] flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition shadow-sm"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= PROMPT INPUT AREA ================= */}
              <div className="relative flex items-center gap-2 px-3 md:px-4 py-3">
                {/* ── UPLOAD BUTTON ── */}
                <button
                  onClick={() => {
                    setIsExpanded(true);
                    closeAllPopups();
                    setDrawerType("upload");
                  }}
                  className={`group relative z-10 flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200
                    ${
                      referenceImages.length > 0 || logoImage
                        ? "bg-gradient-to-br from-purple-500 to-pink-500 border border-purple-400 shadow-sm shadow-purple-200"
                        : "bg-zinc-100 border border-zinc-200 hover:bg-purple-50 hover:border-purple-300"
                    }`}
                >
                  <ImagePlus
                    size={17}
                    className={`${referenceImages.length > 0 || logoImage ? "text-white" : "text-zinc-500 group-hover:text-purple-600"} transition`}
                  />
                  {(referenceImages.length > 0 || logoImage) && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-white border border-purple-200 rounded-full text-[9px] font-bold text-purple-600 flex items-center justify-center">
                      {referenceImages.length + (logoImage ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* ── TEXTAREA ── */}
                <div className="flex-1 relative z-10">
                  {!prompt && (
                    <div className="absolute top-0 left-0 pointer-events-none text-zinc-400 text-xs md:text-[15px] leading-relaxed select-none">
                      {twText}
                      <span className="inline-block w-[1.5px] h-[1em] bg-zinc-300 ml-[1px] align-middle animate-pulse" />
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onFocus={() => setIsExpanded(true)}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={1}
                    placeholder=""
                    className="w-full bg-transparent outline-none text-zinc-900 text-xs md:text-[15px] leading-relaxed resize-none overflow-hidden min-h-[36px] max-h-[160px] md:max-h-[200px] scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent"
                  />
                </div>

                {/* ── SPARKLE BUTTON + DROPDOWN ── */}
                <div className="relative flex-shrink-0 z-50" ref={starRef}>
                  <button
                    onClick={() => {
                      setIsExpanded(true);
                      closeAllPopups();
                      setShowStarDropdown((prev) => !prev);
                    }}
                    className={`group flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200
                      ${
                        showStarDropdown
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 border border-purple-400 shadow-sm shadow-purple-200"
                          : "bg-zinc-100 border border-zinc-200 hover:bg-purple-50 hover:border-purple-300"
                      }`}
                  >
                    <Sparkles
                      size={17}
                      className={`${showStarDropdown ? "text-white" : "text-zinc-500 group-hover:text-purple-600"} transition`}
                    />
                  </button>

                  {/* ── DROPDOWN (opens ABOVE button, safe from overflow) ── */}
                  <AnimatePresence>
                    {showStarDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute bottom-full mb-2 right-0 w-[min(320px,80vw)] z-50"
                      >
                        <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl shadow-zinc-300/50 overflow-hidden flex flex-col">
                          {/* HEADER */}
                          <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-3 flex items-center gap-2.5 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                              <Sparkles size={13} className="text-white" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-semibold leading-none">
                                AI Assistant
                              </p>
                              <p className="text-white/70 text-[11px] mt-0.5">
                                Supercharge your prompt
                              </p>
                            </div>
                          </div>

                          {/* MENU ITEMS */}
                          <div className="p-2 space-y-1 flex-shrink-0">
                            {/* Describe with AI */}
                            <button
                              onClick={() => setShowStarDropdown(false)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-all duration-150 group text-left"
                            >
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                <Wand2 size={14} className="text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-zinc-800 group-hover:text-purple-700 transition">
                                  Describe with AI
                                </p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  Upload image → auto-generate prompt
                                </p>
                              </div>
                              <ChevronDown
                                size={12}
                                className="-rotate-90 text-zinc-300 group-hover:text-purple-400 transition flex-shrink-0"
                              />
                            </button>

                            {/* Example Prompts toggle */}
                            <button
                              onClick={() =>
                                setHoveredItem(
                                  hoveredItem === "examples"
                                    ? null
                                    : "examples",
                                )
                              }
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 group text-left
                                ${hoveredItem === "examples" ? "bg-pink-50 border-pink-200" : "border-transparent hover:bg-pink-50 hover:border-pink-100"}`}
                            >
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-150
                                ${hoveredItem === "examples" ? "bg-gradient-to-br from-pink-500 to-rose-500 scale-105" : "bg-gradient-to-br from-pink-400 to-rose-400"}`}
                              >
                                <Sparkles size={14} className="text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-semibold transition ${hoveredItem === "examples" ? "text-pink-700" : "text-zinc-800 group-hover:text-pink-600"}`}
                                >
                                  Example Prompts
                                </p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  Browse ready-to-use prompts
                                </p>
                              </div>
                              <ChevronDown
                                size={12}
                                className={`flex-shrink-0 transition-all duration-200 ${hoveredItem === "examples" ? "rotate-180 text-pink-400" : "text-zinc-300 group-hover:text-pink-400"}`}
                              />
                            </button>
                          </div>

                          {/* EXAMPLES LIST — scrollable, inside the card */}
                          <AnimatePresence>
                            {hoveredItem === "examples" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                className="overflow-hidden flex-shrink-0"
                              >
                                <div className="overflow-y-auto max-h-[200px] px-2 pb-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                                  {examplePrompts.map((item, index) => (
                                    <button
                                      key={index}
                                      onClick={() => {
                                        setPrompt(item.desc);
                                        setIsExpanded(true);
                                        setShowStarDropdown(false);
                                        setHoveredItem(null);
                                      }}
                                      className="w-full text-left px-3 py-2 rounded-xl bg-zinc-50 hover:bg-purple-50 border border-zinc-100 hover:border-purple-200 transition-all duration-150 group"
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 mt-1.5 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-zinc-700 group-hover:text-purple-700 transition">
                                            {item.title}
                                          </p>
                                          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                                            {item.desc}
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ================= EXPANDED SECTION ================= */}
              {isExpanded && (
                <div className="border-t border-black/[0.06] px-4 md:px-5 py-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* LEFT CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* ── RATIO / SETTINGS BUTTON ── */}
                      <button
                        onClick={() => {
                          closeAllPopups();
                          setDrawerType("settings");
                        }}
                        className="group relative flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full border border-zinc-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 shadow-sm"
                      >
                        {/* ratio icon */}
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 group-hover:bg-purple-100 transition">
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <rect
                              x="0.5"
                              y="2.5"
                              width="11"
                              height="7"
                              rx="1.5"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              className="text-zinc-500 group-hover:text-purple-600"
                            />
                          </svg>
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-600 group-hover:text-purple-700 font-mono leading-none">
                          {ratio}
                        </span>
                        {activeMode === "video" && (
                          <>
                            <span className="text-zinc-300 text-[10px]">|</span>
                            <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-purple-600 font-mono leading-none">
                              {duration}
                            </span>
                          </>
                        )}
                      </button>

                      {/* ── VOICE BUTTON ── */}
                      {activeMode === "video" && (
                        <button
                          ref={audioRef}
                          onClick={() => {
                            closeAllPopups();
                            setDrawerType("voice");
                          }}
                          className="group relative flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full border border-zinc-200 bg-white hover:border-pink-300 hover:bg-pink-50 transition-all duration-200 shadow-sm"
                        >
                          <span
                            className={`flex items-center justify-center w-5 h-5 rounded-full transition ${audioPrompt.trim() ? "bg-gradient-to-br from-pink-500 to-purple-500" : "bg-zinc-100 group-hover:bg-pink-100"}`}
                          >
                            <Mic
                              size={10}
                              className={
                                audioPrompt.trim()
                                  ? "text-white"
                                  : "text-zinc-500 group-hover:text-pink-600"
                              }
                            />
                          </span>
                          <span
                            className={`text-[11px] font-semibold leading-none transition ${audioPrompt.trim() ? "text-pink-600" : "text-zinc-600 group-hover:text-pink-600"}`}
                          >
                            Voice
                          </span>
                          {audioPrompt.trim() && (
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 ml-0.5" />
                          )}
                        </button>
                      )}

                      {/* ── BRAND BUTTON ── */}
                      {activeMode === "video" && (
                        <button
                          onClick={() => {
                            closeAllPopups();
                            setBrandStep("list");
                            setActiveBrand(null);
                            setDrawerType("brand");
                          }}
                          className="group relative flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full border border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition-all duration-200 shadow-sm"
                        >
                          {selectedBrand !== "Brand" ? (
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 shadow-sm">
                              {selectedBrand[0]}
                            </span>
                          ) : (
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 group-hover:bg-violet-100 transition">
                              <Briefcase
                                size={10}
                                className="text-zinc-500 group-hover:text-violet-600"
                              />
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold leading-none transition truncate max-w-[72px] ${selectedBrand !== "Brand" ? "text-violet-700" : "text-zinc-600 group-hover:text-violet-600"}`}
                          >
                            {selectedBrand}
                          </span>
                          <ChevronDown
                            size={10}
                            className="text-zinc-400 group-hover:text-violet-500 transition flex-shrink-0"
                          />
                        </button>
                      )}
                    </div>

                    {/* GENERATE BUTTON */}
                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || loading}
                      className={`flex-shrink-0 flex items-center gap-2 h-9 px-5 rounded-full text-xs md:text-sm font-semibold transition-all duration-200
                        ${
                          prompt.trim() && !loading
                            ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-purple-200 hover:shadow-lg hover:shadow-purple-300 hover:scale-[1.02]"
                            : "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                        }`}
                    >
                      {loading ? (
                        <>
                          <svg
                            className="w-3.5 h-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                            />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Recent Generations */}
        <div className="w-full max-w-6xl mx-auto mt-5">
          <RecentGenerations />
        </div>
      </div>
      {/* ================= UPLOAD SideDrawer ================= */}
      <SideDrawer
        open={drawerType === "upload"}
        onClose={() => setDrawerType(null)}
        title="Upload Assets"
        icon={<Upload size={14} className="text-white" />}
      >
        <div className="px-5 py-5 space-y-6">
          {/* ── REFERENCE IMAGES ── */}
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                  <Layers size={10} className="text-white" />
                </div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                  Reference Images
                </span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  referenceImages.length >= 3
                    ? "bg-pink-50 text-pink-600 border-pink-200"
                    : "bg-purple-50 text-purple-600 border-purple-100"
                }`}
              >
                {referenceImages.length} / 3
              </span>
            </div>

            {/* Drop zone */}
            <div
              onClick={() =>
                referenceImages.length < 3 && referenceInputRef.current.click()
              }
              className={`relative group rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden
                ${
                  referenceImages.length >= 3
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                    : uploadingRef
                      ? "border-purple-300 bg-purple-50"
                      : "border-gray-200 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/60"
                }`}
            >
              <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
                {uploadingRef ? (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                    </div>
                    <p className="text-sm font-semibold text-purple-600">
                      Uploading images…
                    </p>
                    <p className="text-xs text-purple-400">Please wait</p>
                  </>
                ) : referenceImages.length >= 3 ? (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                      <CheckCircle2 size={20} className="text-pink-500" />
                    </div>
                    <p className="text-sm font-semibold text-pink-600">
                      Maximum reached
                    </p>
                    <p className="text-xs text-gray-400">
                      Remove an image to add another
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 group-hover:border-purple-300 group-hover:bg-purple-50 flex items-center justify-center shadow-sm transition-all duration-200">
                      <Image
                        size={18}
                        className="text-gray-400 group-hover:text-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600 group-hover:text-purple-700 transition-colors">
                        Click to upload images
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        PNG, JPG, WEBP · Max 3 images
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files);
                handleReferenceUpload(files);
              }}
            />

            {/* Preview grid */}
            {referenceImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {referenceImages.map((file, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-purple-300 transition shadow-sm"
                  >
                    <img
                      src={
                        file?.url?.startsWith("http")
                          ? file.url
                          : `${import.meta.env.VITE_API_URL}${file?.url}`
                      }
                      alt="ref"
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                      <button
                        onClick={() =>
                          dispatch({
                            type: "REMOVE_REFERENCE_IMAGE",
                            payload: index,
                          })
                        }
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {/* REF badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-600/80 to-transparent pt-4 pb-1 px-1.5">
                      <span className="text-[9px] font-bold text-white">
                        REF {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Empty slots */}
                {Array.from({ length: 3 - referenceImages.length }).map(
                  (_, i) => (
                    <div
                      key={`empty-${i}`}
                      onClick={() => referenceInputRef.current.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 flex items-center justify-center cursor-pointer transition"
                    >
                      <ImagePlus size={16} className="text-gray-300" />
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* ── DIVIDER ── */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          {/* ── BRAND LOGO ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow-sm">
                <Sparkles size={10} className="text-white" />
              </div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                Brand Logo
              </span>
              {logoImage && (
                <span className="ml-auto text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={9} /> Uploaded
                </span>
              )}
            </div>

            {logoImage ? (
              /* Logo preview card */
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-200 hover:border-purple-300 transition shadow-sm">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                  <img
                    src={
                      logoImage?.url?.startsWith("http")
                        ? logoImage.url
                        : `${import.meta.env.VITE_API_URL}${logoImage?.url}`
                    }
                    alt="logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {logoImage?.name || "Brand Logo"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Logo uploaded successfully
                  </p>
                </div>
                <button
                  onClick={() => dispatch({ type: "REMOVE_LOGO_IMAGE" })}
                  className="w-7 h-7 rounded-xl flex items-center justify-center bg-red-50 border border-red-100 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              /* Logo drop zone */
              <div
                onClick={() => !uploadingLogo && logoInputRef.current.click()}
                className={`group relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                  ${
                    uploadingLogo
                      ? "border-pink-300 bg-pink-50"
                      : "border-gray-200 bg-gray-50 hover:border-pink-400 hover:bg-pink-50/60"
                  }`}
              >
                <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
                  {uploadingLogo ? (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin" />
                      </div>
                      <p className="text-sm font-semibold text-pink-600">
                        Uploading logo…
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 group-hover:border-pink-300 group-hover:bg-pink-50 flex items-center justify-center shadow-sm transition-all duration-200">
                        <Upload
                          size={18}
                          className="text-gray-400 group-hover:text-pink-500 transition-colors"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 group-hover:text-pink-700 transition-colors">
                          Upload brand logo
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          PNG, SVG, WEBP recommended
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                handleLogoUpload(file);
              }}
            />
          </div>

          {/* ── FOOTER ACTIONS ── */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                for (let i = referenceImages.length - 1; i >= 0; i--) {
                  dispatch({ type: "REMOVE_REFERENCE_IMAGE", payload: i });
                }
                dispatch({ type: "REMOVE_LOGO_IMAGE" });
              }}
              disabled={referenceImages.length === 0 && !logoImage}
              className="flex-1 h-10 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Clear All
            </button>
            <button
              onClick={() => setDrawerType(null)}
              className="flex-1 h-10 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:from-purple-500 hover:to-pink-400 shadow-md shadow-purple-200 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              Done
            </button>
          </div>
        </div>
      </SideDrawer>
      <SideDrawer
        open={drawerType === "settings"}
        onClose={() => setDrawerType(null)}
        title="Generation Settings"
      >
        {/*------------------- setting --------------*/}
        <div className="p-5 space-y-8">
          {/* ASPECT RATIO */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                Aspect Ratio
              </h4>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                {ratio}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: "16:9",
                  label: "Landscape",
                  desc: "YouTube · Desktop",
                  w: 48,
                  h: 27,
                },
                {
                  value: "9:16",
                  label: "Portrait",
                  desc: "Reels · TikTok",
                  w: 27,
                  h: 48,
                },
              ].map(({ value, label, desc, w, h }) => (
                <button
                  key={value}
                  onClick={() => setRatio(value)}
                  className={`
                    relative flex flex-col items-center justify-center gap-3
                    rounded-2xl border-2 py-5 px-3 transition-all duration-200
                    ${
                      ratio === value
                        ? "border-purple-500 bg-gradient-to-b from-purple-50 to-pink-50 shadow-md shadow-purple-100"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    }
                  `}
                >
                  {/* Preview shape */}
                  <div
                    className={`
                    rounded-md border-2 transition-all duration-200
                    ${ratio === value ? "border-purple-400 bg-gradient-to-br from-purple-400 to-pink-400" : "border-zinc-300 bg-zinc-200"}
                  `}
                    style={{ width: w * 0.9, height: h * 0.9 }}
                  />

                  <div className="text-center">
                    <p
                      className={`text-sm font-semibold ${ratio === value ? "text-purple-700" : "text-zinc-700"}`}
                    >
                      {label}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{desc}</p>
                    <p
                      className={`text-xs font-mono mt-1 ${ratio === value ? "text-purple-500" : "text-zinc-400"}`}
                    >
                      {value}
                    </p>
                  </div>

                  {ratio === value && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 10 8"
                      >
                        <path
                          d="M1 4l2.5 2.5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* VIDEO DURATION */}
          {activeMode === "video" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                  Duration
                </h4>
                <span className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  {duration}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "8s", label: "Short", desc: "Quick clip" },
                  { value: "15s", label: "Medium", desc: "Standard" },
                  { value: "30s", label: "Long", desc: "Full scene" },
                ].map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => setDuration(value)}
                    className={`
                      relative flex flex-col items-center gap-1.5
                      rounded-2xl border-2 py-4 px-2 transition-all duration-200
                      ${
                        duration === value
                          ? "border-purple-500 bg-gradient-to-b from-purple-50 to-pink-50 shadow-md shadow-purple-100"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                      }
                    `}
                  >
                    {/* Progress bar visual */}
                    <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${duration === value ? "bg-gradient-to-r from-pink-500 to-purple-500" : "bg-zinc-300"}`}
                        style={{
                          width:
                            value === "8s"
                              ? "33%"
                              : value === "15s"
                                ? "66%"
                                : "100%",
                        }}
                      />
                    </div>

                    <p
                      className={`text-lg font-bold font-mono leading-none ${duration === value ? "text-purple-600" : "text-zinc-700"}`}
                    >
                      {value}
                    </p>
                    <p
                      className={`text-[11px] font-medium ${duration === value ? "text-purple-500" : "text-zinc-500"}`}
                    >
                      {label}
                    </p>
                    <p className="text-[10px] text-zinc-400">{desc}</p>

                    {duration === value && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 10 8"
                        >
                          <path
                            d="M1 4l2.5 2.5L9 1"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SideDrawer>
      <SideDrawer
        open={drawerType === "voice"}
        onClose={() => setDrawerType(null)}
        title="Voice Narration"
      >
        <div className="p-5 space-y-7">
          {/* HEADER BANNER */}
          <div className="relative rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 p-4 overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-1 bottom-0 w-10 h-10 rounded-full bg-white/10" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Mic size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  AI Voice Narration
                </p>
                <p className="text-white/70 text-xs mt-0.5">
                  Text will be converted to speech
                </p>
              </div>
            </div>
          </div>

          {/* VOICE GENDER */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                Voice Type
              </h4>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full capitalize">
                {voiceGender}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "male", label: "Male", icon: User },
                { value: "female", label: "Female", icon: User },
                { value: "neutral", label: "Neutral", icon: Volume2 },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setVoiceGender(value)}
                  className={`
                    flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-200
                    ${
                      voiceGender === value
                        ? "border-purple-500 bg-gradient-to-b from-purple-50 to-pink-50 shadow-sm shadow-purple-100"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    }
                  `}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${voiceGender === value ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-zinc-100"}`}
                  >
                    <Icon
                      size={16}
                      className={
                        voiceGender === value ? "text-white" : "text-zinc-500"
                      }
                    />
                  </div>
                  <span
                    className={`text-xs font-medium ${voiceGender === value ? "text-purple-700" : "text-zinc-600"}`}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* VOICE TONE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                Tone
              </h4>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full capitalize">
                {voiceTone}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "calm",
                  label: "Calm",
                  desc: "Smooth & relaxed",
                  icon: Wind,
                },
                {
                  value: "energetic",
                  label: "Energetic",
                  desc: "Upbeat & dynamic",
                  icon: Zap,
                },
                {
                  value: "professional",
                  label: "Professional",
                  desc: "Clear & confident",
                  icon: Briefcase,
                },
                {
                  value: "dramatic",
                  label: "Dramatic",
                  desc: "Intense & powerful",
                  icon: Drama,
                },
              ].map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setVoiceTone(value)}
                  className={`
                    flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all duration-200
                    ${
                      voiceTone === value
                        ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm shadow-purple-100"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    }
                  `}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${voiceTone === value ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-zinc-100"}`}
                  >
                    <Icon
                      size={15}
                      className={
                        voiceTone === value ? "text-white" : "text-zinc-500"
                      }
                    />
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold ${voiceTone === value ? "text-purple-700" : "text-zinc-700"}`}
                    >
                      {label}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* NARRATION TEXT */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                Script
              </h4>
              <span className="text-[11px] text-zinc-400">
                {audioPrompt.length} / 500
              </span>
            </div>
            <textarea
              value={audioPrompt}
              onChange={(e) => setAudioPrompt(e.target.value.slice(0, 500))}
              placeholder="Write narration or dialogue that will be spoken in the video..."
              rows={4}
              className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 text-sm text-black outline-none resize-none placeholder:text-zinc-400 focus:border-purple-400 transition"
            />
          </div>

          {/* SUBTITLES TOGGLE */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${audioPrompt.trim() ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-50"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${hasSubtitle && audioPrompt.trim() ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-zinc-100"}`}>
                <Layers size={16} className={hasSubtitle && audioPrompt.trim() ? "text-white" : "text-zinc-500"} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">Subtitles</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {audioPrompt.trim() ? "Display captions on the video" : "Enter a voice script first"}
                </p>
              </div>
            </div>
            <button
              disabled={!audioPrompt.trim()}
              onClick={() => setHasSubtitle((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-all duration-200 ${hasSubtitle && audioPrompt.trim() ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-zinc-200"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${hasSubtitle && audioPrompt.trim() ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>

          {/* APPLY BUTTON */}
          <button
            onClick={() => setDrawerType(null)}
            className="w-full py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 transition shadow-md shadow-purple-200"
          >
            Apply Voice Settings
          </button>
        </div>
      </SideDrawer>

      {/* ================= BRAND SideDrawer ================= */}
      <SideDrawer
        open={drawerType === "brand"}
        onClose={() => {
          setDrawerType(null);
          setBrandStep("list");
          setActiveBrand(null);
        }}
        title={brandStep === "products" ? activeBrand?.name : "Select Brand"}
        icon={<Briefcase size={14} className="text-white" />}
      >
        <BrandDrawerContent
          brands={(rawBrands || []).map(mapBrandForPromptBar)}
          brandStep={brandStep}
          setBrandStep={setBrandStep}
          activeBrand={activeBrand}
          setActiveBrand={setActiveBrand}
          selectedBrand={selectedBrand}
          selectedContext={selectedContext}
          onApply={(brand, product) => {
            // Build prompt
            const subject = product ? `${brand.name} ${product.name}` : brand.name;
            setPrompt(`An ad about ${subject}`);
            setIsExpanded(true);

            // ── Always clear previous selections first ──
            dispatch({ type: "CLEAR_REFERENCE_IMAGES" });
            dispatch({ type: "REMOVE_LOGO_IMAGE" });

            // ── Product selected: set product image as reference + brand logo ──
            if (product) {
              if (product.image) {
                dispatch({
                  type: "SET_REFERENCE_IMAGES",
                  payload: [{ url: product.image, name: product.name }],
                });
              }
              if (brand.logo) {
                dispatch({
                  type: "SET_LOGO_IMAGE",
                  payload: { url: brand.logo, name: brand.name },
                });
              }
            }

            // ── Brand only (no product): just set brand logo ──
            if (!product && brand.logo) {
              dispatch({
                type: "SET_LOGO_IMAGE",
                payload: { url: brand.logo, name: brand.name },
              });
            }

            setSelectedBrand(product ? product.name : brand.name);
            setSelectedContext({ brand, product: product || null });
            setDrawerType(null);
            setBrandStep("list");
            setActiveBrand(null);
          }}
          onClear={() => {
            dispatch({ type: "CLEAR_REFERENCE_IMAGES" });
            dispatch({ type: "REMOVE_LOGO_IMAGE" });
            setSelectedBrand("Brand");
            setSelectedContext(null);
            setPrompt("");
          }}
          onClose={() => {
            setDrawerType(null);
            setBrandStep("list");
            setActiveBrand(null);
          }}
        />
      </SideDrawer>
    </>
  );
}

/* ─────────────────────────────────────────────
   BRAND DRAWER CONTENT
   Two-step: list → products (if brand has products)
───────────────────────────────────────────── */

const BRAND_GRADIENTS = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-purple-500",
  "from-emerald-500 to-teal-400",
  "from-orange-400 to-pink-500",
  "from-indigo-500 to-blue-500",
];

function BrandDrawerContent({
  brands,
  brandStep,
  setBrandStep,
  activeBrand,
  setActiveBrand,
  selectedBrand,
  selectedContext,
  onApply,
  onClear,
  onClose,
}) {
  /* ── STEP 1: Brand list ── */
  if (brandStep === "list") {
    return (
      <div className="px-5 py-5 space-y-4">
        {/* Header banner */}
        <div className="relative rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 p-4 overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute right-2 bottom-0 w-10 h-10 rounded-full bg-white/10" />
          <div className="relative z-10">
            <p className="text-white font-extrabold text-sm">Brand Identity</p>
            <p className="text-white/70 text-xs mt-0.5">
              Select a brand — then pick a product if available
            </p>
          </div>
        </div>

        {/* No brand / clear */}
        <button
          onClick={() => {
            onClear();
            onClose();
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200
            ${
              selectedBrand === "Brand"
                ? "border-purple-400 bg-purple-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
        >
          <div className="w-9 h-9 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
            <X size={13} className="text-gray-400" />
          </div>
          <div className="text-left flex-1">
            <p
              className={`text-sm font-semibold ${selectedBrand === "Brand" ? "text-purple-700" : "text-gray-700"}`}
            >
              No Brand
            </p>
            <p className="text-[11px] text-gray-400">
              Generate without brand context
            </p>
          </div>
          {selectedBrand === "Brand" && <CheckIcon />}
        </button>

        {/* Brand list */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-0.5">
            Your Brands
          </p>
          {brands.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No brands yet — create one in Brand Manager
            </p>
          )}
          {brands.map((brand) => {
            const gradient =
              BRAND_GRADIENTS[
                brand.name.charCodeAt(0) % BRAND_GRADIENTS.length
              ];
            const isSelected = selectedContext?.brand?.name === brand.name;
            const hasProducts = brand.products.length > 0;

            return (
              <button
                key={brand.id || brand.name}
                onClick={() => {
                  if (hasProducts) {
                    setActiveBrand(brand);
                    setBrandStep("products");
                  } else {
                    onApply(brand, null);
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left
                  ${
                    isSelected
                      ? "border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-sm shadow-purple-100"
                      : "border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/40"
                  }`}
              >
                {/* Avatar / logo */}
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden`}
                >
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="w-full h-full object-contain p-0.5"
                    />
                  ) : (
                    <span className="text-white font-extrabold text-sm">
                      {brand.name[0]}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-bold truncate ${isSelected ? "text-purple-700" : "text-gray-800"}`}
                    >
                      {brand.name}
                    </p>
                    {hasProducts && (
                      <span className="text-[9px] font-bold text-purple-500 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {brand.products.length} products
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">
                    {brand.industry}
                  </p>
                </div>

                {/* Arrow for brands with products, check for no-product brands */}
                {hasProducts ? (
                  <ChevronDown
                    size={14}
                    className="text-gray-300 -rotate-90 flex-shrink-0"
                  />
                ) : isSelected ? (
                  <CheckIcon />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── STEP 2: Product picker ── */
  if (brandStep === "products" && activeBrand) {
    const gradient =
      BRAND_GRADIENTS[activeBrand.name.charCodeAt(0) % BRAND_GRADIENTS.length];

    return (
      <div className="px-5 py-5 space-y-4">
        {/* Back + brand header */}
        <button
          onClick={() => {
            setBrandStep("list");
            setActiveBrand(null);
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-purple-600 transition-colors mb-1"
        >
          <ChevronDown size={13} className="rotate-90" /> Back to brands
        </button>

        {/* Brand info card */}
        <div
          className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-4 overflow-hidden`}
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {activeBrand.logo ? (
                <img
                  src={activeBrand.logo}
                  alt={activeBrand.name}
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <span className="text-white font-extrabold text-base">
                  {activeBrand.name[0]}
                </span>
              )}
            </div>
            <div>
              <p className="text-white font-extrabold text-sm">
                {activeBrand.name}
              </p>
              <p className="text-white/70 text-[11px]">
                {activeBrand.industry}
              </p>
            </div>
          </div>
          {activeBrand.slogan && (
            <p className="relative z-10 mt-2 text-white/80 text-xs italic">
              "{activeBrand.slogan}"
            </p>
          )}
        </div>

        {/* Instruction */}
        <p className="text-[11px] text-gray-400 font-medium px-0.5">
          Choose a product — its image and details will be used as reference
        </p>

        {/* Products */}
        <div className="space-y-2">
          {activeBrand.products.map((product, i) => {
            const isSelected =
              selectedContext?.brand?.name === activeBrand.name &&
              selectedContext?.product?.name === product.name;

            return (
              <button
                key={i}
                onClick={() => onApply(activeBrand, product)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left
                  ${
                    isSelected
                      ? "border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-sm shadow-purple-100"
                      : "border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/40"
                  }`}
              >
                {/* Product image */}
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      IMG
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold truncate ${isSelected ? "text-purple-700" : "text-gray-800"}`}
                  >
                    {product.name}
                  </p>
                  {product.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9px] font-semibold text-purple-400 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">
                      {product.image ? "📷 image ref" : "no image"}
                    </span>
                    {activeBrand.logo && (
                      <span className="text-[9px] font-semibold text-pink-400 bg-pink-50 border border-pink-100 px-1.5 py-0.5 rounded-full">
                        🏷 logo
                      </span>
                    )}
                  </div>
                </div>

                {isSelected ? (
                  <CheckIcon />
                ) : (
                  <ChevronDown
                    size={14}
                    className="text-gray-300 -rotate-90 flex-shrink-0"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

function CheckIcon() {
  return (
    <span className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-purple-200">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 10 8">
        <path
          d="M1 4l2.5 2.5L9 1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
