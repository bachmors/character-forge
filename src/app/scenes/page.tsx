"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CinematographyControls, {
  DEFAULT_CINEMATOGRAPHY_STATE,
  type CinematographyState,
} from "../components/CinematographyControls";
import { compressImage } from "@/lib/imageUtils";

interface CharacterStat {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  last_image_url: string | null;
  // We don't fetch the full profile via /stats; that's okay — psychology
  // injection happens server-side only when characters[].profile is provided
  // by callers that have the full character (omitted here for brevity).
}

interface SceneRecord {
  _id: string;
  image_url: string;
  character_ids: string[];
  prompt_used?: string;
  params: {
    action: string;
    customAction?: string;
    environment: string;
    customEnvironment?: string;
    narrative?: string;
    aspectRatio: string;
  };
  storyboard_id?: string | null;
  order_in_storyboard?: number | null;
  created_at: string;
}

const ACTIONS = [
  "Standing / Waiting",
  "Walking / Running",
  "Sitting / Resting",
  "Fighting / Struggling",
  "Embracing / Touching",
  "Looking at something",
  "Turning away / Leaving",
  "Arriving / Entering",
  "Falling / Collapsing",
  "Celebrating / Dancing",
  "Working / Creating",
  "Hiding / Watching",
];

const ENVIRONMENTS = [
  "Empty room",
  "Crowded street",
  "Rooftop at night",
  "Forest path",
  "Hospital corridor",
  "Prison cell",
  "Beach at dawn",
  "Burning building",
  "Library / Study",
  "Train station",
  "Underwater",
  "Desert",
];

const ASPECT_RATIOS = [
  { id: "cinematic", label: "Cinematic 2.39:1" },
  { id: "film", label: "Film 16:9" },
  { id: "classic", label: "Classic 4:3" },
  { id: "square", label: "Square 1:1" },
  { id: "vertical", label: "Vertical 9:16" },
];

export default function ScenesPage() {
  const [characters, setCharacters] = useState<CharacterStat[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);

  // Up to 4 character ids, in order.
  const [castIds, setCastIds] = useState<string[]>([]);
  const [action, setAction] = useState<string>(ACTIONS[0]);
  const [customAction, setCustomAction] = useState("");
  const [environment, setEnvironment] = useState<string>(ENVIRONMENTS[0]);
  const [customEnvironment, setCustomEnvironment] = useState("");
  const [narrative, setNarrative] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("film");
  const [cine, setCine] = useState<CinematographyState>(DEFAULT_CINEMATOGRAPHY_STATE);

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    image_url: string;
    prompt_used: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Storyboard mode
  const [storyboardId, setStoryboardId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneRecord[]>([]);

  const charById = useMemo(() => {
    const m = new Map<string, CharacterStat>();
    for (const c of characters) m.set(c._id, c);
    return m;
  }, [characters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch("/api/characters/stats"),
          fetch("/api/scenes"),
        ]);
        if (!cRes.ok) throw new Error("Could not load characters");
        const c = await cRes.json();
        const s = sRes.ok ? await sRes.json() : [];
        if (cancelled) return;
        setCharacters(Array.isArray(c) ? c : []);
        setScenes(Array.isArray(s) ? s : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoadingCharacters(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCast = (id: string) => {
    setCastIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const moveCast = (id: string, dir: -1 | 1) => {
    setCastIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const canGenerate =
    castIds.length >= 1 &&
    castIds.length <= 4 &&
    Boolean(action) &&
    (action !== "custom" || customAction.trim()) &&
    Boolean(environment) &&
    (environment !== "custom" || customEnvironment.trim());

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const cast = castIds
        .map((id) => charById.get(id))
        .filter((c): c is CharacterStat => Boolean(c));
      const res = await fetch("/api/generate/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characters: cast.map((c) => ({
            name: c.name,
            description: c.description,
            reference_image_url: c.base_image_url || c.last_image_url || undefined,
          })),
          action,
          customAction: action === "custom" ? customAction : undefined,
          environment,
          customEnvironment: environment === "custom" ? customEnvironment : undefined,
          narrative,
          aspectRatio,
          cinematography: {
            cameraAngle: cine.cameraAngle,
            lens: cine.lens,
            lighting: cine.lighting,
          },
          artStyle: cine.artStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setGenerated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      const compressed = await compressImage(generated.image_url);
      const order =
        storyboardId !== null
          ? scenes.filter((s) => s.storyboard_id === storyboardId).length
          : null;
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: compressed,
          prompt_used: generated.prompt_used,
          character_ids: castIds,
          params: {
            action,
            customAction: action === "custom" ? customAction : undefined,
            environment,
            customEnvironment: environment === "custom" ? customEnvironment : undefined,
            narrative,
            aspectRatio,
            cinematography: {
              cameraAngle: cine.cameraAngle,
              lens: cine.lens,
              lighting: cine.lighting,
            },
            artStyle: cine.artStyle,
          },
          storyboard_id: storyboardId,
          order_in_storyboard: order,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setScenes((prev) => [data, ...prev]);
      setGenerated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScene = async (id: string) => {
    if (!confirm("Delete this scene?")) return;
    try {
      const res = await fetch(`/api/scenes/${id}`, { method: "DELETE" });
      if (res.ok) setScenes((prev) => prev.filter((s) => s._id !== id));
    } catch {
      // ignore
    }
  };

  const startNewStoryboard = () => {
    const id = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setStoryboardId(id);
  };

  // Group saved scenes by storyboard_id for the filmstrip view.
  const storyboards = useMemo(() => {
    const groups = new Map<string, SceneRecord[]>();
    for (const s of scenes) {
      const k = s.storyboard_id || "__none__";
      const arr = groups.get(k) || [];
      arr.push(s);
      groups.set(k, arr);
    }
    Array.from(groups.values()).forEach((arr) => {
      arr.sort((a, b) => (a.order_in_storyboard ?? 0) - (b.order_in_storyboard ?? 0));
    });
    return groups;
  }, [scenes]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link href="/" className="text-muted hover:text-text transition-colors text-sm shrink-0">
            ← Workspace
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide">
            Scenes &amp; Storyboard
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {loadingCharacters ? (
          <div className="py-16 text-center text-muted animate-pulse-glow">
            Loading characters…
          </div>
        ) : characters.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            Create at least one character to use the scene generator.
          </div>
        ) : (
          <>
            {/* Cast picker */}
            <section className="space-y-3">
              <h2 className="font-serif text-accent text-lg font-semibold">
                Cast ({castIds.length}/4)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {characters.map((c) => {
                  const idx = castIds.indexOf(c._id);
                  const picked = idx !== -1;
                  const full = !picked && castIds.length >= 4;
                  return (
                    <button
                      key={c._id}
                      onClick={() => toggleCast(c._id)}
                      disabled={full}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        picked
                          ? "border-accent ring-1 ring-accent/40 bg-accent/5"
                          : "border-border hover:border-accent/40 bg-surface"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-bg border border-border overflow-hidden shrink-0">
                        {c.base_image_url || c.last_image_url ? (
                          <img
                            src={c.base_image_url || c.last_image_url || ""}
                            alt={c.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted/40 font-serif text-base">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text truncate">{c.name}</p>
                        {picked && (
                          <p className="text-[10px] text-accent">Position #{idx + 1}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {castIds.length > 1 && (
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted">
                  <span>Order:</span>
                  {castIds.map((id, i) => {
                    const c = charById.get(id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-surface"
                      >
                        {i + 1}. {c?.name || "?"}
                        <button
                          onClick={() => moveCast(id, -1)}
                          className="text-muted hover:text-text"
                          disabled={i === 0}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveCast(id, 1)}
                          className="text-muted hover:text-text"
                          disabled={i === castIds.length - 1}
                        >
                          →
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Scene controls */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {action === "custom" && (
                  <input
                    type="text"
                    value={customAction}
                    onChange={(e) => setCustomAction(e.target.value)}
                    placeholder="What are they doing?"
                    className="mt-2 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">Environment</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {ENVIRONMENTS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {environment === "custom" && (
                  <input
                    type="text"
                    value={customEnvironment}
                    onChange={(e) => setCustomEnvironment(e.target.value)}
                    placeholder="Where are they?"
                    className="mt-2 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">Narrative moment</label>
                <textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  rows={2}
                  placeholder="What just happened or is about to happen? e.g. &quot;She just learned her father died&quot;"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">Aspect ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {ASPECT_RATIOS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section>
              <CinematographyControls value={cine} onChange={setCine} />
            </section>

            {/* Storyboard toggle */}
            <section className="flex items-center gap-3 flex-wrap text-xs">
              {storyboardId ? (
                <>
                  <span className="text-accent">Storyboard mode active</span>
                  <span className="text-muted">{storyboardId}</span>
                  <button
                    onClick={() => setStoryboardId(null)}
                    className="px-2 py-0.5 rounded border border-border text-muted hover:text-text hover:border-border-strong"
                  >
                    Stop sequence
                  </button>
                </>
              ) : (
                <button
                  onClick={startNewStoryboard}
                  className="px-3 py-1 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                >
                  + Start a storyboard sequence
                </button>
              )}
            </section>

            <section className="space-y-4">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
                className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? "Generating…" : "Generate scene"}
              </button>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              {generated && (
                <div className="border border-border rounded-lg p-3 bg-surface">
                  <div className="bg-bg rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={generated.image_url}
                      alt="Generated scene"
                      className="max-h-[70vh] w-auto object-contain"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-medium hover:bg-success/25 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving…" : storyboardId ? "Save to storyboard" : "Save scene"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating || saving}
                      className="px-4 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => setGenerated(null)}
                      className="px-3 py-2 rounded-lg text-muted hover:text-text text-xs"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Storyboards / scene library */}
            {Array.from(storyboards.entries()).map(([id, list]) => {
              const isStoryboard = id !== "__none__";
              return (
                <section key={id} className="space-y-2 pt-4">
                  <h3 className="font-serif text-accent text-base font-semibold">
                    {isStoryboard ? `Storyboard ${id}` : "Standalone scenes"}
                    <span className="ml-2 text-xs text-muted">{list.length} scene{list.length === 1 ? "" : "s"}</span>
                  </h3>
                  <div
                    className={
                      isStoryboard
                        ? "flex gap-3 overflow-x-auto pb-2"
                        : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                    }
                  >
                    {list.map((s, idx) => (
                      <article
                        key={s._id}
                        className={`border border-border rounded-lg overflow-hidden bg-surface ${
                          isStoryboard ? "shrink-0 w-72" : ""
                        }`}
                      >
                        <div className="aspect-video bg-bg overflow-hidden">
                          <img
                            src={s.image_url}
                            alt={s.params.action}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2.5 text-xs">
                          <p className="text-text font-medium truncate">
                            {isStoryboard ? `${idx + 1}. ` : ""}
                            {s.params.action === "custom" ? s.params.customAction : s.params.action}
                          </p>
                          <p className="text-muted truncate">
                            {s.params.environment === "custom"
                              ? s.params.customEnvironment
                              : s.params.environment}
                          </p>
                          <button
                            onClick={() => handleDeleteScene(s._id)}
                            className="mt-1 text-[11px] text-muted hover:text-danger transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
