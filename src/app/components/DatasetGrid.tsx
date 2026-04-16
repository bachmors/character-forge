"use client";

import { useState } from "react";
import { STANDARD_POSES, CATEGORIES, type CategoryId } from "@/lib/prompts";
import { downloadImage } from "@/lib/imageUtils";

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

interface DatasetGridProps {
  images: CharacterImage[];
  characterName: string;
  baseImageUrl?: string;
  onImageClick: (image: CharacterImage) => void;
  onLightboxOpen: (src: string) => void;
  onToggleSelect: (imageId: string, selected: boolean) => void;
  onToggleFavorite: (imageId: string, favorite: boolean) => void;
  onDeleteImage: (imageId: string) => void;
}

export default function DatasetGrid({
  images,
  characterName,
  baseImageUrl,
  onImageClick,
  onLightboxOpen,
  onToggleSelect,
  onToggleFavorite,
  onDeleteImage,
}: DatasetGridProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">("all");

  const filteredImages =
    activeCategory === "all"
      ? images
      : images.filter((img) => img.category === activeCategory);

  // Build checklist: for each standard pose, check if we have an image
  const checklist = STANDARD_POSES.map((pose) => {
    const existing = images.filter(
      (img) => img.category === pose.category && img.subcategory === pose.subcategory
    );
    return {
      pose,
      completed: existing.length > 0,
      count: existing.length,
    };
  });

  const completedCount = checklist.filter((c) => c.completed).length;
  const totalPoses = STANDARD_POSES.length;

  const handleDownload = (image: CharacterImage) => {
    const filename = `${characterName.replace(/\s+/g, "_")}_${image.subcategory}_${Date.now()}.png`;
    downloadImage(image.image_url, filename);
  };

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif text-accent text-lg font-semibold">Dataset</h3>
          <span className="text-sm text-muted">
            {completedCount}/{totalPoses} standard poses
          </span>
        </div>
        <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalPoses) * 100}%` }}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto flex-nowrap">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${
            activeCategory === "all"
              ? "bg-accent/15 text-accent font-medium"
              : "text-muted hover:text-text"
          }`}
        >
          All ({images.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = images.filter((img) => img.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-muted hover:text-text"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Standard Poses Checklist (collapsed by default) */}
      <details className="mb-6 border border-border rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-sm text-muted hover:text-text transition-colors">
          Standard Poses Checklist ({completedCount}/{totalPoses} completed)
        </summary>
        <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {checklist.map(({ pose, completed, count }) => (
            <div
              key={pose.id}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                completed ? "text-success" : "text-muted"
              }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                completed
                  ? "border-success/50 bg-success/10"
                  : "border-border"
              }`}>
                {completed && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span>{pose.label}</span>
              {count > 1 && <span className="text-muted">({count})</span>}
            </div>
          ))}
        </div>
      </details>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-16">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto opacity-30 text-muted">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-muted text-sm mt-4">No images in this category yet</p>
          <p className="text-muted/60 text-xs mt-1">
            Go to the Generate tab to create new images
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {/* Reference image as first item */}
          {baseImageUrl && activeCategory === "all" && (
            <div
              className="group relative rounded-lg border border-accent/30 overflow-hidden cursor-pointer hover:border-accent/60 transition-all ring-1 ring-accent/10"
              onClick={() => onLightboxOpen(baseImageUrl)}
            >
              <div className="aspect-square bg-bg">
                <img src={baseImageUrl} alt="Reference" className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-1 left-1">
                <span className="px-2 py-0.5 rounded-full bg-accent text-bg text-[10px] font-semibold">
                  Reference
                </span>
              </div>
            </div>
          )}
          {filteredImages.map((image) => (
            <div
              key={image._id}
              className={`group relative rounded-lg border overflow-hidden transition-all cursor-pointer hover:border-accent/40 ${
                image.selected ? "border-accent/50 ring-1 ring-accent/20" : "border-border"
              }`}
            >
              {/* Image */}
              <div
                className="aspect-square bg-bg"
                onClick={() => onImageClick(image)}
              >
                <img
                  src={image.image_url}
                  alt={image.subcategory}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              {/* Info bar */}
              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-text truncate">{image.subcategory.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted truncate">{image.model_used}</p>
              </div>

              {/* Actions - top right */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Favorite */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(image._id, !image.favorite);
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                    image.favorite
                      ? "bg-accent text-bg"
                      : "bg-black/60 text-white hover:bg-accent hover:text-bg"
                  }`}
                  title={image.favorite ? "Remove favorite" : "Set as favorite"}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={image.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                {/* Select */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(image._id, !image.selected);
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                    image.selected
                      ? "bg-accent text-bg"
                      : "bg-black/60 text-white hover:bg-accent hover:text-bg"
                  }`}
                  title={image.selected ? "Deselect" : "Select for dataset"}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                {/* Download */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(image);
                  }}
                  className="w-6 h-6 rounded bg-black/60 text-white hover:bg-accent hover:text-bg flex items-center justify-center transition-colors"
                  title="Download"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this image?")) {
                      onDeleteImage(image._id);
                    }
                  }}
                  className="w-6 h-6 rounded bg-black/60 text-white hover:bg-danger hover:text-white flex items-center justify-center transition-colors"
                  title="Delete"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Badges - top left */}
              <div className="absolute top-1 left-1 flex gap-1">
                {image.favorite && (
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-bg">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                )}
                {image.selected && (
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-bg">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
