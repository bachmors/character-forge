"use client";

interface CharacterImage {
  _id: string;
  category: string;
  subcategory: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  selected: boolean;
  created_at: string;
}

interface ImageModalProps {
  image: CharacterImage | null;
  baseImageUrl?: string;
  onClose: () => void;
}

export default function ImageModal({ image, baseImageUrl, onClose }: ImageModalProps) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-strong rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-accent text-lg font-semibold">
                {image.subcategory.replace(/_/g, " ")}
              </h3>
              <p className="text-xs text-muted">
                {image.category} &middot; {image.model_used} &middot;{" "}
                {new Date(image.created_at).toLocaleDateString()}
              </p>
            </div>
            <button onClick={onClose} className="text-muted hover:text-text transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Image comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Generated image */}
            <div>
              <p className="text-xs text-muted mb-1">Generated</p>
              <div className="rounded-lg border border-border overflow-hidden bg-bg">
                <img
                  src={image.image_url}
                  alt={image.subcategory}
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Base image for comparison */}
            {baseImageUrl && (
              <div>
                <p className="text-xs text-muted mb-1">Base Reference</p>
                <div className="rounded-lg border border-border overflow-hidden bg-bg">
                  <img
                    src={baseImageUrl}
                    alt="Base reference"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Prompt used */}
          {image.prompt_used && (
            <div>
              <p className="text-xs text-muted mb-1">Prompt Used</p>
              <div className="bg-bg border border-border rounded-lg p-3 text-sm text-text/80 font-mono leading-relaxed">
                {image.prompt_used}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
