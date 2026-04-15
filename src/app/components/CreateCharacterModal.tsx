"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/imageUtils";

interface CreateCharacterModalProps {
  open: boolean;
  fromImage?: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    base_image_url: string;
    traits: Record<string, string>;
  }) => void;
}

export default function CreateCharacterModal({
  open,
  fromImage,
  onClose,
  onCreate,
}: CreateCharacterModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseImageUrl, setBaseImageUrl] = useState("");
  const [traits, setTraits] = useState({
    hair: "",
    accessories: "",
    skin: "",
    expression_default: "neutral",
    clothing_base: "",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  if (!open) return null;

  const analyzeBase64 = async (base64: string, mimeType: string) => {
    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch("/api/analyze/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || "Analysis failed");
        return;
      }

      if (data.name_suggestion && !name.trim()) setName(data.name_suggestion);
      if (data.description) setDescription(data.description);

      setTraits((prev) => ({
        ...prev,
        hair: data.hair || prev.hair,
        skin: data.skin || prev.skin,
        accessories: data.accessories || prev.accessories,
        clothing_base: data.clothing_base || prev.clothing_base,
        expression_default: data.expression_default || prev.expression_default,
      }));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeImage = async () => {
    const url = baseImageUrl.trim();
    if (!url) return;

    if (url.startsWith("data:")) {
      const matches = url.match(/^data:(.+?);base64,(.+)$/);
      if (matches) {
        await analyzeBase64(matches[2], matches[1]);
      }
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const imageRes = await fetch(url);
      if (!imageRes.ok) throw new Error("Could not fetch image");

      const buffer = await imageRes.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const contentType = imageRes.headers.get("content-type") || "image/jpeg";
      await analyzeBase64(base64, contentType);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
      setAnalyzing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const compressed = await compressImage(dataUrl);
      setBaseImageUrl(compressed);
      // Auto-analyze the uploaded image
      const matches = compressed.match(/^data:(.+?);base64,(.+)$/);
      if (matches) {
        await analyzeBase64(matches[2], matches[1]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim(),
      base_image_url: baseImageUrl.trim(),
      traits,
    });
    // Reset
    setName("");
    setDescription("");
    setBaseImageUrl("");
    setTraits({ hair: "", accessories: "", skin: "", expression_default: "neutral", clothing_base: "" });
    setAnalyzeError(null);
  };

  const traitFields = [
    { key: "hair", label: "Hair", placeholder: "e.g. intricate black box braids" },
    { key: "skin", label: "Skin", placeholder: "e.g. natural brown skin with freckles" },
    { key: "accessories", label: "Accessories", placeholder: "e.g. black lace choker necklace" },
    { key: "clothing_base", label: "Base Clothing", placeholder: "e.g. white ribbed strapless top" },
    { key: "expression_default", label: "Default Expression", placeholder: "e.g. neutral-seductive" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border-strong rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-accent text-xl font-semibold">New Character</h2>
            <button onClick={onClose} className="text-muted hover:text-text transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-muted mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Character name"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the character..."
                rows={2}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
              />
            </div>

            {/* Base Image Upload / URL */}
            <div>
              <label className="block text-sm text-muted mb-1">Base Image</label>
              {/* File Upload Area */}
              <div
                className={`mb-2 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-accent/40 ${
                  baseImageUrl ? "border-success/30 bg-success/5" : "border-border"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith("image/")) handleFileUpload(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                {baseImageUrl ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0">
                      <img src={baseImageUrl} alt="Uploaded" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-success font-medium">Image loaded</p>
                      <p className="text-xs text-muted">Click or drop to replace</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted mb-1">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="text-xs text-muted">Drop image here or click to upload</p>
                  </div>
                )}
              </div>
              {/* OR URL input */}
              <input
                type="text"
                value={baseImageUrl.startsWith("data:") ? "" : baseImageUrl}
                onChange={(e) => setBaseImageUrl(e.target.value)}
                placeholder="...or paste image URL"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
              />
              {baseImageUrl && (
                <button
                  type="button"
                  onClick={handleAnalyzeImage}
                  disabled={analyzing}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
                      </svg>
                      Analyzing...
                    </span>
                  ) : (
                    "Auto-Analyze Image with AI"
                  )}
                </button>
              )}
              {analyzeError && <p className="text-xs text-danger mt-1">{analyzeError}</p>}
            </div>

            {/* Traits */}
            <div>
              <label className="block text-sm text-accent mb-2 font-medium">Character Traits</label>
              <div className="space-y-3">
                {traitFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs text-muted mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={traits[field.key as keyof typeof traits]}
                      onChange={(e) =>
                        setTraits((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 py-2 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Character
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
