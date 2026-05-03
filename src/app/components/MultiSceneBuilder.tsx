"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SCENE_FORMATS,
  SCENE_DYNAMICS,
  SCENE_SETTINGS,
  type ModeId,
} from "@/lib/scenes";
import {
  AGE_PRESETS,
  CLOTHING_STYLES,
  CLOTHING_DESCRIPTIONS,
} from "@/lib/prompts";
import { compressImage } from "@/lib/imageUtils";

interface CharacterStat {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  last_image_url: string | null;
}

interface MultiScene {
  _id: string;
  mode: ModeId;
  character_ids: string[];
  character_names: string[];
  image_url: string;
  prompt_used?: string;
  params?: {
    format?: string;
    attitude?: string;
    setting?: string;
  };
  created_at: string;
}

interface SlotConfig {
  characterId: string | null;
  ageId: string; // "default" | preset id | "custom"
  customAge: string;
  clothingId: string; // "default" | preset id | "custom"
  customClothing: string;
}

interface Props {
  mode: ModeId;
  /** Minimum number of characters allowed in the scene. */
  min: number;
  /** Maximum number of characters allowed (cap is 6 globally). */
  max: number;
  title: string;
  blurb: string;
}

function newSlot(): SlotConfig {
  return {
    characterId: null,
    ageId: "default",
    customAge: "",
    clothingId: "default",
    customClothing: "",
  };
}

function resolveAge(slot: SlotConfig): number | null {
  if (slot.ageId === "default") return null;
  if (slot.ageId === "custom") {
    const n = Number(slot.customAge);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const preset = AGE_PRESETS.find((p) => p.id === slot.ageId);
  return preset?.value ?? null;
}

function resolveClothing(slot: SlotConfig): {
  description: string | null;
  styleId: string | null;
} {
  if (slot.clothingId === "default") return { description: null, styleId: null };
  if (slot.clothingId === "custom") {
    return {
      description: slot.customClothing.trim() || null,
      styleId: "custom",
    };
  }
  return {
    description: CLOTHING_DESCRIPTIONS[slot.clothingId] || null,
    styleId: slot.clothingId,
  };
}

export default function MultiSceneBuilder({ mode, min, max, title, blurb }: Props) {
  const cap = Math.min(max, 6);
  const floor = Math.max(min, 2);

  const [characters, setCharacters] = useState<CharacterStat[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);

  const [slots, setSlots] = useState<SlotConfig[]>(() =>
    Array.from({ length: floor }, () => newSlot()),
  );

  // Filter formats & dynamics by mode.
  const formatsForMode = useMemo(
    () => SCENE_FORMATS.filter((f) => f.modes.includes(mode)),
    [mode],
  );
  const dynamicsForMode = useMemo(
    () => SCENE_DYNAMICS.filter((d) => d.modes.includes(mode)),
    [mode],
  );

  const [format, setFormat] = useState<string>(
    formatsForMode[0]?.id || "",
  );
  const [attitude, setAttitude] = useState<string>(
    dynamicsForMode[0]?.id || "neutral",
  );
  const [setting, setSetting] = useState<string>("studio");
  const [customSetting, setCustomSetting] = useState<string>("");

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    image_url: string;
    prompt_used: string;
    model_used: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<MultiScene[]>([]);

  // Load characters and recent scenes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch("/api/characters/stats"),
          fetch(`/api/multi-scenes?mode=${mode}`),
        ]);
        if (!cRes.ok) throw new Error("Could not load characters");
        const c = await cRes.json();
        const s = sRes.ok ? await sRes.json() : [];
        if (cancelled) return;
        setCharacters(Array.isArray(c) ? c : []);
        setRecent(Array.isArray(s) ? s : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoadingCharacters(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const addSlot = () => {
    if (slots.length >= cap) return;
    setSlots((prev) => [...prev, newSlot()]);
  };
  const removeSlot = (idx: number) => {
    if (slots.length <= floor) return;
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateSlot = (idx: number, patch: Partial<SlotConfig>) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const swapSlots = (a: number, b: number) => {
    if (a < 0 || b < 0 || a >= slots.length || b >= slots.length) return;
    setSlots((prev) => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };
  const clearSlot = (idx: number) => {
    updateSlot(idx, { characterId: null });
  };

  const charById = useMemo(() => {
    const m = new Map<string, CharacterStat>();
    for (const c of characters) m.set(c._id, c);
    return m;
  }, [characters]);

  // Set of character ids already in slots — used to disable duplicates in pickers.
  const usedIds = useMemo(
    () => new Set(slots.map((s) => s.characterId).filter((x): x is string => Boolean(x))),
    [slots],
  );

  const allSlotsFilled = slots.every((s) => s.characterId);
  const canGenerate = allSlotsFilled && slots.length >= floor && format && attitude && setting;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerated(null);
    setError(null);
    try {
      const payloadCharacters = slots.map((s) => {
        const c = charById.get(s.characterId!)!;
        const age = resolveAge(s);
        const { description: clothing } = resolveClothing(s);
        return {
          name: c.name,
          description: c.description,
          age,
          clothing,
          reference_image_url: c.base_image_url || c.last_image_url || undefined,
        };
      });

      const res = await fetch("/api/generate/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          characters: payloadCharacters,
          format,
          attitude,
          setting,
          customSetting,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }
      setGenerated({
        image_url: data.image_url,
        prompt_used: data.prompt_used,
        model_used: data.model_used,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    setSaving(true);
    setError(null);
    try {
      const compressed = await compressImage(generated.image_url);
      const params = {
        format,
        attitude,
        setting,
        customSetting: setting === "custom" ? customSetting : undefined,
        per_character: slots.map((s) => {
          const { description, styleId } = resolveClothing(s);
          return {
            character_id: s.characterId!,
            age: resolveAge(s),
            clothing_style: styleId,
            clothing_description: description,
          };
        }),
      };
      const res = await fetch("/api/multi-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          image_url: compressed,
          prompt_used: generated.prompt_used,
          model_used: generated.model_used,
          character_ids: slots.map((s) => s.characterId!),
          params,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setRecent((prev) => [data, ...prev]);
      setGenerated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScene = async (id: string) => {
    if (!confirm("Delete this scene? It will also be removed from each character's gallery.")) return;
    try {
      const res = await fetch(`/api/multi-scenes/${id}`, { method: "DELETE" });
      if (res.ok) setRecent((prev) => prev.filter((s) => s._id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Toolbar */}
      <header className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="text-muted hover:text-text transition-colors text-sm shrink-0"
          >
            ← Workspace
          </Link>
          <h1 className="font-serif text-accent text-lg md:text-xl font-semibold tracking-wide">
            {title}
          </h1>
          <span className="hidden md:inline text-xs text-muted truncate">{blurb}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {loadingCharacters ? (
          <div className="py-16 text-center text-muted animate-pulse-glow">
            Loading characters…
          </div>
        ) : characters.length < floor ? (
          <div className="py-16 text-center text-muted text-sm">
            Need at least {floor} characters in your library to use this view.
          </div>
        ) : (
          <>
            {/* Slot picker — one row per slot */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-serif text-accent text-lg font-semibold">
                  Cast ({slots.length}/{cap})
                </h2>
                <div className="flex items-center gap-2">
                  {cap > floor && slots.length < cap && (
                    <button
                      onClick={addSlot}
                      className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-xs hover:bg-accent/10 transition-colors"
                    >
                      + Add character
                    </button>
                  )}
                  {slots.length >= 4 && (
                    <span className="text-[11px] text-muted/70 italic">
                      Identity preservation may decrease beyond 4 characters.
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {slots.map((slot, idx) => {
                  const picked = slot.characterId ? charById.get(slot.characterId) : null;
                  return (
                    <div
                      key={idx}
                      className="border border-border bg-surface rounded-lg p-3 md:p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted uppercase tracking-wide shrink-0">
                          Slot {idx + 1}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => swapSlots(idx, idx - 1)}
                            disabled={idx === 0}
                            className="px-2 py-0.5 rounded border border-border text-xs text-muted disabled:opacity-30 hover:text-text hover:border-border-strong transition-colors"
                            title="Move left"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => swapSlots(idx, idx + 1)}
                            disabled={idx === slots.length - 1}
                            className="px-2 py-0.5 rounded border border-border text-xs text-muted disabled:opacity-30 hover:text-text hover:border-border-strong transition-colors"
                            title="Move right"
                          >
                            →
                          </button>
                          {slots.length > floor && (
                            <button
                              onClick={() => removeSlot(idx)}
                              className="px-2 py-0.5 rounded border border-border text-xs text-muted hover:text-danger hover:border-danger/40 transition-colors"
                              title="Remove slot"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-3">
                        {/* Character preview / picker */}
                        <div className="flex items-center gap-3 md:w-1/3">
                          <div className="w-20 h-20 rounded-lg border border-border bg-bg overflow-hidden shrink-0">
                            {picked && (picked.last_image_url || picked.base_image_url) ? (
                              <img
                                src={picked.last_image_url || picked.base_image_url}
                                alt={picked.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted/40 font-serif text-2xl">
                                {picked?.name?.charAt(0).toUpperCase() || "?"}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <select
                              value={slot.characterId || ""}
                              onChange={(e) =>
                                updateSlot(idx, { characterId: e.target.value || null })
                              }
                              className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                            >
                              <option value="">Pick a character…</option>
                              {characters.map((c) => {
                                const taken =
                                  usedIds.has(c._id) && c._id !== slot.characterId;
                                return (
                                  <option key={c._id} value={c._id} disabled={taken}>
                                    {c.name}
                                    {taken ? " (already in scene)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            {picked && (
                              <button
                                onClick={() => clearSlot(idx)}
                                className="mt-1 text-[11px] text-muted hover:text-text transition-colors"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Per-character age + clothing */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-muted mb-1">Age</label>
                            <select
                              value={slot.ageId}
                              onChange={(e) => updateSlot(idx, { ageId: e.target.value })}
                              className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                            >
                              {AGE_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                            {slot.ageId === "custom" && (
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={slot.customAge}
                                onChange={(e) =>
                                  updateSlot(idx, { customAge: e.target.value })
                                }
                                placeholder="e.g. 42"
                                className="mt-1 w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] text-muted mb-1">Clothing</label>
                            <select
                              value={slot.clothingId}
                              onChange={(e) =>
                                updateSlot(idx, { clothingId: e.target.value })
                              }
                              className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                            >
                              {CLOTHING_STYLES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            {slot.clothingId === "custom" && (
                              <input
                                type="text"
                                value={slot.customClothing}
                                onChange={(e) =>
                                  updateSlot(idx, { customClothing: e.target.value })
                                }
                                placeholder="Describe clothing…"
                                className="mt-1 w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Scene controls */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">
                  Format / Composition
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {formatsForMode.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">
                  Relationship / Dynamic
                </label>
                <select
                  value={attitude}
                  onChange={(e) => setAttitude(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {dynamicsForMode.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 uppercase tracking-wide">
                  Setting
                </label>
                <select
                  value={setting}
                  onChange={(e) => setSetting(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
                >
                  {SCENE_SETTINGS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {setting === "custom" && (
                  <input
                    type="text"
                    value={customSetting}
                    onChange={(e) => setCustomSetting(e.target.value)}
                    placeholder="Describe the setting…"
                    className="mt-2 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                  />
                )}
              </div>
            </section>

            {/* Generate */}
            <section className="space-y-4">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
                className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? "Generating…" : `Generate ${mode === "duo" ? "Duo" : "Group"} Scene`}
              </button>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              {generated && (
                <div className="border border-border rounded-lg p-3 bg-surface">
                  <div className="aspect-video md:aspect-auto md:max-h-[60vh] bg-bg rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={generated.image_url}
                      alt="Generated scene"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-medium hover:bg-success/25 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save to library"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating || saving}
                      className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
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

            {/* Recent scenes */}
            {recent.length > 0 && (
              <section className="space-y-3 pt-4">
                <h2 className="font-serif text-accent text-lg font-semibold">
                  Recent {mode === "duo" ? "duo" : "group"} scenes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {recent.map((s) => (
                    <article
                      key={s._id}
                      className="border border-border rounded-lg overflow-hidden bg-surface"
                    >
                      <div className="aspect-video bg-bg overflow-hidden">
                        <img
                          src={s.image_url}
                          alt={`Scene with ${s.character_names.join(", ")}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2.5 text-xs">
                        <p className="text-text font-medium truncate">
                          {s.character_names.join(" · ")}
                        </p>
                        <p className="text-muted mt-0.5 capitalize">
                          {(s.params?.format || "").replace(/_/g, " ")}
                          {s.params?.attitude ? ` · ${s.params.attitude.replace(/_/g, " ")}` : ""}
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
