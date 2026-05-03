"use client";

import { useState, useMemo } from "react";
import { STANDARD_POSES, CATEGORIES, type CategoryId } from "@/lib/prompts";
import { downloadImage } from "@/lib/imageUtils";

const MAX_COMPARE = 4;

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
  target_age?: number | null;
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
  const [compareMode, setCompareMode] = useState(false);
  // Ordered list of image _ids in the compare set (preserves the order in
  // which the user picked them so cards render left→right deterministically).
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = (image: CharacterImage) => {
    setCompareIds((prev) => {
      if (prev.includes(image._id)) return prev.filter((id) => id !== image._id);
      if (prev.length >= MAX_COMPARE) return prev; // hard cap at MAX_COMPARE
      return [...prev, image._id];
    });
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareIds([]);
  };

  // Resolve the selected ids to the actual image objects, preserving order
  // and silently dropping any ids that no longer exist (e.g. after a delete).
  const compareImages = useMemo(() => {
    const byId = new Map(images.map((i) => [i._id, i]));
    return compareIds.map((id) => byId.get(id)).filter((i): i is CharacterImage => Boolean(i));
  }, [compareIds, images]);

  // For each comparable field, compute whether values vary across the
  // selected images. Used to highlight differences in the compare panel.
  const compareDiff = useMemo(() => {
    const setOf = <T,>(fn: (img: CharacterImage) => T) =>
      new Set(compareImages.map(fn).map((v) => (v == null ? "" : String(v))));
    return {
      age: setOf((i) => i.target_age ?? null).size > 1,
      category: setOf((i) => i.category).size > 1,
      subcategory: setOf((i) => i.subcategory).size > 1,
      prompt: setOf((i) => i.prompt_used || "").size > 1,
      model: setOf((i) => i.model_used || "").size > 1,
    };
  }, [compareImages]);

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

      {/* Category Tabs + Compare toggle */}
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
        <button
          onClick={() => {
            if (compareMode) exitCompare();
            else setCompareMode(true);
          }}
          className={`ml-auto px-3 py-1 rounded text-sm transition-colors whitespace-nowrap border ${
            compareMode
              ? "bg-accent/15 text-accent border-accent/30"
              : "text-muted border-border hover:text-text hover:border-border-strong"
          }`}
          title="Select 2–4 images to compare side by side"
        >
          {compareMode
            ? `Comparing (${compareImages.length}/${MAX_COMPARE}) — Exit`
            : "Compare"}
        </button>
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

      {/* Compare panel */}
      {compareMode && (
        <div className="mb-6 border border-accent/30 bg-accent/5 rounded-lg p-3 md:p-4 animate-fade-in">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-sm">
              <span className="text-accent font-medium">Compare</span>
              <span className="text-muted ml-2">
                {compareImages.length === 0
                  ? "Click images below to add them to the comparison."
                  : compareImages.length < 2
                    ? "Pick at least one more image."
                    : `${compareImages.length} image${compareImages.length === 1 ? "" : "s"} side by side.`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {compareImages.length > 0 && (
                <button
                  onClick={() => setCompareIds([])}
                  className="px-2.5 py-1 rounded text-xs border border-border text-muted hover:text-text hover:border-border-strong transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={exitCompare}
                className="px-2.5 py-1 rounded text-xs border border-border text-muted hover:text-text hover:border-border-strong transition-colors"
              >
                Exit
              </button>
            </div>
          </div>

          {compareImages.length === 0 ? (
            <p className="text-xs text-muted/70 italic">
              Up to {MAX_COMPARE} images can be compared at once.
            </p>
          ) : (
            <div
              className={`grid gap-3 grid-cols-1 ${
                compareImages.length === 2
                  ? "md:grid-cols-2"
                  : compareImages.length === 3
                    ? "md:grid-cols-3"
                    : "md:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {compareImages.map((img, idx) => (
                <div
                  key={img._id}
                  className="border border-border rounded-lg overflow-hidden bg-surface flex flex-col"
                >
                  <div
                    className="aspect-square bg-bg cursor-pointer"
                    onClick={() => onLightboxOpen(img.image_url)}
                  >
                    <img
                      src={img.image_url}
                      alt={img.subcategory}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2.5 text-xs space-y-1 flex-1">
                    {/* Position number */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-1.5 py-0.5 rounded-full bg-accent text-bg text-[10px] font-semibold">
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() =>
                          setCompareIds((prev) => prev.filter((id) => id !== img._id))
                        }
                        className="text-muted/60 hover:text-danger transition-colors"
                        title="Remove from comparison"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    {/* Age — highlighted when ages vary */}
                    <div
                      className={
                        compareDiff.age
                          ? "text-accent font-medium"
                          : "text-muted"
                      }
                    >
                      Age:{" "}
                      {typeof img.target_age === "number" && img.target_age > 0
                        ? `${img.target_age}`
                        : "as reference"}
                    </div>

                    {/* Pose / category */}
                    <div
                      className={
                        compareDiff.subcategory || compareDiff.category
                          ? "text-accent font-medium"
                          : "text-muted"
                      }
                    >
                      Pose: <span className="capitalize">{img.subcategory.replace(/_/g, " ")}</span>
                      <span className="text-muted/70">
                        {" · "}
                        {img.category.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Model + date */}
                    <div className={compareDiff.model ? "text-accent" : "text-muted/70"}>
                      {img.model_used || "—"}
                    </div>

                    {/* Prompt — show only difference flag, full text takes too much room */}
                    {compareDiff.prompt && (
                      <details className="text-muted/80">
                        <summary className="cursor-pointer text-accent/80 hover:text-accent">
                          Prompt differs
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-muted leading-snug font-mono">
                          {img.prompt_used}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {compareImages.length >= 2 && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-muted">Differences:</span>
              {compareDiff.age && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  age
                </span>
              )}
              {compareDiff.subcategory && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  pose
                </span>
              )}
              {compareDiff.category && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  category
                </span>
              )}
              {compareDiff.prompt && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  prompt
                </span>
              )}
              {compareDiff.model && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                  model
                </span>
              )}
              {!compareDiff.age &&
                !compareDiff.subcategory &&
                !compareDiff.category &&
                !compareDiff.prompt &&
                !compareDiff.model && (
                  <span className="text-muted/70 italic">
                    All metadata identical — pure regenerations.
                  </span>
                )}
            </div>
          )}
        </div>
      )}

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
          {filteredImages.map((image) => {
            const compareIdx = compareIds.indexOf(image._id);
            const inCompare = compareIdx !== -1;
            const compareFull = !inCompare && compareIds.length >= MAX_COMPARE;
            return (
            <div
              key={image._id}
              className={`group relative rounded-lg border overflow-hidden transition-all cursor-pointer ${
                inCompare
                  ? "border-accent ring-2 ring-accent/40"
                  : compareMode && compareFull
                    ? "border-border opacity-50 hover:opacity-70"
                    : image.selected
                      ? "border-accent/50 ring-1 ring-accent/20 hover:border-accent/40"
                      : "border-border hover:border-accent/40"
              }`}
            >
              {/* Image */}
              <div
                className="aspect-square bg-bg"
                onClick={() => {
                  if (compareMode) {
                    if (inCompare || !compareFull) toggleCompare(image);
                  } else {
                    onImageClick(image);
                  }
                }}
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
                {typeof image.target_age === "number" && image.target_age > 0 && (
                  <div
                    className="h-5 px-1.5 rounded-full bg-bg/80 border border-accent/30 flex items-center justify-center text-[10px] font-semibold text-accent"
                    title={`Generated at age ${image.target_age}`}
                  >
                    {image.target_age}y
                  </div>
                )}
                {inCompare && (
                  <div
                    className="w-5 h-5 rounded-full bg-accent text-bg flex items-center justify-center text-[10px] font-bold"
                    title={`Position #${compareIdx + 1} in comparison`}
                  >
                    {compareIdx + 1}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
