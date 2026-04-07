import React, { useState, useRef, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { uploadImage } from "../../redux/actions/imageVideoAction";
import {
  Link2, Sparkles, Loader2, X, Plus, Check,
  ChevronRight, ArrowLeft, Wand2, Play, Film,
  Globe, ImageIcon, User,
  ChevronDown,
  Search, SlidersHorizontal, RefreshCw,
} from "lucide-react";

/* ─── constants ─── */
const DURATIONS = ["15s", "30s", "60s"];
const RATIOS = [
  { id: "9:16",  label: "9:16",  hint: "TikTok / Reels", icon: "▯" },
  { id: "16:9",  label: "16:9",  hint: "YouTube / Web",  icon: "▭" },
  { id: "1:1",   label: "1:1",   hint: "Instagram Feed", icon: "□" },
];

const TONES = [
  { id: "Default tone",              label: "Default tone" },
  { id: "Engaging tone",             label: "Engaging tone" },
  { id: "Gen Z tone",                label: "Gen Z tone" },
  { id: "Motivational tone",         label: "Motivational tone" },
  { id: "Commercial Advertising tone", label: "Commercial Advertising tone" },
  { id: "Super Casual tone",         label: "Super Casual tone" },
  { id: "Professional tone",         label: "Professional tone" },
  { id: "Inspiring tone",            label: "Inspiring tone" },
  { id: "Just Summary tone",         label: "Just Summary tone" },
];


const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Japanese", "Chinese", "Arabic", "Hindi"];

const STEPS = [
  { id: "url",      label: "Product",  num: 1 },
  { id: "script",   label: "Script",   num: 2 },
  { id: "avatar",   label: "Avatar",   num: 3 },
  { id: "generate", label: "Generate", num: 4 },
];

/* ══════════════════════════════════════════════════════ */
export default function UGCVideo() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const userId    = useSelector((s) => s.auth?.user?.id);

  const [step, setStep]       = useState("url");

  /* ── Step 1: product ── */
  const [url, setUrl]                 = useState("");
  const [scraping, setScraping]       = useState(false);
  const [brandName, setBrandName]     = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl]         = useState("");
  const [useLogo, setUseLogo]         = useState(false);
  const [images, setImages]           = useState([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [language, setLanguage]       = useState("English");
  const [targetAudience, setTargetAudience] = useState("");
  const [ratio, setRatio]             = useState("9:16");
  const [duration, setDuration]       = useState("30s");
  const [hasSubtitle]                 = useState(false);
  const [promoEnabled, setPromoEnabled] = useState(false);
  const imgInputRef = useRef(null);

  /* ── Step 2: script ── */
  const [scriptTab, setScriptTab]           = useState("ai");   // "ai" | "custom"
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [scriptProgress, setScriptProgress] = useState(1);
  const [aiScripts, setAiScripts]           = useState([]);
  const [selectedScriptIdx, setSelectedScriptIdx] = useState(0);
  const [scriptTones, setScriptTones]       = useState({});     // idx → tone
  const [rewritingScript, setRewritingScript] = useState(null); // idx being rewritten
  const [customScript, setCustomScript]     = useState("");

  /* ── Step 3: avatar ── */
  const [avatarsLoading, setAvatarsLoading]           = useState(false);
  const [allAvatars, setAllAvatars]                   = useState([]);
  const [selectedAvatar, setSelectedAvatar]           = useState(null);
  const [avatarGenderFilter, setAvatarGenderFilter]   = useState("all");
  const [avatarSearchQuery, setAvatarSearchQuery]     = useState("");
  const [previewingAvatar, setPreviewingAvatar]       = useState(null);

  /* ── Step 4: generate ── */
  const [storyboardProgress, setStoryboardProgress]   = useState(1);

  /* ── helpers ── */
  const isValidUrl = useCallback((v) => {
    try { new URL(v.startsWith("http") ? v : `https://${v}`); return true; }
    catch { return false; }
  }, []);

  const selectedImgs = images.filter((i) => i.selected);
  const stepIdx      = STEPS.findIndex((s) => s.id === step);

  const activeScript = scriptTab === "custom"
    ? customScript
    : aiScripts[selectedScriptIdx]?.body || "";

  /* ── Scrape URL ── */
  const handleScrape = async () => {
    if (!url.trim() || !isValidUrl(url.trim())) { toast.error("Enter a valid URL"); return; }
    if (!userId) { toast.error("Please login first"); return; }
    setScraping(true);
    try {
      const normalizedUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
      const res = await api.post("/video/scrape-url", { userId, url: normalizedUrl });
      if (!res.data?.success) throw new Error(res.data?.message || "Scrape failed");
      const d = res.data.data;
      setBrandName(d.brandName || "");
      setDescription(d.products || "");
      setLogoUrl(d.logoUrl || "");
      setUseLogo(Boolean(d.logoUrl));
      setImages((d.imageUrls || []).map((u) => ({ url: u, selected: true })));
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Could not scrape URL");
    } finally {
      setScraping(false);
    }
  };

  /* ── Add image ── */
  const handleAddImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const uploadedUrl = await uploadImage(file);
      setImages((prev) => [...prev, { url: uploadedUrl, selected: true }]);
    } catch { toast.error("Image upload failed"); }
    finally { setUploadingImg(false); e.target.value = ""; }
  };

  /* ── Generate AI scripts (step 2 loading) ── */
  const goToScriptStep = async () => {
    if (!brandName.trim() && !description.trim()) { toast.error("Add product info first"); return; }
    setStep("script");
    setGeneratingScripts(true);
    setScriptProgress(1);

    // Animate progress bar
    const interval = setInterval(() => {
      setScriptProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 400);

    try {
      // Generate multiple scripts via OpenAI
      const res = await api.post("/video/generate-scripts", {
        userId,
        brandName,
        description,
        targetAudience,
        language,
        count: 4,
      });
      clearInterval(interval);
      setScriptProgress(100);
      await new Promise((r) => setTimeout(r, 400));

      const scripts = res.data?.scripts || generateFallbackScripts(brandName, description);
      setAiScripts(scripts);
      setScriptTones(Object.fromEntries(scripts.map((_, i) => [i, "Default tone"])));
      setSelectedScriptIdx(0);
    } catch {
      clearInterval(interval);
      // Fallback: use locally generated scripts
      const fallback = generateFallbackScripts(brandName, description);
      setAiScripts(fallback);
      setScriptTones(Object.fromEntries(fallback.map((_, i) => [i, "Default tone"])));
      setSelectedScriptIdx(0);
    } finally {
      setGeneratingScripts(false);
    }
  };

  /* ── Rewrite a single script with new tone ── */
  const rewriteScript = async (idx, newTone) => {
    setScriptTones((prev) => ({ ...prev, [idx]: newTone }));
    if (newTone === "Default tone") return; // nothing to rewrite
    setRewritingScript(idx);
    try {
      const res = await api.post("/video/generate-scripts", {
        userId, brandName, description, targetAudience, language,
        count: 1, tone: newTone, scriptTitle: aiScripts[idx]?.title,
      });
      const newScript = res.data?.scripts?.[0];
      if (newScript?.body) {
        setAiScripts((prev) => prev.map((s, i) => i === idx ? { ...s, body: newScript.body } : s));
      }
    } catch {
      toast.error("Could not rewrite script — keeping original");
    } finally {
      setRewritingScript(null);
    }
  };

  /* ── Generate more scripts ── */
  const generateMoreScripts = async () => {
    setGeneratingScripts(true);
    try {
      const res = await api.post("/video/generate-scripts", {
        userId, brandName, description, targetAudience, language, count: 4,
      });
      const more = res.data?.scripts || [];
      if (more.length === 0) { toast.error("Could not generate more scripts"); return; }
      setAiScripts((prev) => {
        const startIdx = prev.length;
        setScriptTones((t) => ({
          ...t,
          ...Object.fromEntries(more.map((_, i) => [startIdx + i, "Default tone"])),
        }));
        return [...prev, ...more];
      });
    } catch { toast.error("Could not generate more scripts"); }
    finally { setGeneratingScripts(false); }
  };

  /* ── Fetch avatars ── */
  const goToAvatarStep = () => {
    setStep("avatar");
    if (allAvatars.length === 0) fetchAvatars();
  };

  const fetchAvatars = async () => {
    setAvatarsLoading(true);
    try {
      const res = await api.get("/video/avatars");
      if (res.data?.success) setAllAvatars(res.data.data || []);
    } catch { toast.error("Could not load avatars"); }
    finally { setAvatarsLoading(false); }
  };

  /* ── Generate final video ── */
  const handleGenerate = async () => {
    if (!userId) { toast.error("Please login first"); return; }
    setStep("generate");
    setStoryboardProgress(1);

    const progressInterval = setInterval(() => {
      setStoryboardProgress((p) => Math.min(p + Math.random() * 10, 90));
    }, 600);

    try {
      const selectedImages = selectedImgs.map((i) => i.url);
      const script = activeScript;

      let res;
      if (selectedAvatar && selectedAvatar.avatar_id?.startsWith("veo_")) {
        const durationSec = parseInt(duration) || 8;
        res = await api.post("/video/generate-avatar-video", {
          userId,
          avatarId:        selectedAvatar.avatar_id,
          voiceId:         selectedAvatar.default_voice_id || undefined,
          voiceGender:     selectedAvatar.gender === "male" ? "male" : "female",
          script:          script.trim(),
          backgroundImageUrl: selectedImages[0] || undefined,
          aspectRatio:     ratio,
          caption:         hasSubtitle,
          brandName,
          description,
          duration:        durationSec,
          referenceImages: selectedImages.slice(0, 3),
        });
      } else {
        res = await api.post("/video/generate-ugc", {
          userId, brandName, description: script,
          logoUrl: useLogo ? logoUrl : "", useLogo,
          referenceImages: selectedImages.slice(0, 3),
          aspectRatio: ratio, videoDuration: duration,
          voiceGender: selectedAvatar?.gender === "male" ? "male" : "female",
          hasSubtitle, audioType: "voiceover",
          scenes: [{ script, voiceOver: "" }],
        });
      }

      clearInterval(progressInterval);
      setStoryboardProgress(100);
      await new Promise((r) => setTimeout(r, 500));

      const jobId    = res.data?.jobId;
      const videoUrl = res.data?.videoUrl;

      if (!jobId && !videoUrl) {
        throw new Error(res.data?.message || "Generation failed");
      }

      if (jobId) {
        // Async job — add to queue for polling
        dispatch({
          type: "ADD_GENERATION_QUEUE",
          payload: { id: Date.now(), jobId, type: "video", status: "processing" },
        });
        toast.success("Video generation started!");
      } else {
        // Synchronous completion (Veo avatar) — video is already ready
        toast.success("Video ready!");
      }
      setTimeout(() => navigate("/dashboard/gallery"), 1200);
    } catch (e) {
      clearInterval(progressInterval);
      toast.error(e.response?.data?.message || e.message || "Generation failed");
      setStep("avatar");
    }
  };

  /* ── Filtered avatars ── */
  const filteredAvatars = allAvatars.filter((a) => {
    const matchGender = avatarGenderFilter === "all" || a.gender?.toLowerCase() === avatarGenderFilter;
    const matchSearch = !avatarSearchQuery.trim() ||
      a.avatar_name?.toLowerCase().includes(avatarSearchQuery.toLowerCase()) ||
      a.tags?.some((t) => t.toLowerCase().includes(avatarSearchQuery.toLowerCase()));
    return matchGender && matchSearch;
  });

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col">

      {/* ── Top header ── */}
      <div className="sticky top-0 z-30 bg-[#0f0f0f] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
              <Globe size={14} className="text-white" />
            </div>
            <span className="font-black text-white text-sm tracking-tight">AI Video Ads</span>
            <span className="text-white/30 text-sm">Generate videos from your product links</span>
          </div>
        </div>

        {/* Step breadcrumb */}
        <div className="hidden md:flex items-center gap-1">
          {STEPS.map((s, i) => {
            const done   = i < stepIdx;
            const active = i === stepIdx;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => done && setStep(s.id)}
                  disabled={i > stepIdx}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                    ${active  ? "bg-violet-600 text-white"
                    : done    ? "bg-white/10 text-white/60 cursor-pointer hover:bg-white/20"
                    :           "bg-white/5 text-white/25 cursor-default"}`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black
                    ${active ? "bg-white/20" : done ? "bg-white/20" : "bg-white/10"}`}>
                    {done ? <Check size={8} /> : s.num}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight size={12} className="text-white/20" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-white/40">Feedback</span>
          <div className="flex items-center gap-1.5 bg-amber-500 text-black font-black text-xs px-3 py-1.5 rounded-full">
            ● 10 credits
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 max-w-3xl mx-auto w-full">

        {/* ══ STEP 1: PRODUCT ══ */}
        {step === "url" && (
          <div className="w-full space-y-6">
            <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 space-y-5">
              <h2 className="text-lg font-black text-white">Add media and product details</h2>

              {/* URL input */}
              <div className="flex items-center gap-3 bg-[#111] border border-white/10 rounded-xl px-4 py-3">
                <Link2 size={14} className="text-white/30 flex-shrink-0" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !scraping && handleScrape()}
                  placeholder="Paste product URL to auto-fill…"
                  className="flex-1 text-sm text-white placeholder-white/20 bg-transparent outline-none"
                />
                <button
                  onClick={handleScrape}
                  disabled={scraping || !url.trim() || !isValidUrl(url.trim())}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all
                    ${scraping || !url.trim() || !isValidUrl(url.trim())
                      ? "bg-white/10 text-white/30 cursor-not-allowed"
                      : "bg-violet-600 text-white hover:bg-violet-500"}`}
                >
                  {scraping ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {scraping ? "Fetching…" : "Fetch"}
                </button>
              </div>

              {/* Brand / Product name + Logo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Brand / Product name</label>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Logo</label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Product name…"
                    className="flex-1 text-sm text-white bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-violet-500 placeholder-white/20"
                  />
                  {logoUrl
                    ? <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-lg object-contain bg-white/5 border border-white/10 p-1" />
                    : <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <ImageIcon size={14} className="text-white/20" />
                      </div>
                  }
                </div>
              </div>

              {/* Product description */}
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Product description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Describe your product, key features and benefits…"
                  className="w-full text-sm text-white bg-[#111] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-violet-500 resize-none placeholder-white/20 leading-relaxed"
                />
                <div className="text-right text-[11px] text-white/20 mt-1">{description.length}/5000</div>
              </div>

              {/* Assets */}
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 block">Assets</label>

                {images.length < 3 && (
                  <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-700/40 rounded-xl px-4 py-3 mb-3">
                    <span className="text-amber-400 text-sm mt-0.5">⚠</span>
                    <p className="text-xs text-amber-200/80 flex-1">
                      To get started, please upload a minimum of 3 images or 1 video. This helps us ensure the best quality for your final video.
                    </p>
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      className="flex-shrink-0 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      Generate with AI
                    </button>
                  </div>
                )}

                {images.length > 0 && (
                  <p className="text-[11px] text-amber-400 mb-2">
                    ★ Confirm the assets you want to use. Higher-quality clips and images result in better results.
                  </p>
                )}

                <div className="bg-[#111] border border-white/10 rounded-xl p-3">
                  <div className="flex flex-wrap gap-2">
                    {/* Add assets button */}
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      disabled={uploadingImg}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1.5 text-white/30 hover:border-violet-500 hover:text-violet-400 transition"
                    >
                      {uploadingImg ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                      <span className="text-[10px] font-bold">Add assets</span>
                    </button>
                    <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleAddImage} />

                    {/* Image thumbnails */}
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <button
                          onClick={() => setImages((prev) => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m))}
                          className={`w-24 h-24 rounded-xl overflow-hidden border-2 transition-all
                            ${img.selected ? "border-violet-500" : "border-white/10 opacity-40 grayscale"}`}
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                        {img.selected && (
                          <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded bg-violet-500 flex items-center justify-center">
                            <Check size={9} className="text-white" />
                          </div>
                        )}
                        {/* Info icon */}
                        <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="text-[8px] text-white font-bold">i</span>
                        </div>
                        <button
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center shadow"
                        >
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {images.length > 0 && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => setImages((p) => p.map((i) => ({ ...i, selected: true })))}
                        className="text-xs text-white/50 hover:text-white transition">Select all</button>
                      <button onClick={() => setImages((p) => p.map((i) => ({ ...i, selected: false })))}
                        className="text-xs text-white/50 hover:text-white transition">Unselect all</button>
                      <button onClick={() => setImages((p) => p.filter((i) => !i.selected))}
                        className="text-xs text-white/50 hover:text-red-400 transition">Delete select</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Video settings */}
              <div className="border-t border-white/10 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-white">Video settings</h3>

                {/* Aspect ratio */}
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Aspect ratio</label>
                  <div className="flex gap-2">
                    {RATIOS.map((r) => (
                      <button key={r.id} onClick={() => setRatio(r.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all
                          ${ratio === r.id ? "border-violet-500 bg-violet-600/20 text-white" : "border-white/10 bg-white/5 text-white/40 hover:border-white/30"}`}>
                        <span className="text-base leading-none">{r.icon}</span> {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Duration</label>
                  <div className="flex gap-2">
                    {DURATIONS.map((d) => (
                      <button key={d} onClick={() => setDuration(d)}
                        className={`px-5 py-2 rounded-xl text-xs font-bold border transition-all
                          ${duration === d ? "border-violet-500 bg-violet-600/20 text-white" : "border-white/10 bg-white/5 text-white/40 hover:border-white/30"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Language</label>
                  <div className="relative">
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}
                      className="w-full appearance-none bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500 cursor-pointer pr-8">
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {/* Target audience */}
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Target audience</label>
                  <textarea
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    rows={2}
                    placeholder="e.g. Natural skincare users, health-conscious adults…"
                    className="w-full text-sm text-white bg-[#111] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-violet-500 resize-none placeholder-white/20"
                  />
                  {/* Audience chips */}
                  {description && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {generateAudienceChips(description).map((chip, i) => (
                        <button key={i} onClick={() => setTargetAudience(chip)}
                          className="text-[11px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 px-2.5 py-1 rounded-full transition">
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Promotional info toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white/60">Promotional info</label>
                  <button onClick={() => setPromoEnabled((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-all duration-200 ${promoEnabled ? "bg-violet-600" : "bg-white/10"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${promoEnabled ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={goToScriptStep}
              disabled={!brandName.trim() && !description.trim()}
              className={`w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 transition-all duration-200
                ${!brandName.trim() && !description.trim()
                  ? "bg-white/10 text-white/30 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-lg hover:opacity-90 active:scale-[0.98]"}`}
            >
              <Sparkles size={16} /> Continue to Script
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ══ STEP 2: SCRIPT ══ */}
        {step === "script" && (
          <div className="w-full space-y-4">

            {/* Loading screen */}
            {generatingScripts ? (
              <GeneratingScreen
                label="AI generating scripts…"
                progress={scriptProgress}
                subtitle="This step may take up to 45 seconds"
              />
            ) : (
              <>
                <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 overflow-hidden">
                  <h2 className="text-lg font-black text-white px-6 pt-5 pb-4">Choose or create your script</h2>

                  {/* Tab */}
                  <div className="flex border-b border-white/10">
                    <button onClick={() => setScriptTab("ai")}
                      className={`flex-1 py-3 text-sm font-bold transition-all
                        ${scriptTab === "ai" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                      Choose script from AI
                    </button>
                    <button onClick={() => setScriptTab("custom")}
                      className={`flex-1 py-3 text-sm font-bold transition-all
                        ${scriptTab === "custom" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                      Use your own script
                    </button>
                  </div>

                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

                    {scriptTab === "ai" ? (
                      <>
                        {aiScripts.map((script, idx) => (
                          <ScriptCard
                            key={idx}
                            script={script}
                            isSelected={selectedScriptIdx === idx}
                            tone={scriptTones[idx] || "Default tone"}
                            isRewriting={rewritingScript === idx}
                            onSelect={() => setSelectedScriptIdx(idx)}
                            onToneChange={(tone) => rewriteScript(idx, tone)}
                          />
                        ))}

                        <button
                          onClick={generateMoreScripts}
                          disabled={generatingScripts}
                          className="w-full py-3 rounded-xl border border-white/10 text-sm font-bold text-white/40 hover:text-white hover:border-white/20 transition flex items-center justify-center gap-2"
                        >
                          {generatingScripts
                            ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                            : <><RefreshCw size={14} /> Generate more scripts</>}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <textarea
                          value={customScript}
                          onChange={(e) => setCustomScript(e.target.value)}
                          rows={10}
                          maxLength={1000}
                          placeholder="Enter your script here …"
                          className="w-full text-sm text-white bg-[#111] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-violet-500 resize-none placeholder-white/20 leading-relaxed"
                        />
                        <div className="flex gap-3">
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white transition">
                            ⏱ Add pause
                          </button>
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white transition">
                            🔤 Edit pronunciation
                          </button>
                          <span className="ml-auto text-xs text-white/30">{customScript.length}/1000</span>
                        </div>
                        <div className="bg-[#111] rounded-xl p-3 space-y-1">
                          <p className="text-xs text-white/30 font-bold">ⓘ Instructions for Input:</p>
                          {[
                            "Please ensure compliance with regulations.",
                            "Please enter plain text and ensure sentences flow naturally.",
                            "Avoid formatting expressions (e.g.,Genre:Lighthearted).",
                            "Avoid any inappropriate content, such as explicit or violent material.",
                            "Avoid using special characters such as ##, [], —, **",
                          ].map((t, i) => (
                            <p key={i} className="text-xs text-white/25">{t}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep("url")}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white/50 hover:text-white transition">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={goToAvatarStep}
                    disabled={!activeScript.trim()}
                    className={`flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all duration-200
                      ${!activeScript.trim()
                        ? "bg-white/10 text-white/30 cursor-not-allowed"
                        : "bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:opacity-90 active:scale-[0.98]"}`}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ STEP 3: AVATAR ══ */}
        {step === "avatar" && (
          <div className="w-full flex flex-col lg:flex-row gap-4">

            {/* Avatar grid */}
            <div className="flex-1 bg-[#1a1a1a] rounded-2xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-black text-white">Select avatars</h2>
              </div>
              <p className="px-5 pt-3 text-xs text-white/40">Pick an avatar, or let AI choose for you.</p>

              {/* Toolbar */}
              <div className="flex items-center gap-2 px-5 py-3">
                {/* Sidebar filter icon */}
                <button className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition">
                  <SlidersHorizontal size={13} />
                </button>
                {/* Search */}
                <div className="flex-1 relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    type="text"
                    value={avatarSearchQuery}
                    onChange={(e) => setAvatarSearchQuery(e.target.value)}
                    placeholder="e.g. chase + living roo…"
                    className="w-full text-xs text-white bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 outline-none focus:border-violet-500 placeholder-white/20"
                  />
                </div>
                {/* Gender filter */}
                <div className="flex gap-1">
                  {["all", "female", "male"].map((g) => (
                    <button key={g} onClick={() => setAvatarGenderFilter(g)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all
                        ${avatarGenderFilter === g ? "bg-violet-600 text-white" : "bg-white/5 text-white/30 hover:text-white"}`}>
                      {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter sidebar icons */}
              <div className="flex gap-2 px-5 pb-3">
                <button className="flex flex-col gap-1 items-center">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
                    <User size={13} className="text-violet-400" />
                  </div>
                </button>
                <button className="flex flex-col gap-1 items-center">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <User size={13} className="text-white/30" />
                  </div>
                </button>
                <button className="flex flex-col gap-1 items-center">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Film size={13} className="text-white/30" />
                  </div>
                </button>
              </div>

              {/* Avatar grid */}
              <div className="px-5 pb-5 max-h-[55vh] overflow-y-auto">
                {avatarsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin text-violet-400" />
                  </div>
                ) : filteredAvatars.length === 0 ? (
                  <div className="text-center py-12 text-white/30 text-sm">No avatars found</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {filteredAvatars.map((avatar) => {
                      const isSelected = selectedAvatar?.avatar_id === avatar.avatar_id;
                      return (
                        <div key={avatar.avatar_id} className="relative group">
                          <button
                            onClick={() => setSelectedAvatar(isSelected ? null : avatar)}
                            className={`w-full rounded-xl overflow-hidden border-2 transition-all duration-150 flex flex-col
                              ${isSelected ? "border-violet-500 shadow-lg shadow-violet-500/20" : "border-white/10 hover:border-white/30"}`}
                          >
                            {/* Avatar image */}
                            <div className="relative aspect-[3/4] bg-[#111] overflow-hidden">
                              {avatar.preview_image_url
                                ? <img src={avatar.preview_image_url} alt={avatar.avatar_name}
                                    className="w-full h-full object-cover object-top" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/50 to-pink-900/50">
                                    <User size={28} className="text-white/20" />
                                  </div>
                              }

                              {/* Play preview on hover */}
                              {avatar.preview_video_url && (
                                <div
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); setPreviewingAvatar(avatar); }}
                                >
                                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                                    <Play size={14} className="text-violet-600 fill-violet-600 ml-0.5" />
                                  </div>
                                </div>
                              )}

                              {/* Veo badge */}
                              {avatar.avatar_id?.startsWith("veo_") && (
                                <div className="absolute top-1.5 left-1.5 bg-violet-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                  AI
                                </div>
                              )}

                              {/* Selected check */}
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                  <Check size={10} className="text-white" />
                                </div>
                              )}
                            </div>

                            {/* Name */}
                            <div className={`px-2 py-2 ${isSelected ? "bg-violet-600/20" : "bg-[#111]"}`}>
                              <p className="text-[11px] font-bold text-white truncate">{avatar.avatar_name}</p>
                              {avatar.label && <p className="text-[9px] text-white/30">{avatar.label}</p>}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar — selected count + AI match */}
            <div className="w-full lg:w-48 flex-shrink-0 flex flex-col gap-3">
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-4 text-center">
                <p className="text-2xl font-black text-white">{selectedAvatar ? "1" : "0"}/2</p>
                <p className="text-xs text-white/40 mt-0.5">avatars selected</p>
              </div>

              {/* AI Smart match */}
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-4 flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                  <span className="text-lg font-black text-violet-400">AI</span>
                </div>
                <p className="text-[11px] font-bold text-white/60 text-center">Smart match</p>
              </div>

              {selectedAvatar && (
                <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl p-3 space-y-2">
                  <p className="text-xs font-black text-violet-300">Selected</p>
                  {selectedAvatar.preview_image_url
                    ? <img src={selectedAvatar.preview_image_url} alt="" className="w-full aspect-[3/4] object-cover object-top rounded-lg" />
                    : <div className="w-full aspect-[3/4] bg-violet-900/30 rounded-lg flex items-center justify-center"><User size={24} className="text-violet-400" /></div>
                  }
                  <p className="text-xs font-bold text-white text-center">{selectedAvatar.avatar_name}</p>
                  <button onClick={() => setSelectedAvatar(null)} className="w-full text-[10px] text-red-400 hover:text-red-300 transition">Remove</button>
                </div>
              )}
            </div>

            {/* Avatar preview modal */}
            {previewingAvatar && (
              <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                onClick={() => setPreviewingAvatar(null)}>
                <div className="relative bg-[#111] rounded-2xl overflow-hidden max-w-xs w-full"
                  onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setPreviewingAvatar(null)}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
                    <X size={14} />
                  </button>
                  <video src={previewingAvatar.preview_video_url} autoPlay loop muted playsInline className="w-full" />
                  <div className="p-4">
                    <p className="text-white font-black text-sm">{previewingAvatar.avatar_name}</p>
                    <p className="text-white/40 text-xs capitalize">{previewingAvatar.gender}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom nav */}
            <div className="w-full lg:hidden flex gap-3 mt-2">
              <button onClick={() => setStep("script")}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white/50 hover:text-white transition">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleGenerate}
                className="flex-1 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:opacity-90 transition flex items-center justify-center gap-2">
                <Sparkles size={14} /> Render <ChevronRight size={14} />
              </button>
            </div>

            {/* Desktop bottom nav */}
            <div className="hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-20">
              <button onClick={() => setStep("script")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-sm font-bold text-white/50 hover:text-white transition">
                <ArrowLeft size={13} /> Back
              </button>
              <button onClick={handleGenerate}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:opacity-90 transition">
                <Sparkles size={14} />
                Render (1 video)
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 4: GENERATING ══ */}
        {step === "generate" && (
          <div className="w-full">
            <GeneratingScreen
              label="AI generating storyboard…"
              progress={storyboardProgress}
              subtitle="This step may take about 1-2 minutes."
            />
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Script Card component ── */
function ScriptCard({ script, isSelected, tone, isRewriting, onSelect, onToneChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-150
        ${isSelected ? "border-violet-500 bg-violet-600/10" : "border-white/10 bg-[#111] hover:border-white/20"}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {isSelected
          ? <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
              <Check size={11} className="text-white" />
            </div>
          : <div className="w-5 h-5 rounded-full border-2 border-white/20 flex-shrink-0" />
        }
        <span className={`text-sm font-black flex-1 ${isSelected ? "text-white" : "text-white/70"}`}>
          {script.title}
        </span>

        {/* Tone selector */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg transition"
          >
            {tone} <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-10 min-w-[200px] overflow-hidden">
              {TONES.map((t) => (
                <button key={t.id} onClick={() => { onToneChange(t.id); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-all hover:bg-white/5
                    ${tone === t.id ? "text-violet-400 bg-violet-600/10" : "text-white/50"}`}>
                  {tone === t.id && <Check size={10} className="inline mr-2" />} {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Script body */}
      <div className="px-4 pb-4">
        {isRewriting ? (
          <div className="flex items-center gap-2 py-4 text-xs text-white/40">
            <Loader2 size={13} className="animate-spin" /> Script generating …
          </div>
        ) : (
          <p className="text-sm text-white/60 leading-relaxed">{script.body}</p>
        )}
      </div>
    </div>
  );
}

/* ── Generating loading screen ── */
function GeneratingScreen({ label, progress, subtitle }) {
  const SLIDES = [
    {
      title: "Turn product pages into videos",
      desc: "Create video ads from a landing page or product link in minutes.",
    },
    {
      title: "AI-powered voiceover & avatars",
      desc: "Let AI narrate your product with realistic voices and digital humans.",
    },
    {
      title: "Multiple styles, one click",
      desc: "Get cinematic, UGC, testimonial and presenter styles automatically.",
    },
    {
      title: "Optimized for every platform",
      desc: "9:16 for TikTok, 16:9 for YouTube, 1:1 for Instagram — all at once.",
    },
  ];

  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8 text-center">
      {/* Icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <div className="relative">
            <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-t-transparent border-b-transparent border-l-violet-400 ml-1" />
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex gap-0.5">
              <div className="w-1.5 h-4 bg-violet-400 rounded-sm" />
              <div className="w-1.5 h-4 bg-violet-400 rounded-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Label + progress */}
      <div className="space-y-1">
        <p className="text-lg font-black text-white">{label} ({Math.round(progress)}%)</p>
        <p className="text-sm text-white/40">{subtitle}</p>
        <p className="text-sm text-white/30">While you wait, explore more ways to create with Klipsify.</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Slide card */}
      <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
        <div className="aspect-video bg-gradient-to-br from-violet-900/50 via-pink-900/30 to-[#111] flex items-center justify-center">
          <div className="flex gap-2 items-end">
            {[80, 120, 90].map((h, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden border-2 border-white/10 shadow-xl"
                style={{ width: 64, height: h }}>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-800/40 to-pink-800/40" />
                <div className="absolute inset-x-2 bottom-2">
                  <div className="h-1 bg-white/30 rounded-full mb-1" />
                  <div className="h-1 bg-white/20 rounded-full w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-black text-white">{SLIDES[slide].title}</p>
          <p className="text-xs text-white/40 mt-0.5">{SLIDES[slide].desc}</p>
        </div>
        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-3">
          {SLIDES.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === slide ? "w-4 bg-violet-400" : "w-1 bg-white/20"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function generateFallbackScripts(brandName, description) {
  const brand = brandName || "this product";
  const desc  = (description || "").substring(0, 100);
  return [
    {
      title: "Skin Nourishment",
      body: `Your skin deserves the best — ${brand} is here to deliver. ${desc}. Try it today and feel the difference from day one.`,
    },
    {
      title: "Expert Validation",
      body: `Experts recommend ${brand} for a reason. ${desc}. Make the switch today and see what you've been missing.`,
    },
    {
      title: "Before & After",
      body: `Before ${brand}: frustration. After ${brand}: confidence. ${desc}. Join thousands who made the switch.`,
    },
    {
      title: "User Experience",
      body: `Real people, real results — ${brand} is changing lives. ${desc}. Order now and start your transformation.`,
    },
  ];
}

function generateAudienceChips(description) {
  const words = description.toLowerCase();
  const chips = [];
  if (words.includes("skin") || words.includes("moistur")) chips.push("Natural skincare users");
  if (words.includes("lavender") || words.includes("scent") || words.includes("fragrance")) chips.push("Lavender scent lovers");
  if (words.includes("soap") || words.includes("cleanser")) chips.push("Moisturizing soap seekers");
  if (words.includes("allerg") || words.includes("sensitive")) chips.push("Sensitive skin individuals");
  if (words.includes("eco") || words.includes("natural") || words.includes("organic")) chips.push("Eco-conscious consumers");
  if (chips.length < 3) chips.push("Fragrance product enthusiasts");
  return chips.slice(0, 6);
}
