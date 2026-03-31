import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Download, Share2, Trash2, ChevronLeft, ChevronRight,
  Sparkles, Calendar, FileText, Wand2, ImageIcon, Video, Check,
  Mic, Captions, Play, Timer,
} from "lucide-react";
import { deleteMedia } from "../../redux/actions/imageVideoAction";

const STRIP_SIZE = 5;

export default function MediaPreview({ item, items = [], onClose, dispatch, handleDownload }) {
  const [currentIndex, setCurrentIndex] = useState(() => items.findIndex((i) => i.id === item?.id));
  const [stripOffset, setStripOffset]   = useState(() => {
    const idx = items.findIndex((i) => i.id === item?.id);
    return Math.max(0, Math.min(idx - Math.floor(STRIP_SIZE / 2), items.length - STRIP_SIZE));
  });
  const [copied, setCopied]         = useState(false);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);

  const current  = items[currentIndex] ?? item;
  const mediaUrl = current?.url || current?.imageUrl;
  const isVideo  = current?.type === "video";
  const hasPrev  = currentIndex > 0;
  const hasNext  = currentIndex < items.length - 1;

  useEffect(() => { setImgLoaded(false); setVideoLoading(true); }, [currentIndex]);

  // Keep strip window centered on the active item
  useEffect(() => {
    setStripOffset((prev) => {
      if (currentIndex < prev) return currentIndex;
      if (currentIndex >= prev + STRIP_SIZE) return currentIndex - STRIP_SIZE + 1;
      return prev;
    });
  }, [currentIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape")                    onClose();
      if (e.key === "ArrowLeft"  && hasPrev) setCurrentIndex((i) => i - 1);
      if (e.key === "ArrowRight" && hasNext) setCurrentIndex((i) => i + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleShare = useCallback(() => {
    if (!mediaUrl) return;
    navigator.clipboard.writeText(mediaUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mediaUrl]);

  const handleDelete = useCallback(() => {
    dispatch(deleteMedia(current));
    onClose();
  }, [current, dispatch, onClose]);

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  if (!current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-50">

      {/* ══════════ TOP NAV BAR ══════════ */}
      <div className="h-14 flex-shrink-0 flex items-center justify-between px-5 bg-white border-b border-gray-200 shadow-sm">

        {/* Back button — always visible, high contrast */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 h-9 px-4 rounded-xl
            bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold
            shadow-md shadow-purple-200 hover:from-purple-500 hover:to-pink-400 transition-all duration-150"
        >
          <ArrowLeft size={14} />
          Back to Gallery
        </button>

        {/* Type badge + duration */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border
            ${isVideo
              ? "bg-pink-50 text-pink-600 border-pink-200"
              : "bg-purple-50 text-purple-600 border-purple-200"
            }`}>
            {isVideo ? <Video size={10} /> : <ImageIcon size={10} />}
            {isVideo ? "Video" : "Image"}
          </span>
          {isVideo && current?.videoDuration && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-gray-50 text-gray-600 border-gray-200">
              <Timer size={10} />
              {current.videoDuration}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <TopBtn icon={<Download size={13} />} label="Download" onClick={() => handleDownload(current.downloadUrl || mediaUrl)} />
          <TopBtn icon={copied ? <Check size={13} /> : <Share2 size={13} />} label={copied ? "Copied!" : "Share"} onClick={handleShare} active={copied} />
          <TopBtn icon={<Trash2 size={13} />} label="Delete" onClick={handleDelete} danger />
        </div>
      </div>

      {/* ══════════ BODY ══════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── MEDIA AREA ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-100">

          {/* Media viewer */}
          <div className="flex-1 flex items-center justify-center relative p-6 overflow-hidden">

            {/* Subtle gradient glow */}
            <div className={`absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-10 pointer-events-none
              ${isVideo ? "bg-pink-400" : "bg-purple-400"}`} />

            {/* Prev */}
            {hasPrev && (
              <button
                onClick={() => setCurrentIndex((i) => i - 1)}
                className="absolute left-4 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-purple-600 hover:border-purple-300 transition"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Media */}
            <div className="relative flex items-center justify-center max-w-full max-h-full">
              {!imgLoaded && !isVideo && (
                <div className="w-80 h-80 rounded-2xl bg-gray-200 animate-pulse" />
              )}
              {isVideo ? (
                <div className="relative">
                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-200 z-10"
                      style={{ minWidth: 320, minHeight: 180 }}>
                      {current?.thumbnail
                        ? <img src={current.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-60" />
                        : null}
                      <div className="relative z-10 w-12 h-12 rounded-full border-4 border-purple-300 border-t-purple-600 animate-spin" />
                    </div>
                  )}
                  <video
                    key={mediaUrl}
                    src={mediaUrl}
                    controls
                    preload="metadata"
                    poster={current?.thumbnail || undefined}
                    onCanPlay={() => setVideoLoading(false)}
                    className={`max-h-[calc(100vh-200px)] max-w-full rounded-2xl shadow-xl shadow-gray-300/60 object-contain transition-opacity duration-300 ${videoLoading ? "opacity-0" : "opacity-100"}`}
                  /></div>
              ) : (
                <img
                  key={mediaUrl}
                  src={mediaUrl}
                  alt="preview"
                  decoding="async"
                  onLoad={() => setImgLoaded(true)}
                  className={`max-h-[calc(100vh-200px)] max-w-full rounded-2xl shadow-xl shadow-gray-300/60 object-contain transition-opacity duration-300
                    ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />
              )}
            </div>

            {/* Next */}
            {hasNext && (
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-purple-600 hover:border-purple-300 transition"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          {/* Thumbnail strip — 5 at a time */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-t border-gray-200">
              {/* Strip prev arrow */}
              <button
                onClick={() => setStripOffset((o) => Math.max(0, o - 1))}
                disabled={stripOffset === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400
                  hover:border-purple-300 hover:text-purple-600 transition disabled:opacity-20 disabled:pointer-events-none flex-shrink-0"
              >
                <ChevronLeft size={14} />
              </button>

              {/* 5 visible thumbnails */}
              <div className="flex items-center gap-2">
                {items.slice(stripOffset, stripOffset + STRIP_SIZE).map((it, i) => {
                  const idx     = stripOffset + i;
                  const url     = it.url || it.imageUrl;
                  const isVid   = it.type === "video";
                  const active  = idx === currentIndex;
                  return (
                    <button
                      key={it.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-150 bg-gray-900
                        ${active
                          ? "border-purple-500 scale-110 shadow-md shadow-purple-200"
                          : "border-gray-200 opacity-50 hover:opacity-80"
                        }`}
                    >
                      {isVid ? (
                        it.thumbnail ? (
                          <img
                            src={it.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          /* No thumbnail — show first frame via metadata-only video */
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                            playsInline
                          />
                        )
                      ) : (
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      {/* Play badge on videos */}
                      {isVid && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                            <Play size={8} className="text-gray-800 fill-gray-800 ml-0.5" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Strip next arrow */}
              <button
                onClick={() => setStripOffset((o) => Math.min(items.length - STRIP_SIZE, o + 1))}
                disabled={stripOffset + STRIP_SIZE >= items.length}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400
                  hover:border-purple-300 hover:text-purple-600 transition disabled:opacity-20 disabled:pointer-events-none flex-shrink-0"
              >
                <ChevronRight size={14} />
              </button>

              {/* Position indicator */}
              <span className="text-[10px] text-gray-400 font-medium ml-1 flex-shrink-0">
                {currentIndex + 1} / {items.length}
              </span>
            </div>
          )}
        </div>

        {/* ── DETAILS PANEL ── */}
        <div className="hidden md:flex w-[300px] flex-col bg-white border-l border-gray-200 overflow-y-auto">

          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shadow-purple-200">
              <Sparkles size={10} className="text-white" />
            </div>
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Details</span>
          </div>

          <div className="flex-1 px-5 py-4 space-y-3">

            {/* Prompt */}
            <InfoCard icon={<FileText size={13} />} label="Prompt">
              {current?.prompt
                ? <p className="text-xs text-gray-600 leading-relaxed">{current.prompt}</p>
                : <p className="text-xs text-gray-400 italic">No prompt available</p>
              }
            </InfoCard>

            {/* Date */}
            {current?.createdAt && (
              <InfoCard icon={<Calendar size={13} />} label="Created">
                <p className="text-xs text-gray-600">{formatDate(current.createdAt)}</p>
              </InfoCard>
            )}

            {/* Style */}
            {current?.style && (
              <InfoCard icon={<Wand2 size={13} />} label="Style">
                <span className="inline-block text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  {current.style}
                </span>
              </InfoCard>
            )}

            {/* Type */}
            <InfoCard icon={isVideo ? <Video size={13} /> : <ImageIcon size={13} />} label="Type">
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border
                ${isVideo
                  ? "text-pink-600 bg-pink-50 border-pink-200"
                  : "text-purple-600 bg-purple-50 border-purple-200"
                }`}>
                {isVideo ? "Video" : "Image"}
              </span>
            </InfoCard>

            {/* Duration */}
            {isVideo && current?.videoDuration && (
              <InfoCard icon={<Timer size={13} />} label="Duration">
                <span className="inline-block text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  {current.videoDuration}
                </span>
              </InfoCard>
            )}

            {/* Voice Script */}
            {isVideo && (
              <InfoCard icon={<Mic size={13} />} label="Voice Script">
                {current?.voiceOverText
                  ? <p className="text-xs text-gray-600 leading-relaxed">{current.voiceOverText}</p>
                  : <p className="text-xs text-gray-400 italic">No voice script</p>
                }
              </InfoCard>
            )}

            {/* Subtitles */}
            {isVideo && (
              <InfoCard icon={<Captions size={13} />} label="Subtitles">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                  current?.hasSubtitle
                    ? "text-purple-600 bg-purple-50 border-purple-200"
                    : "text-gray-400 bg-gray-50 border-gray-200"
                }`}>
                  {current?.hasSubtitle ? "On" : "Off"}
                </span>
              </InfoCard>
            )}

            {/* Filename */}
            {current?.filename && (
              <InfoCard icon={<FileText size={13} />} label="Filename">
                <p className="text-xs text-gray-400 break-all font-mono">{current.filename}</p>
              </InfoCard>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-5 border-t border-gray-100 space-y-2">
            <button
              onClick={() => handleDownload(current.downloadUrl || mediaUrl)}
              className="w-full h-10 rounded-xl text-sm font-bold
                bg-gradient-to-r from-purple-600 to-pink-500 text-white
                hover:from-purple-500 hover:to-pink-400
                shadow-md shadow-purple-200 transition-all duration-200
                flex items-center justify-center gap-2"
            >
              <Download size={14} /> Download
            </button>
            <button
              onClick={handleShare}
              className="w-full h-10 rounded-xl text-sm font-semibold
                bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300
                text-gray-600 hover:text-purple-700 transition-all duration-200
                flex items-center justify-center gap-2"
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? "Link Copied!" : "Share Link"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TopBtn({ icon, label, onClick, danger, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150
        ${danger  ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
        : active  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
        :           "bg-gray-50 border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
        }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function InfoCard({ icon, label, children }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      {children}
    </div>
  );
}
