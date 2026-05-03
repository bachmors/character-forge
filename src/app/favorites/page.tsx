"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface FavoriteImage {
  _id: string;
  character_id: string;
  category: string;
  subcategory: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  selected: boolean;
  favorite: boolean;
  rating?: number;
  target_age?: number | null;
  created_at: string;
}

interface CharacterStat {
  _id: string;
  name: string;
}

export default function FavoritesPage() {
  const [images, setImages] = useState<FavoriteImage[]>([]);
  const [characters, setCharacters] = useState<CharacterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [characterFilter, setCharacterFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [minRating, setMinRating] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [iRes, cRes] = await Promise.all([
          fetch("/api/images/favorites"),
          fetch("/api/characters/stats"),
        ]);
        if (!iRes.ok) throw new Error("Could not load favorites");
        const i = await iRes.json();
        const c = cRes.ok ? await cRes.json() : [];
        if (cancelled) return;
        setImages(Array.isArray(i) ? i : []);
        setCharacters(Array.isArray(c) ? c : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const characterById = useMemo(() => {
    const m = new Map<string, CharacterStat>();
    for (const c of characters) m.set(c._id, c);
    return m;
  }, [characters]);

  const visible = useMemo(() => {
    return images.filter((img) => {
      if (characterFilter !== "all" && img.character_id !== characterFilter) return false;
      if (categoryFilter !== "all" && img.category !== categoryFilter) return false;
      if (minRating > 0 && (img.rating || 0) < minRating) return false;
      return true;
    });
  }, [images, characterFilter, categoryFilter, minRating]);

  const distinctCategories = useMemo(() => {
    const s = new Set<string>();
    for (const i of images) if (i.category) s.add(i.category);
    return Array.from(s).sort();
  }, [images]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link href="/" className="text-muted hover:text-text transition-colors text-sm shrink-0">
            ← Workspace
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide">
            Favorites
          </h1>
          <span className="text-xs text-muted">{visible.length}/{images.length}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        {/* Filters */}
        <section className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={characterFilter}
            onChange={(e) => setCharacterFilter(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-border-strong"
          >
            <option value="all">All characters</option>
            {characters.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-border-strong"
          >
            <option value="all">All categories</option>
            {distinctCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <span className="text-muted">Min rating:</span>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setMinRating(n)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  minRating === n
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "border-border text-muted hover:text-text hover:border-border-strong"
                }`}
              >
                {n === 0 ? "any" : `${n}★`}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="py-16 text-center text-muted animate-pulse-glow">Loading…</div>
        ) : error ? (
          <div className="py-16 text-center text-danger text-sm">{error}</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            {images.length === 0
              ? "No favorites yet. Tap the star on any generated image to add it here."
              : "No favorites match the current filters."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visible.map((img) => (
              <Link
                key={img._id}
                href={`/?characterId=${img.character_id}`}
                className="border border-border rounded-lg bg-surface overflow-hidden hover:border-accent/40 transition-colors group"
              >
                <div className="aspect-square bg-bg overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={img.subcategory}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                </div>
                <div className="p-2 text-[11px] space-y-0.5">
                  <p className="text-text truncate">
                    {characterById.get(img.character_id)?.name || "—"}
                  </p>
                  <p className="text-muted truncate capitalize">
                    {img.subcategory.replace(/_/g, " ")}
                  </p>
                  {(img.rating || 0) > 0 && (
                    <p className="text-accent">{"★".repeat(img.rating || 0)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
