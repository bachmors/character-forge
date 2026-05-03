"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
  created_at?: string;
}

interface CharacterImage {
  _id: string;
  character_id: string;
  category: string;
  subcategory: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  selected: boolean;
  favorite?: boolean;
  target_age?: number | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  head_rotation: "Head Rotations",
  expression: "Expressions",
  body: "Body Poses",
  custom: "Custom Scenes",
};

function formatDate(d?: string): string {
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

export default function CharacterSheetExportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [character, setCharacter] = useState<Character | null>(null);
  const [images, setImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [cRes, iRes] = await Promise.all([
          fetch(`/api/characters/${id}`),
          fetch(`/api/images?characterId=${id}`),
        ]);
        if (!cRes.ok) throw new Error("Could not load character");
        if (!iRes.ok) throw new Error("Could not load images");
        const c = await cRes.json();
        const i = await iRes.json();
        if (cancelled) return;
        setCharacter(c);
        setImages(Array.isArray(i) ? i : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Group images by category, sorted by created_at desc inside each group.
  const groupedImages = useMemo(() => {
    const order: string[] = ["head_rotation", "expression", "body", "custom"];
    const groups: Record<string, CharacterImage[]> = {};
    for (const img of images) {
      const key = img.category || "custom";
      (groups[key] ||= []).push(img);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    }
    // Return in canonical order, then any unknown keys alphabetically.
    const known = order.filter((k) => groups[k]);
    const extra = Object.keys(groups)
      .filter((k) => !order.includes(k))
      .sort();
    return [...known, ...extra].map((k) => ({ key: k, images: groups[k] }));
  }, [images]);

  const modelsUsed = useMemo(() => {
    const set = new Set<string>();
    for (const img of images) if (img.model_used) set.add(img.model_used);
    return Array.from(set);
  }, [images]);

  const standardTraitKeys = ["hair", "skin", "accessories", "clothing_base", "expression_default"];
  const customTraitEntries = useMemo(() => {
    if (!character?.traits) return [];
    return Object.entries(character.traits).filter(
      ([k, v]) => !standardTraitKeys.includes(k) && v && String(v).trim().length > 0,
    );
  }, [character]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-muted animate-pulse-glow">Loading character sheet…</div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-danger text-sm">{error || "Character not found"}</div>
      </div>
    );
  }

  return (
    <>
      {/* Print-only style overrides — keep separate from Tailwind to ensure
          they apply in print preview regardless of utility class order. */}
      <style>{`
        @page { size: A4; margin: 1.2cm; }
        @media print {
          html, body { background: #ffffff !important; color: #000000 !important; }
          .no-print { display: none !important; }
          .sheet-card { break-inside: avoid; page-break-inside: avoid; }
          .sheet-section { break-before: auto; }
          .sheet-page { background: #ffffff !important; color: #000000 !important; }
          .sheet-page * { color: #000000 !important; border-color: #cccccc !important; }
          .sheet-accent { color: #8a6a1f !important; }
          a { color: inherit !important; text-decoration: none !important; }
          img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div className="sheet-page min-h-screen bg-bg text-text">
        {/* Top toolbar — hidden on print */}
        <div className="no-print sticky top-0 z-10 bg-surface border-b border-border">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Character Sheet · <span className="text-text">{character.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.history.back()}
                className="px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-10 space-y-8">
          {/* Header */}
          <header className="sheet-section flex flex-col md:flex-row gap-6 items-start">
            {character.base_image_url && (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg border border-border overflow-hidden shrink-0">
                <img
                  src={character.base_image_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-wide sheet-accent text-accent">
                {character.name}
              </h1>
              {character.description && (
                <p className="mt-2 text-text/90 leading-relaxed">{character.description}</p>
              )}

              {/* Traits */}
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {standardTraitKeys.map((k) => {
                  const v = character.traits?.[k];
                  if (!v) return null;
                  return (
                    <div key={k} className="flex gap-2">
                      <dt className="text-muted shrink-0 w-28 capitalize">{k.replace(/_/g, " ")}:</dt>
                      <dd className="text-text/90">{v}</dd>
                    </div>
                  );
                })}
                {customTraitEntries.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted shrink-0 w-28 capitalize">{k.replace(/_/g, " ")}:</dt>
                    <dd className="text-text/90">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </header>

          <hr className="border-border" />

          {/* Image catalog */}
          {images.length === 0 ? (
            <section className="sheet-section text-center py-12 text-muted text-sm">
              No images generated yet.
            </section>
          ) : (
            groupedImages.map(({ key, images: imgs }) => (
              <section key={key} className="sheet-section space-y-4">
                <h2 className="font-serif text-xl font-semibold sheet-accent text-accent">
                  {CATEGORY_LABELS[key] || key.replace(/_/g, " ")} ·{" "}
                  <span className="text-muted text-base font-normal">{imgs.length}</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {imgs.map((img) => (
                    <article
                      key={img._id}
                      className="sheet-card border border-border rounded-lg overflow-hidden bg-surface"
                    >
                      <div className="aspect-square bg-bg">
                        <img
                          src={img.image_url}
                          alt={img.subcategory}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-text capitalize">
                            {img.subcategory.replace(/_/g, " ")}
                          </span>
                          {typeof img.target_age === "number" && img.target_age > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full border border-accent/40 sheet-accent text-accent text-[10px] font-semibold">
                              {img.target_age}y
                            </span>
                          )}
                        </div>
                        <div className="text-muted">
                          <span className="capitalize">{(img.category || "").replace(/_/g, " ")}</span>
                          {" · "}
                          <span>{img.model_used || "—"}</span>
                          {" · "}
                          <span>{formatDate(img.created_at)}</span>
                        </div>
                        {img.prompt_used && (
                          <p className="text-muted leading-snug whitespace-pre-wrap break-words text-[11px]">
                            {img.prompt_used}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}

          <hr className="border-border" />

          {/* Footer metadata */}
          <footer className="sheet-section text-xs text-muted grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-muted/70 uppercase tracking-wide mb-0.5">Created</div>
              <div className="text-text/90">{formatDate(character.created_at)}</div>
            </div>
            <div>
              <div className="text-muted/70 uppercase tracking-wide mb-0.5">Total generations</div>
              <div className="text-text/90">{images.length}</div>
            </div>
            <div>
              <div className="text-muted/70 uppercase tracking-wide mb-0.5">Models used</div>
              <div className="text-text/90">{modelsUsed.length > 0 ? modelsUsed.join(", ") : "—"}</div>
            </div>
          </footer>

          <p className="no-print text-center text-xs text-muted/60 pt-2">
            Tip: use your browser&apos;s Print dialog and choose “Save as PDF”.
          </p>
        </div>
      </div>
    </>
  );
}
