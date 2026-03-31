import React, { useMemo, useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Play, Download, Maximize2, Clock, Image, Video, ArrowRight } from "lucide-react";
import { fetchGallery, pullJobs } from "../redux/actions/imageVideoAction";
import { useNavigate } from "react-router-dom";
import MediaPreview from "../pages/dashboard/MediaPreview";

export default function RecentGenerations() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [previewItem, setPreviewItem] = useState(null);

  const gallery = useSelector((state) => state.generation?.gallery || []);
  const queue   = useSelector((state) => state.generation?.queue   || []);
  const userId  = useSelector((state) => state.auth?.user?.id);
  const role    = useSelector((state) => state.auth?.user?.role);

  useEffect(() => {
    if (!userId || !role) return;
    dispatch(fetchGallery(role, userId));
    dispatch(pullJobs(userId));
  }, [dispatch, userId, role]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => dispatch(pullJobs(userId)), 5000);
    return () => clearInterval(interval);
  }, [dispatch, userId]);

  const items = useMemo(() => {
    const processing = queue.map((q) => ({
      ...q,
      status: "processing",
      createdAt: q.createdAt || new Date().toISOString(),
    }));
    const galleryItems = gallery.map((g) => ({ ...g, status: "done", createdAt: g.createdAt }));
    const merged = [...processing, ...galleryItems];
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return merged.slice(0, 4);
  }, [queue, gallery]);

  if (items.length === 0) return null;

  return (
    <>
    <div className="px-4 md:px-0 pb-10">

      {/* ── SECTION HEADER ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
            <Clock size={15} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-800">Recent Generations</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/dashboard/gallery")}
          className="group flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 transition"
        >
          View all
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {items.map((item, index) => (
          <RecentCard
            key={item._id || index}
            item={item}
            onPreview={setPreviewItem}
          />
        ))}
      </div>

    </div>

    {previewItem && (
      <MediaPreview
        item={previewItem}
        items={items.filter((i) => i.status === "done")}
        onClose={() => setPreviewItem(null)}
        dispatch={dispatch}
        handleDownload={(url) => url && window.open(url, "_blank")}
      />
    )}
    </>
  );
}

/* ── Single card — isolated so each can track its own visibility ── */
function RecentCard({ item, onPreview }) {
  const isProcessing = item.status === "processing";
  const mediaUrl     = item.url || item.imageUrl;
  const isVideo      = item.type === "video";

  const cardRef  = useRef(null);
  const [inView, setInView]   = useState(false);
  const [loaded, setLoaded]   = useState(false);

  // Observe when card enters viewport — only then set src / show media
  useEffect(() => {
    if (isProcessing) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isProcessing]);

  return (
    <div
      ref={cardRef}
      onClick={() => !isProcessing && onPreview(item)}
      className="group relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-lg hover:shadow-purple-500/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
    >

      {isProcessing ? (
        /* ── PROCESSING STATE ── */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-900 to-zinc-800">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              {isVideo
                ? <Video size={12} className="text-purple-400" />
                : <Image size={12} className="text-purple-400" />
              }
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-white">Generating…</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{isVideo ? "Video" : "Image"}</p>
          </div>
          {/* shimmer bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-purple-500 to-pink-500 animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </div>

      ) : !inView ? (
        /* ── PLACEHOLDER before entering viewport ── */
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />

      ) : (
        <>
          {/* ── MEDIA ── */}
          {/* Skeleton until loaded */}
          {!loaded && (
            <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
          )}

          {isVideo ? (
            item.thumbnail ? (
              /* Use thumbnail image — no video element in the card, plays in preview */
              <img
                src={item.thumbnail}
                alt="video thumbnail"
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
              />
            ) : (
              /* No thumbnail — load video metadata only (first frame) */
              <video
                src={mediaUrl}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                muted
                preload="metadata"
                playsInline
                onLoadedMetadata={() => setLoaded(true)}
              />
            )
          ) : (
            <img
              src={mediaUrl}
              alt="media"
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {/* ── GRADIENT OVERLAY ── */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* ── TYPE BADGE ── */}
          <div className="absolute top-2.5 left-2.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm border
              ${isVideo
                ? "bg-violet-900/60 border-violet-500/40 text-violet-300"
                : "bg-pink-900/60 border-pink-500/40 text-pink-300"
              }`}>
              {isVideo ? <Video size={9} /> : <Image size={9} />}
              {isVideo ? "Video" : "Image"}
            </span>
          </div>

          {/* ── PLAY BUTTON (video) ── */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition cursor-pointer">
                <Play size={18} className="text-white ml-0.5" />
              </div>
            </div>
          )}

          {/* ── BOTTOM INFO ── */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <p className="text-[11px] font-medium text-white/90 truncate leading-snug mb-2">
              {item.prompt || "Generated media"}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); window.open(item.downloadUrl || mediaUrl, "_blank"); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 transition text-white text-[10px] font-medium"
              >
                <Download size={10} /> Save
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); window.open(mediaUrl, "_blank"); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 transition text-white text-[10px] font-medium"
              >
                <Maximize2 size={10} /> View
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
