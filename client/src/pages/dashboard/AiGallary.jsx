import  { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchGallery, deleteMedia, pullJobs } from "../../redux/actions/imageVideoAction";
import MediaCard from "../../components/MediaCard";
import MediaPreview from "./MediaPreview";
import { Images, Video, FolderOpen, LayoutGrid, List, Download, Share2, Trash2, Play, ImageIcon, Loader2 } from "lucide-react";

const PAGE_SIZE = 5;

export default function AIGallery() {
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState(
    () => window.localStorage.getItem("lastActiveTab") || "images"
  );
  const [viewMode, setViewMode] = useState(
    () => window.localStorage.getItem("galleryViewMode") || "grid"
  );
  const [previewItem, setPreviewItem] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  useEffect(() => { window.localStorage.setItem("lastActiveTab",   activeTab); }, [activeTab]);
  useEffect(() => { window.localStorage.setItem("galleryViewMode", viewMode);  }, [viewMode]);

  // Reset pagination when tab or view changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeTab, viewMode]);

  const gallery     = useSelector((state) => state.generation?.gallery || []);
  const queue       = useSelector((state) => state.generation?.queue   || []);
  const loading     = useSelector((state) => state.generation?.loading);
  const currentRole = useSelector((state) => state.auth?.user?.role);
  const userId      = useSelector((state) => state.auth?.user?.id);

  useEffect(() => {
    if (!currentRole || !userId) return;
    dispatch(fetchGallery(currentRole, userId));
  }, [dispatch, currentRole, userId]);

  const allMedia = useMemo(() => {
    const queueItems   = queue.map((i) => ({ ...i, status: "processing" }));
    const galleryItems = gallery.map((i) => ({ ...i, status: "done" }));
    return [...queueItems, ...galleryItems];
  }, [queue, gallery]);

  const filteredGallery = useMemo(() =>
    activeTab === "images"
      ? allMedia.filter((i) => i.type === "image")
      : allMedia.filter((i) => i.type === "video"),
    [activeTab, allMedia]
  );

  const visibleItems = useMemo(
    () => filteredGallery.slice(0, visibleCount),
    [filteredGallery, visibleCount]
  );

  const hasMore = visibleCount < filteredGallery.length;

  // Infinite scroll — load next page when sentinel enters view
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]); // re-attach after each batch loads

  const imageCount = useMemo(() => allMedia.filter((i) => i.type === "image").length, [allMedia]);
  const videoCount = useMemo(() => allMedia.filter((i) => i.type === "video").length, [allMedia]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => dispatch(pullJobs(userId)), 5000);
    return () => clearInterval(interval);
  }, [userId, dispatch]);

  useEffect(() => {
    if (queue.some((item) => item.type === "video")) setActiveTab("videos");
  }, [queue]);

  const openPreview    = useCallback((media) => setPreviewItem(media), []);
  const handleDownload = useCallback((url) => url && window.open(url, "_blank"), []);
  const handleShare    = useCallback((url) => url && navigator.clipboard.writeText(url), []);

  const tabs = [
    { id: "images", label: "Images", icon: Images, count: imageCount },
    { id: "videos", label: "Videos", icon: Video,  count: videoCount },
  ];

  return (
    <div className="min-h-full text-gray-800">

      {/* ── HEADER ── */}
      <div className="px-4 md:px-6 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shadow-purple-200">
                <Images size={15} className="text-white" />
              </div>
              <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">
                Media Library
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              My Gallery
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {allMedia.length === 0
                ? "No generations yet"
                : `${allMedia.length} item${allMedia.length !== 1 ? "s" : ""} generated`}
            </p>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200">
              <Images size={13} className="text-purple-500" />
              <span className="text-xs font-bold text-purple-600">{imageCount} Images</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200">
              <Video size={13} className="text-pink-500" />
              <span className="text-xs font-bold text-pink-600">{videoCount} Videos</span>
            </div>
          </div>
        </div>

        {/* ── TABS + VIEW TOGGLE ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm w-full sm:w-fit">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                  activeTab === id
                    ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-200"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} className="flex-shrink-0" />
                <span className="truncate">{label}</span>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === id ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                viewMode === "grid"
                  ? "bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent mx-4 md:mx-6" />

      {/* ── CONTENT ── */}
      <div className="px-4 md:px-6 py-6">
        {loading && allMedia.length === 0 ? (
          viewMode === "grid" ? <SkeletonGrid /> : <SkeletonList />
        ) : filteredGallery.length === 0 ? (
          <EmptyState type={activeTab} />
        ) : viewMode === "grid" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {visibleItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  openPreview={openPreview}
                  handleDownload={handleDownload}
                  handleShare={handleShare}
                  dispatch={dispatch}
                />
              ))}
            </div>
            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center items-center gap-2 py-8 text-gray-400 text-sm">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                <span>Loading more…</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {visibleItems.map((item, idx) => (
                <ListRow
                  key={item.id}
                  item={item}
                  index={idx}
                  openPreview={openPreview}
                  handleDownload={handleDownload}
                  handleShare={handleShare}
                  dispatch={dispatch}
                />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center items-center gap-2 py-8 text-gray-400 text-sm">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                <span>Loading more…</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── PREVIEW MODAL ── */}
      {previewItem && (
        <MediaPreview
          item={previewItem}
          items={filteredGallery}
          onClose={() => setPreviewItem(null)}
          dispatch={dispatch}
          handleDownload={handleDownload}
        />
      )}
    </div>
  );
}

/* ─────────────────── LIST ROW ─────────────────── */
function ListRow({ item, index, openPreview, handleDownload, handleShare, dispatch }) {
  const mediaUrl     = item.url || item.imageUrl;
  const isVideo      = item.type === "video";
  const isProcessing = item.status === "processing";
  const [imgLoaded, setImgLoaded] = useState(false);

  const createdAt = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : `Item ${index + 1}`;

  const promptText = item.prompt
    ? item.prompt.slice(0, 80) + (item.prompt.length > 80 ? "…" : "")
    : `Generated ${isVideo ? "video" : "image"}`;

  return (
    <div className={`group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-3.5 bg-white border rounded-2xl
      transition-all duration-200 overflow-hidden
      ${isProcessing
        ? "border-purple-100 shadow-sm"
        : "border-gray-200 hover:border-purple-200 hover:shadow-md hover:shadow-purple-50/80 shadow-sm cursor-pointer"
      }`}
    >
      {/* Left accent bar on hover */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-200
        ${isProcessing
          ? "bg-gradient-to-b from-purple-300 to-pink-300 opacity-60"
          : "bg-gradient-to-b from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100"
        }`}
      />

      {/* Thumbnail */}
      <div
        className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 ml-1"
        onClick={() => !isProcessing && openPreview(item)}
      >
        {isProcessing ? (
          <div className="w-full h-full bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spinSlow" />
          </div>
        ) : (
          <>
            {!imgLoaded && <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-xl" />}
            {isVideo ? (
              <>
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="thumbnail" loading="lazy" decoding="async"
                    onLoad={() => setImgLoaded(true)}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${imgLoaded ? "opacity-100" : "opacity-0"}`} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
                    <Video size={20} className="text-purple-300" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                    <Play size={10} className="text-gray-800 fill-gray-800 ml-0.5" />
                  </div>
                </div>
              </>
            ) : (
              <img src={mediaUrl} alt="media" loading="lazy" decoding="async"
                onLoad={() => setImgLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-200 group-hover:scale-105 transition-transform ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              />
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0" onClick={() => !isProcessing && openPreview(item)}>
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border
            ${isVideo
              ? "bg-pink-50 text-pink-600 border-pink-200"
              : "bg-purple-50 text-purple-600 border-purple-100"
            }`}>
            {isVideo ? <Video size={8} /> : <ImageIcon size={8} />}
            {isVideo ? "Video" : "Image"}
          </span>
          {isProcessing ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Processing
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium">{createdAt}</span>
          )}
        </div>

        {/* Prompt */}
        <p className="text-sm font-semibold text-gray-800 truncate leading-snug">
          {promptText}
        </p>

        {/* Style tag if present */}
        {item.style && (
          <span className="inline-block mt-1 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
            {item.style}
          </span>
        )}
      </div>

      {/* Actions — visible on hover */}
      {!isProcessing && (
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 flex-shrink-0">
          <RowBtn
            icon={<Download size={13} />}
            title="Download"
            onClick={(e) => { e.stopPropagation(); handleDownload(item.downloadUrl || mediaUrl); }}
          />
          <RowBtn
            icon={<Share2 size={13} />}
            title="Copy link"
            onClick={(e) => { e.stopPropagation(); handleShare(mediaUrl); }}
          />
          <RowBtn
            icon={<Trash2 size={13} />}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); dispatch(deleteMedia(item)); }}
            danger
          />
        </div>
      )}
    </div>
  );
}

function RowBtn({ icon, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-150
        ${danger
          ? "bg-red-50 border-red-200 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-md hover:shadow-red-200"
          : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 hover:shadow-sm"
        }`}
    >
      {icon}
    </button>
  );
}

/* ─────────────────── EMPTY STATE ─────────────────── */
function EmptyState({ type }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200 flex items-center justify-center mb-4 shadow-sm">
        <FolderOpen size={28} className="text-purple-400" />
      </div>
      <h3 className="text-base font-bold text-gray-700 mb-1">No {type} yet</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Generate some {type} from the Studio and they'll appear here.
      </p>
    </div>
  );
}

/* ─────────────────── SKELETONS ─────────────────── */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-gray-100 border border-gray-200 animate-pulse" />
      ))}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-xl animate-pulse">
          <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded-full" />
            <div className="h-3 w-48 bg-gray-100 rounded-full" />
            <div className="h-2 w-24 bg-gray-100 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
