import React, { useRef, useState, useEffect } from "react";
import { Download, Trash2, Share2, Play, ImageIcon, Video } from "lucide-react";
import { deleteMedia } from "../redux/actions/imageVideoAction";

const MediaCard = React.memo(
  ({ item, openPreview, handleDownload, handleShare, dispatch }) => {
    const mediaUrl     = item.url || item.imageUrl;
    const isVideo      = item.type === "video";
    const isProcessing = item.status === "processing";

    const cardRef  = useRef(null);
    const [inView, setInView]     = useState(false); // for viewport-based video loading
    const [imgLoaded, setImgLoaded] = useState(false); // for image skeleton

    // Observe when card enters viewport — only then load the video src
    useEffect(() => {
      if (isProcessing || !isVideo) return;
      const el = cardRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
        { rootMargin: "200px" } // start loading 200px before visible
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [isVideo, isProcessing]);

    return (
      <div
        ref={cardRef}
        className="relative group rounded-xl overflow-hidden bg-white border border-gray-200
          hover:border-purple-300 hover:shadow-md hover:shadow-purple-100
          transition-all duration-200 aspect-square"
      >

        {/* ── PROCESSING ── */}
        {isProcessing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-100/60 to-transparent animate-shimmer bg-[length:200%_100%]" />
            <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spinSlow z-10" />
            <p className="text-[11px] font-semibold text-purple-500 z-10">
              Generating {isVideo ? "Video" : "Image"}…
            </p>
            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-purple-100">
              <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-gradientMove bg-[length:200%_200%]" />
            </div>
          </div>

        ) : !isVideo ? (
          /* ── IMAGE ── */
          <>
            {/* Skeleton shown until image finishes loading */}
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
            )}
            <img
              src={mediaUrl}
              alt="media"
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onClick={() => openPreview(item)}
              className={`w-full h-full object-cover cursor-pointer transition-all duration-300
                group-hover:scale-105
                ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>

        ) : (
          /* ── VIDEO — show thumbnail image, no video element needed in grid ── */
          <div onClick={() => openPreview(item)} className="relative w-full h-full cursor-pointer">
            {item.thumbnail ? (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 animate-pulse" />
                )}
                <img
                  src={item.thumbnail}
                  alt="video thumbnail"
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setImgLoaded(true)}
                  className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />
              </>
            ) : (
              /* fallback: load first frame via video metadata only when in viewport */
              <>
                {!inView && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
                    <Video size={24} className="text-purple-200" />
                  </div>
                )}
                {inView && (
                  <video
                    src={mediaUrl}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    muted
                    preload="metadata"
                    playsInline
                  />
                )}
              </>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors duration-200">
              <div className="w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center">
                <Play size={16} className="text-purple-600 fill-purple-600 ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* ── TYPE BADGE ── */}
        {!isProcessing && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/90 border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {isVideo
              ? <Video size={10} className="text-pink-500" />
              : <ImageIcon size={10} className="text-purple-500" />}
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wide">
              {isVideo ? "Video" : "Image"}
            </span>
          </div>
        )}

        {/* ── DURATION BADGE (videos only, always visible) ── */}
        {!isProcessing && isVideo && item.videoDuration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm">
            <span className="text-[9px] font-bold text-white tracking-wide">{item.videoDuration}</span>
          </div>
        )}

        {/* ── HOVER ACTIONS ── */}
        {!isProcessing && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
              <ActionBtn icon={<Download size={13} />} onClick={() => handleDownload(item.downloadUrl || mediaUrl)} title="Download" />
              <ActionBtn icon={<Trash2 size={13} />}   onClick={() => dispatch(deleteMedia(item))}                  title="Delete"   danger />
              <ActionBtn icon={<Share2 size={13} />}   onClick={() => handleShare(mediaUrl)}                        title="Copy link" />
            </div>
          </>
        )}
      </div>
    );
  }
);

function ActionBtn({ icon, onClick, title, danger }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-md border transition-all duration-150
        ${danger
          ? "bg-red-500 border-red-400 text-white hover:bg-red-600"
          : "bg-white border-gray-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600"
        }`}
    >
      {icon}
    </button>
  );
}

export default MediaCard;
