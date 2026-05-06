"use client";

import { useState, useEffect } from "react";

export interface Collection {
  _id: string;
  name: string;
  category: string;
  description: string | null;
  coverImage: string | null;
  characterIds: string[];
  order: number;
  characterOrder: string[];
  createdAt: string;
  updatedAt: string;
}

export const COLLECTION_CATEGORIES = [
  { id: "short_film", label: "Short Film", color: "#c4a35a" },
  { id: "feature", label: "Feature Film", color: "#B87333" },
  { id: "series", label: "Series", color: "#378ADD" },
  { id: "illustrated_story", label: "Illustrated Story", color: "#a78bfa" },
  { id: "storyboard", label: "Storyboard", color: "#f59e0b" },
  { id: "tests", label: "Tests / Experiments", color: "#666666" },
  { id: "commercial", label: "Commercial / Campaign", color: "#1D9E75" },
  { id: "personal", label: "Personal", color: "#F5F0EB" },
  { id: "other", label: "Other", color: "#888888" },
] as const;

export function getCategoryInfo(categoryId: string) {
  return COLLECTION_CATEGORIES.find((c) => c.id === categoryId) || COLLECTION_CATEGORIES[COLLECTION_CATEGORIES.length - 1];
}

interface CollectionModalProps {
  open: boolean;
  editingCollection?: Collection | null;
  onClose: () => void;
  onSave: (data: { name: string; category: string; description: string | null }) => void;
}

export default function CollectionModal({ open, editingCollection, onClose, onSave }: CollectionModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("short_film");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (editingCollection) {
      setName(editingCollection.name);
      setCategory(editingCollection.category);
      setDescription(editingCollection.description || "");
    } else {
      setName("");
      setCategory("short_film");
      setDescription("");
    }
  }, [editingCollection, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), category, description: description.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border-strong rounded-xl w-full max-w-md animate-fade-in mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-accent text-xl font-semibold">
              {editingCollection ? "Edit Collection" : "New Collection"}
            </h2>
            <button onClick={onClose} className="text-muted hover:text-text transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PUSH, Fantasy Series"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Category *</label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLLECTION_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors border ${
                      category === cat.id
                        ? "border-accent/40 bg-accent/10"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: cat.color }} />
                    <span className={category === cat.id ? "text-accent" : "text-muted"}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={!name.trim()} className="flex-1 py-2 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editingCollection ? "Save Changes" : "Create Collection"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
