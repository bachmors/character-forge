"use client";

import { useState, useEffect, useCallback } from "react";
import { downloadImage, compressImage } from "@/lib/imageUtils";

interface CharacterImage {
  _id: string;
  character_id: string;
  category: string;
  subcategory: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  selected: boolean;
  favorite: boolean;
  created_at: string;
}

interface ImageModalProps {
  image: CharacterImage | null;
  characterName: string;
  baseImageUrl?: string;
  onClose: () => void;
  onImageSaved: () => void;
}

export default function ImageModal({
  image,
  characterName,
  baseImageUrl,
  onClose,
  onImageSaved,
}: ImageModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // ESC to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset state when image changes
  useEffect(() => {
    setShowDetails(false);
    setEditMode(false);
    setEditPrompt("");
    setEditedImage(null);
    setEditError(null);
  }, [image?._id]);

  if (!image) return null;

  const handleDownload = () => {
    const filename = `${characterName.replace(/\s+/g, "_")}_${image.subcategory}_${Date.now()}.png`;
    downloadImage(image.image_url, filename);
  };

  const handleEditImage = async () => {
    if (!editPrompt.trim()) return;
    setEditing(true);
    setEditError(null);
    setEditedImage(null);

    try {
      const res = await fetch("/api/generate/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Edit this image: ${editPrompt}. Keep the character's identity and style consistent.`,
          referenceImageUrl: image.image_url,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Edit failed");
        return;
      }
      setEditedImage(data.image_url);
    } catch {
      setEditError("Network error");
    } finally {
      setEditing(false);
    }
  };

  const handleAcceptEdit = async () => {
    if (!editedImage) return;
    try {
      const compressed = await compressImage(editedImage);
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: image.character_id,
          category: image.category,
          subcategory: image.subcategory,
          image_url: compressed,
          prompt_used: `Edit: ${editPrompt} (based on ${image.subcategory})`,
          model_used: "gemini-edit",
        }),
      });
      if (res.ok) {
        onImageSaved();
        setEditMode(false);
        setEditedImage(null);
        setEditPrompt("");
      }
    } catch (err) {
      console.error("Failed to save edited image:", err);
    }
  };

  const hasSidePanel = showDetails || editMode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with actions */}
        <div className="w-full flex items-center justify-between p-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80 font-medium">
              {image.subcategory.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-white/50">{image.model_used}</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Download */}
            <button
              onClick={handleDownload}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="Download"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {/* Edit */}
            <button
              onClick={() => {
                setEditMode(!editMode);
                if (!editMode) setShowDetails(false);
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                editMode ? "bg-accent text-bg" : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title="Edit image"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {/* Details toggle */}
            <button
              onClick={() => {
                setShowDetails(!showDetails);
                if (!showDetails) setEditMode(false);
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                showDetails ? "bg-accent text-bg" : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title="Details"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              title="Close (ESC)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex gap-4 items-start max-h-[85vh]">
          <img
            src={editedImage || image.image_url}
            alt={image.subcategory}
            className="rounded-lg object-contain"
            style={{
              maxWidth: hasSidePanel ? "60vw" : "90vw",
              maxHeight: "80vh",
            }}
          />

          {/* Side panel */}
          {hasSidePanel && (
            <div className="w-80 bg-surface border border-border rounded-lg p-4 max-h-[80vh] overflow-y-auto shrink-0">
              {showDetails && (
                <div className="space-y-3">
                  <h4 className="text-sm text-accent font-medium">Details</h4>
                  <div>
                    <p className="text-xs text-muted">Category</p>
                    <p className="text-sm text-text">
                      {image.category} / {image.subcategory.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Model</p>
                    <p className="text-sm text-text">{image.model_used}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Created</p>
                    <p className="text-sm text-text">{new Date(image.created_at).toLocaleString()}</p>
                  </div>
                  {image.prompt_used && (
                    <div>
                      <p className="text-xs text-muted mb-1">Prompt</p>
                      <p className="text-xs text-text/80 font-mono bg-bg p-2 rounded border border-border leading-relaxed">
                        {image.prompt_used}
                      </p>
                    </div>
                  )}
                  {baseImageUrl && (
                    <div>
                      <p className="text-xs text-muted mb-1">Base Reference</p>
                      <img
                        src={baseImageUrl}
                        alt="Base reference"
                        className="w-full rounded border border-border"
                      />
                    </div>
                  )}
                </div>
              )}

              {editMode && (
                <div className="space-y-3">
                  <h4 className="text-sm text-accent font-medium">Edit Image</h4>
                  <p className="text-xs text-muted">
                    Describe the changes you want to make to this image.
                  </p>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g. change shirt to blue, add glasses, make hair shorter..."
                    rows={3}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
                  />
                  <button
                    onClick={handleEditImage}
                    disabled={editing || !editPrompt.trim()}
                    className="w-full py-2 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {editing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
                        </svg>
                        Editing...
                      </span>
                    ) : (
                      "Apply Edit"
                    )}
                  </button>
                  {editError && <p className="text-xs text-danger">{editError}</p>}
                  {editedImage && (
                    <div className="space-y-2">
                      <p className="text-xs text-success">Edit generated! Preview shown in main view.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAcceptEdit}
                          className="flex-1 py-1.5 rounded-lg bg-success/15 text-success border border-success/30 text-xs font-medium hover:bg-success/25 transition-colors"
                        >
                          Save as New
                        </button>
                        <button
                          onClick={() => setEditedImage(null)}
                          className="flex-1 py-1.5 rounded-lg border border-border text-muted text-xs hover:text-text transition-colors"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
