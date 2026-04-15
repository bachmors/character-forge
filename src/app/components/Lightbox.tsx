"use client";

import { useEffect, useCallback } from "react";
import { downloadImage } from "@/lib/imageUtils";

interface LightboxProps {
  src: string | null;
  onClose: () => void;
}

export default function Lightbox({ src, onClose }: LightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (src) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [src, handleKeyDown]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt="Enlarged view"
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        />
        <div className="absolute top-3 right-3 flex gap-1">
          <button
            onClick={() => downloadImage(src, `image_${Date.now()}.png`)}
            className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            title="Download"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            title="Close (ESC)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
