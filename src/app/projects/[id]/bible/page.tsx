"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface Project {
  _id: string;
  name: string;
  description: string;
  type: string;
  cover_image: string;
  character_ids: string[];
  created_at?: string;
  updated_at?: string;
}

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile?: any;
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
  co_character_names?: string[];
  created_at: string;
}

interface Relationship {
  _id: string;
  from_character_id: string;
  to_character_id: string;
  type: string;
}

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

const STANDARD_TRAITS = ["hair", "skin", "accessories", "clothing_base", "expression_default"];

export default function ProjectBiblePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [imagesByChar, setImagesByChar] = useState<Record<string, CharacterImage[]>>({});
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const projectRes = await fetch(`/api/projects/${id}`);
        if (!projectRes.ok) throw new Error("Could not load project");
        const p: Project = await projectRes.json();
        if (cancelled) return;
        setProject(p);

        // Load each character + its images, and all relationships once.
        const charPromises = (p.character_ids || []).map((cid) =>
          fetch(`/api/characters/${cid}`).then((r) => (r.ok ? r.json() : null)),
        );
        const imagePromises = (p.character_ids || []).map((cid) =>
          fetch(`/api/images?characterId=${cid}`).then((r) => (r.ok ? r.json() : [])),
        );
        const [chars, imgsLists, relsRes] = await Promise.all([
          Promise.all(charPromises),
          Promise.all(imagePromises),
          fetch("/api/relationships").then((r) => (r.ok ? r.json() : [])),
        ]);
        if (cancelled) return;
        const filteredChars = chars.filter((c): c is Character => Boolean(c));
        setCharacters(filteredChars);

        const map: Record<string, CharacterImage[]> = {};
        (p.character_ids || []).forEach((cid, idx) => {
          map[cid] = Array.isArray(imgsLists[idx]) ? imgsLists[idx] : [];
        });
        setImagesByChar(map);

        // Filter relationships to those involving project characters.
        const charIdSet = new Set(p.character_ids || []);
        setRelationships(
          (Array.isArray(relsRes) ? relsRes : []).filter(
            (r: Relationship) =>
              charIdSet.has(r.from_character_id) && charIdSet.has(r.to_character_id),
          ),
        );
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

  const totalGenerations = useMemo(
    () => Object.values(imagesByChar).reduce((acc, list) => acc + list.length, 0),
    [imagesByChar],
  );
  const characterById = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of characters) m.set(c._id, c);
    return m;
  }, [characters]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-muted animate-pulse-glow">Composing project bible…</div>
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-danger text-sm">{error || "Project not found"}</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @page { size: A4; margin: 1.2cm; }
        @media print {
          html, body { background: #ffffff !important; color: #000000 !important; }
          .no-print { display: none !important; }
          .bible-card, .bible-section { break-inside: avoid; page-break-inside: avoid; }
          .bible-page { background: #ffffff !important; color: #000000 !important; }
          .bible-page * { color: #000000 !important; border-color: #cccccc !important; }
          .bible-accent { color: #8a6a1f !important; }
          .bible-page-break { break-before: page; page-break-before: always; }
          a { color: inherit !important; text-decoration: none !important; }
          img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div className="bible-page min-h-screen bg-bg text-text">
        {/* Toolbar */}
        <div className="no-print sticky top-0 z-10 bg-surface border-b border-border">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Project Bible · <span className="text-text">{project.name}</span>
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

        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">
          {/* Cover */}
          <header className="bible-section text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-muted/70">{project.type} bible</p>
            <h1 className="font-serif bible-accent text-accent text-4xl md:text-5xl font-semibold">
              {project.name}
            </h1>
            {project.description && (
              <p className="max-w-2xl mx-auto text-text/90 leading-relaxed">{project.description}</p>
            )}
            {project.cover_image && (
              <div className="mt-4 mx-auto max-w-2xl rounded-lg border border-border overflow-hidden">
                <img src={project.cover_image} alt={project.name} className="w-full h-auto" />
              </div>
            )}
            <p className="text-xs text-muted/70 pt-2">
              Created {formatDate(project.created_at)} · {characters.length} character
              {characters.length === 1 ? "" : "s"} · {totalGenerations} generation
              {totalGenerations === 1 ? "" : "s"}
            </p>
          </header>

          {/* Table of contents */}
          {characters.length > 0 && (
            <section className="bible-section border-y border-border py-4">
              <h2 className="font-serif text-accent text-lg font-semibold mb-2">Table of contents</h2>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm list-decimal list-inside">
                {characters.map((c) => (
                  <li key={c._id} className="text-text/90">{c.name}</li>
                ))}
                {relationships.length > 0 && <li className="text-text/90">Relationship map</li>}
              </ol>
            </section>
          )}

          {/* Per-character chapters */}
          {characters.map((char, idx) => {
            const imgs = imagesByChar[char._id] || [];
            const turnaround = imgs.find((i) => i.category === "turnaround") || null;
            const expressionSheet = imgs.find((i) => i.category === "expression_sheet") || null;
            const transformation = imgs.find((i) => i.category === "transformation") || null;
            const favorites = imgs.filter((i) => i.favorite).slice(0, 6);
            const customTraits = Object.entries(char.traits || {}).filter(
              ([k, v]) => !STANDARD_TRAITS.includes(k) && v && String(v).trim().length > 0,
            );
            const psy = char.profile?.psychology || {};
            const back = char.profile?.backstory || {};
            const voice = char.profile?.voice || {};

            // Relationships from this character's perspective.
            const charRels = relationships.filter(
              (r) => r.from_character_id === char._id || r.to_character_id === char._id,
            );

            return (
              <section
                key={char._id}
                className={`bible-section space-y-5 ${idx === 0 ? "" : "bible-page-break"}`}
              >
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {char.base_image_url && (
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg border border-border overflow-hidden shrink-0">
                      <img
                        src={char.base_image_url}
                        alt={char.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-serif bible-accent text-accent text-3xl font-semibold">
                      {char.name}
                    </h2>
                    {char.description && (
                      <p className="mt-2 text-text/90 leading-relaxed">{char.description}</p>
                    )}
                    <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {STANDARD_TRAITS.map((k) => {
                        const v = char.traits?.[k];
                        if (!v) return null;
                        return (
                          <div key={k} className="flex gap-2">
                            <dt className="text-muted shrink-0 w-28 capitalize">{k.replace(/_/g, " ")}:</dt>
                            <dd className="text-text/90">{v}</dd>
                          </div>
                        );
                      })}
                      {customTraits.map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="text-muted shrink-0 w-28 capitalize">{k.replace(/_/g, " ")}:</dt>
                          <dd className="text-text/90">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {/* Psychology */}
                {(psy.temperament || psy.motivation || psy.fear || psy.emotional_state || psy.body_language) && (
                  <div className="bible-card border border-border rounded-lg p-4 bg-surface">
                    <h3 className="text-sm bible-accent text-accent font-medium mb-2">Psychology</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {psy.temperament && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Temperament:</dt><dd>{psy.temperament === "custom" ? psy.custom_temperament : psy.temperament}</dd></div>}
                      {psy.motivation && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Motivation:</dt><dd>{psy.motivation === "custom" ? psy.custom_motivation : psy.motivation}</dd></div>}
                      {psy.fear && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Fear:</dt><dd>{psy.fear === "custom" ? psy.custom_fear : psy.fear}</dd></div>}
                      {psy.emotional_state && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Default mood:</dt><dd>{psy.emotional_state === "custom" ? psy.custom_emotional_state : psy.emotional_state}</dd></div>}
                      {typeof psy.energy === "number" && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Energy:</dt><dd>{psy.energy}/10</dd></div>}
                      {psy.body_language && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Body language:</dt><dd>{psy.body_language}</dd></div>}
                    </dl>
                  </div>
                )}

                {/* Story / Backstory + arc */}
                {(back.origin || back.formative_experience || back.profession || back.physical_training || back.arc_type) && (
                  <div className="bible-card border border-border rounded-lg p-4 bg-surface">
                    <h3 className="text-sm bible-accent text-accent font-medium mb-2">Backstory &amp; arc</h3>
                    <div className="space-y-1.5 text-sm">
                      {back.origin && <p><span className="text-muted">Origin:</span> {back.origin}</p>}
                      {back.formative_experience && <p><span className="text-muted">Formative experience:</span> {back.formative_experience}</p>}
                      {back.profession && <p><span className="text-muted">Profession:</span> {back.profession === "custom" ? back.custom_profession : back.profession}</p>}
                      {back.physical_training && <p><span className="text-muted">Training:</span> {back.physical_training}</p>}
                      {back.key_relationships && (
                        <pre className="whitespace-pre-wrap text-xs font-mono text-text/80 mt-2">{back.key_relationships}</pre>
                      )}
                      {back.arc_type && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <p><span className="text-muted">Arc type:</span> {back.arc_type}</p>
                          {back.arc_state_start && <p><span className="text-muted">Start:</span> {back.arc_state_start}</p>}
                          {back.arc_state_end && <p><span className="text-muted">End:</span> {back.arc_state_end}</p>}
                          {back.arc_turning_point && <p><span className="text-muted">Turning point:</span> {back.arc_turning_point}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Voice */}
                {(voice.speech_pattern || voice.verbal_tics || voice.characteristic_phrase) && (
                  <div className="bible-card border border-border rounded-lg p-4 bg-surface">
                    <h3 className="text-sm bible-accent text-accent font-medium mb-2">Voice</h3>
                    <div className="space-y-1.5 text-sm">
                      {voice.speech_pattern && <p><span className="text-muted">Speech pattern:</span> {voice.speech_pattern}</p>}
                      {voice.verbal_tics && <p><span className="text-muted">Verbal tics:</span> {voice.verbal_tics}</p>}
                      {voice.sample_happy && <p><span className="text-muted">When happy:</span> &ldquo;{voice.sample_happy}&rdquo;</p>}
                      {voice.sample_angry && <p><span className="text-muted">When angry:</span> &ldquo;{voice.sample_angry}&rdquo;</p>}
                      {voice.characteristic_phrase && <p><span className="text-muted">Catchphrase:</span> &ldquo;{voice.characteristic_phrase}&rdquo;</p>}
                    </div>
                  </div>
                )}

                {/* Turnaround */}
                {turnaround && (
                  <div className="bible-card border border-border rounded-lg overflow-hidden bg-surface">
                    <div className="px-4 py-2 text-xs bible-accent text-accent border-b border-border">
                      Turnaround sheet
                    </div>
                    <img src={turnaround.image_url} alt="Turnaround" className="w-full h-auto" />
                  </div>
                )}

                {/* Expression sheet */}
                {expressionSheet && (
                  <div className="bible-card border border-border rounded-lg overflow-hidden bg-surface">
                    <div className="px-4 py-2 text-xs bible-accent text-accent border-b border-border">
                      Expression sheet
                    </div>
                    <img src={expressionSheet.image_url} alt="Expressions" className="w-full h-auto" />
                  </div>
                )}

                {/* Transformation */}
                {transformation && (
                  <div className="bible-card border border-border rounded-lg overflow-hidden bg-surface">
                    <div className="px-4 py-2 text-xs bible-accent text-accent border-b border-border">
                      Transformation
                    </div>
                    <img src={transformation.image_url} alt="Transformation" className="w-full h-auto" />
                  </div>
                )}

                {/* Favorite gallery */}
                {favorites.length > 0 && (
                  <div>
                    <h3 className="text-sm bible-accent text-accent font-medium mb-2">Favorite generations</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {favorites.map((img) => (
                        <article
                          key={img._id}
                          className="bible-card border border-border rounded-lg overflow-hidden bg-surface"
                        >
                          <div className="aspect-square bg-bg">
                            <img
                              src={img.image_url}
                              alt={img.subcategory}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 text-[11px] text-muted">
                            <p className="text-text capitalize truncate">
                              {img.subcategory.replace(/_/g, " ")}
                            </p>
                            <p>
                              {(img.category || "").replace(/_/g, " ")}
                              {typeof img.target_age === "number" && img.target_age > 0
                                ? ` · age ${img.target_age}`
                                : ""}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relationships from this character's perspective */}
                {charRels.length > 0 && (
                  <div className="bible-card border border-border rounded-lg p-4 bg-surface">
                    <h3 className="text-sm bible-accent text-accent font-medium mb-2">
                      Relationships
                    </h3>
                    <ul className="text-sm space-y-1">
                      {charRels.map((r) => {
                        const isFrom = r.from_character_id === char._id;
                        const otherId = isFrom ? r.to_character_id : r.from_character_id;
                        const other = characterById.get(otherId);
                        return (
                          <li key={r._id}>
                            <span className="bible-accent text-accent">{r.type}</span>{" "}
                            <span className="text-muted">{isFrom ? "of" : "←"}</span>{" "}
                            <span className="text-text">{other?.name || "—"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}

          {/* Project-level relationship summary */}
          {relationships.length > 0 && (
            <section className="bible-section bible-page-break">
              <h2 className="font-serif bible-accent text-accent text-2xl font-semibold mb-3">
                Relationship map
              </h2>
              <ul className="text-sm space-y-1.5">
                {relationships.map((r) => {
                  const a = characterById.get(r.from_character_id);
                  const b = characterById.get(r.to_character_id);
                  return (
                    <li key={r._id} className="text-text/90">
                      <span className="text-text font-medium">{a?.name || "?"}</span>{" "}
                      <span className="bible-accent text-accent">→ {r.type}</span>{" "}
                      <span className="text-muted">of</span>{" "}
                      <span className="text-text font-medium">{b?.name || "?"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <p className="no-print text-center text-xs text-muted/60 pt-2">
            Tip: use your browser&apos;s Print dialog and choose “Save as PDF”.
          </p>
        </div>
      </div>
    </>
  );
}
