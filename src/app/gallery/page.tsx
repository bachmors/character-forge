"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface CharacterStat {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  created_at?: string;
  updated_at?: string;
  image_count: number;
  last_image_url: string | null;
  last_image_date: string | null;
  ages: number[];
  categories: string[];
}

type SortKey = "name" | "created" | "generations";

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function ageRange(ages: number[]): string | null {
  if (!ages.length) return null;
  const min = ages[0];
  const max = ages[ages.length - 1];
  return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
}

export default function GalleryPage() {
  const [stats, setStats] = useState<CharacterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [filterAges, setFilterAges] = useState(false);
  const [filterStyles, setFilterStyles] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/characters/stats");
        if (!res.ok) throw new Error("Could not load gallery");
        const data = await res.json();
        if (!cancelled) setStats(Array.isArray(data) ? data : []);
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

  const visible = useMemo(() => {
    let list = stats;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q),
      );
    }
    if (filterAges) {
      list = list.filter((s) => s.ages.length > 0);
    }
    // "Multiple styles" is currently approximated as "images in more than one
    // pose category" (head_rotation, expression, body, custom). Once we start
    // persisting clothing_style on each image, switch this to filter on that.
    if (filterStyles) {
      list = list.filter((s) => s.categories.length > 1);
    }

    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "generations") {
      sorted.sort((a, b) => b.image_count - a.image_count);
    } else {
      // "created" — most recent first
      sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    }
    return sorted;
  }, [stats, search, filterAges, filterStyles, sortBy]);

  const totalCount = stats.length;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Toolbar */}
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="text-muted hover:text-text transition-colors text-sm shrink-0"
            title="Back to workspace"
          >
            ← Workspace
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide">
            Gallery
          </h1>
          <span className="text-xs text-muted">
            {totalCount === 0 ? "" : `${visible.length}/${totalCount}`}
          </span>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6 pb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters..."
            className="flex-1 min-w-[200px] bg-surface border border-border rounded px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-border-strong transition-colors"
          />

          <div className="flex items-center gap-1 text-xs text-muted">
            <span className="hidden sm:inline">Sort:</span>
            {(
              [
                { id: "created", label: "Date created" },
                { id: "name", label: "Name" },
                { id: "generations", label: "Most generations" },
              ] as { id: SortKey; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`px-2.5 py-1 rounded text-xs transition-colors border ${
                  sortBy === opt.id
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "border-border text-muted hover:text-text hover:border-border-strong"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Filter:</span>
          <button
            onClick={() => setFilterAges((v) => !v)}
            className={`px-2.5 py-1 rounded transition-colors border ${
              filterAges
                ? "bg-accent/15 text-accent border-accent/30"
                : "border-border text-muted hover:text-text hover:border-border-strong"
            }`}
          >
            Has age variations
          </button>
          <button
            onClick={() => setFilterStyles((v) => !v)}
            className={`px-2.5 py-1 rounded transition-colors border ${
              filterStyles
                ? "bg-accent/15 text-accent border-accent/30"
                : "border-border text-muted hover:text-text hover:border-border-strong"
            }`}
            title="Currently approximated as images across multiple pose categories"
          >
            Has multiple styles
          </button>
          {(filterAges || filterStyles || search.trim()) && (
            <button
              onClick={() => {
                setFilterAges(false);
                setFilterStyles(false);
                setSearch("");
              }}
              className="px-2.5 py-1 rounded border border-transparent text-muted/70 hover:text-text"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 pb-12">
        {loading ? (
          <div className="py-24 text-center text-muted animate-pulse-glow">Loading gallery…</div>
        ) : error ? (
          <div className="py-24 text-center text-danger text-sm">{error}</div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center text-muted text-sm">
            {totalCount === 0
              ? "No characters yet. Create one from the workspace to see it here."
              : "No characters match the current filters."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((c) => {
              const thumb = c.last_image_url || c.base_image_url || null;
              const range = ageRange(c.ages);
              return (
                <Link
                  key={c._id}
                  href={`/?characterId=${c._id}`}
                  className="group relative rounded-lg border border-border bg-surface overflow-hidden hover:border-accent/40 transition-all"
                >
                  <div className="aspect-square bg-bg overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={c.name}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted/40 font-serif text-4xl">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-text truncate group-hover:text-accent transition-colors">
                        {c.name}
                      </h3>
                      <span className="text-xs text-muted shrink-0">
                        {c.image_count} {c.image_count === 1 ? "image" : "images"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span className="truncate">
                        {range ? <span className="text-accent/80">{range}</span> : "No age variations"}
                      </span>
                      <span className="shrink-0">{formatDate(c.last_image_date)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
