"use client";

import { useState, useEffect } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  implemented: boolean;
  has_key: boolean;
}

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  provider_implemented: boolean;
}

interface ModelsResponse {
  models: ModelEntry[];
  used_fallback?: boolean;
}

interface TestResult {
  ok: boolean;
  error?: string;
  pending?: boolean;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [keysDraft, setKeysDraft] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [favoriteModels, setFavoriteModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("gemini-3.1-flash-image-preview");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available">("available");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [pRes, sRes, mRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/settings"),
        fetch("/api/models"),
      ]);
      if (cancelled) return;
      if (pRes.ok) setProviders(await pRes.json());
      if (sRes.ok) {
        const s = await sRes.json();
        setDefaultModel(s.defaultModel || "gemini-3.1-flash-image-preview");
        setFavoriteModels(s.favoriteModels || []);
      }
      if (mRes.ok) {
        const data: ModelsResponse = await mRes.json();
        setModels(data.models || []);
        setUsedFallback(Boolean(data.used_fallback));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Only persist drafted (non-empty) keys; existing stored keys remain.
      const apiKeys: Record<string, string> = {};
      for (const [id, value] of Object.entries(keysDraft)) {
        if (value && !value.startsWith("••••")) apiKeys[id] = value;
      }
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeys,
          favoriteModels,
          defaultModel,
        }),
      });
      // Refresh provider statuses after the save.
      const refreshed = await fetch("/api/providers");
      if (refreshed.ok) setProviders(await refreshed.json());
      setKeysDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTests((prev) => ({ ...prev, [id]: { ok: false, pending: true } }));
    try {
      const draft = keysDraft[id];
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, apiKey: draft }),
      });
      const data: TestResult = await res.json();
      setTests((prev) => ({ ...prev, [id]: data }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [id]: { ok: false, error: err instanceof Error ? err.message : "Failed" },
      }));
    }
  };

  const toggleFavorite = (modelId: string) => {
    setFavoriteModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
    );
  };

  // Distinct providers represented in the models list (for the filter).
  const providersInModels = Array.from(new Set(models.map((m) => m.provider))).sort();
  const visibleModels = models.filter((m) => {
    if (providerFilter !== "all" && m.provider !== providerFilter) return false;
    if (availabilityFilter === "available") {
      const p = providers.find((pp) => pp.id === m.provider);
      if (!p?.has_key) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border-strong rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-accent text-xl font-semibold">Settings</h2>
            <button onClick={onClose} className="text-muted hover:text-text transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Providers / API keys */}
          <section className="space-y-4 mb-8">
            <div>
              <h3 className="text-sm text-accent font-medium">Providers</h3>
              <p className="text-xs text-muted/80 mt-0.5">
                API keys are encrypted in your session cookie. Only Google (Gemini) is fully
                wired for generation right now — others are scaffolded and ready for
                implementation.
              </p>
            </div>

            <div className="space-y-3">
              {providers.map((p) => {
                const t = tests[p.id];
                const status = t?.pending
                  ? { label: "Testing…", cls: "text-muted" }
                  : t
                    ? t.ok
                      ? { label: "✓ Connected", cls: "text-success" }
                      : { label: `✗ ${t.error || "Invalid"}`, cls: "text-danger" }
                    : p.has_key
                      ? { label: "✓ Key stored", cls: "text-success/80" }
                      : { label: "⚠ No key", cls: "text-muted" };
                const showKey = show[p.id];
                const draft = keysDraft[p.id] ?? "";

                return (
                  <div
                    key={p.id}
                    className="border border-border rounded-lg p-3 bg-bg/40 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-text font-medium">{p.name}</span>
                        {!p.implemented && (
                          <span className="text-[10px] uppercase tracking-wide text-muted/70 px-1.5 py-0.5 rounded border border-border">
                            scaffold
                          </span>
                        )}
                      </div>
                      <span className={`text-xs ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="text-[11px] text-muted/70">{p.description}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type={showKey ? "text" : "password"}
                        value={draft || (p.has_key ? "••••••••" : "")}
                        onChange={(e) =>
                          setKeysDraft((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        placeholder="API key"
                        className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-xs text-text placeholder:text-muted/50 font-mono focus:outline-none focus:border-accent/30 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className="px-2 py-1 text-[11px] text-muted hover:text-text transition-colors"
                        title={showKey ? "Hide" : "Show"}
                      >
                        {showKey ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTest(p.id)}
                        className="px-2 py-1 rounded border border-border text-[11px] text-muted hover:text-text hover:border-border-strong transition-colors"
                      >
                        Test
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Models registry */}
          <section className="space-y-3 mb-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm text-accent font-medium">Models</h3>
                <p className="text-xs text-muted/80">
                  Image-generation models from the shared registry.{" "}
                  {usedFallback && (
                    <span className="text-muted/70 italic">
                      (Using built-in fallback list — registry unreachable.)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-border-strong"
                >
                  <option value="all">All providers</option>
                  {providersInModels.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as "all" | "available")}
                  className="bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-border-strong"
                >
                  <option value="available">Available (key set)</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {visibleModels.length === 0 ? (
                <div className="col-span-full text-xs text-muted text-center py-4">
                  No models match the current filters.
                </div>
              ) : (
                visibleModels.map((m) => {
                  const isFav = favoriteModels.includes(m.id);
                  const isDefault = defaultModel === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`border rounded p-2 text-xs flex items-center gap-2 ${
                        isDefault
                          ? "border-accent/40 bg-accent/5"
                          : "border-border bg-bg/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFavorite(m.id)}
                        className={`shrink-0 ${isFav ? "text-accent" : "text-muted/40 hover:text-accent"}`}
                        title={isFav ? "Unfavourite" : "Favourite"}
                      >
                        ★
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-text truncate">{m.name}</p>
                        <p className="text-muted/70 truncate text-[10px]">
                          {m.provider}
                          {!m.provider_implemented ? " · scaffold" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDefaultModel(m.id)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          isDefault
                            ? "border-accent/40 text-accent"
                            : "border-border text-muted hover:text-text hover:border-border-strong"
                        }`}
                      >
                        {isDefault ? "default" : "set default"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                saved
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-accent text-bg hover:bg-accent-hover"
              } disabled:opacity-50`}
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save all"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
