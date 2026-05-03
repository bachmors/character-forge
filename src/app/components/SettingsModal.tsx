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
  is_custom?: boolean;
  uncensored?: boolean;
  paid?: boolean;
  private_model?: boolean;
  recommended?: boolean;
  supports_reference_image?: boolean;
  group?: "ref" | "uncensored" | "standard";
}

interface ModelsResponse {
  models: ModelEntry[];
  used_fallback?: boolean;
}

interface CustomModel {
  modelId: string;
  displayName: string;
  type: "image" | "text" | "vision";
  defaultParams?: Record<string, unknown>;
  enabled?: boolean;
}

interface CustomProvider {
  _id: string;
  providerName: string;
  baseUrl: string;
  has_key: boolean;
  apiFormat: "openai" | "custom";
  imageEndpoint: string;
  authType: "bearer" | "header" | "none";
  authHeaderName: string | null;
  supportsReferenceImage?: boolean;
  models: CustomModel[];
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
  const [veniceSafeMode, setVeniceSafeMode] = useState<boolean>(false);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available">("available");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cpDraft, setCpDraft] = useState({
    providerName: "",
    baseUrl: "",
    apiKey: "",
    apiFormat: "openai" as "openai" | "custom",
    imageEndpoint: "/images/generations",
    authType: "bearer" as "bearer" | "header" | "none",
    authHeaderName: "",
    supportsReferenceImage: false,
  });
  const [cpModelDrafts, setCpModelDrafts] = useState<CustomModel[]>([]);
  const [cpModelInput, setCpModelInput] = useState({
    modelId: "",
    displayName: "",
    type: "image" as "image" | "text" | "vision",
    defaultParams: "",
  });

  const reloadCustomProviders = async () => {
    const res = await fetch("/api/custom-providers");
    if (res.ok) {
      const data = await res.json();
      setCustomProviders(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [pRes, sRes, mRes, cpRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/settings"),
        fetch("/api/models"),
        fetch("/api/custom-providers"),
      ]);
      if (cancelled) return;
      if (pRes.ok) setProviders(await pRes.json());
      if (sRes.ok) {
        const s = await sRes.json();
        setDefaultModel(s.defaultModel || "gemini-3.1-flash-image-preview");
        setFavoriteModels(s.favoriteModels || []);
        setVeniceSafeMode(Boolean(s.veniceSafeMode));
      }
      if (mRes.ok) {
        const data: ModelsResponse = await mRes.json();
        setModels(data.models || []);
        setUsedFallback(Boolean(data.used_fallback));
      }
      if (cpRes.ok) {
        const data = await cpRes.json();
        setCustomProviders(Array.isArray(data) ? data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const resetCpForm = () => {
    setCpDraft({
      providerName: "",
      baseUrl: "",
      apiKey: "",
      apiFormat: "openai",
      imageEndpoint: "/images/generations",
      authType: "bearer",
      authHeaderName: "",
      supportsReferenceImage: false,
    });
    setCpModelDrafts([]);
    setCpModelInput({ modelId: "", displayName: "", type: "image", defaultParams: "" });
    setShowCustomForm(false);
    setEditingId(null);
  };

  const startEditCp = (cp: CustomProvider) => {
    setEditingId(cp._id);
    setCpDraft({
      providerName: cp.providerName,
      baseUrl: cp.baseUrl,
      apiKey: "",
      apiFormat: cp.apiFormat,
      imageEndpoint: cp.imageEndpoint,
      authType: cp.authType,
      authHeaderName: cp.authHeaderName || "",
      supportsReferenceImage: cp.supportsReferenceImage === true,
    });
    setCpModelDrafts(cp.models);
    setShowCustomForm(true);
  };

  const handleAddModelToDraft = () => {
    const id = cpModelInput.modelId.trim();
    if (!id) return;
    let defaultParams: Record<string, unknown> = {};
    if (cpModelInput.defaultParams.trim()) {
      try {
        defaultParams = JSON.parse(cpModelInput.defaultParams);
      } catch {
        alert("Default parameters must be valid JSON");
        return;
      }
    }
    setCpModelDrafts((prev) => [
      ...prev,
      {
        modelId: id,
        displayName: cpModelInput.displayName.trim() || id,
        type: cpModelInput.type,
        defaultParams,
        enabled: true,
      },
    ]);
    setCpModelInput({ modelId: "", displayName: "", type: "image", defaultParams: "" });
  };

  const handleSaveCustomProvider = async () => {
    if (!cpDraft.providerName.trim() || !cpDraft.baseUrl.trim()) {
      alert("Provider name and base URL are required");
      return;
    }
    const body = {
      providerName: cpDraft.providerName,
      baseUrl: cpDraft.baseUrl,
      apiKey: cpDraft.apiKey || undefined,
      apiFormat: cpDraft.apiFormat,
      imageEndpoint: cpDraft.imageEndpoint,
      authType: cpDraft.authType,
      authHeaderName: cpDraft.authType === "header" ? cpDraft.authHeaderName : null,
      supportsReferenceImage: cpDraft.supportsReferenceImage,
      models: cpModelDrafts,
    };
    const res = editingId
      ? await fetch(`/api/custom-providers/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/custom-providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (res.ok) {
      await reloadCustomProviders();
      // Refresh the model list so new custom models appear in the picker.
      const mRes = await fetch("/api/models");
      if (mRes.ok) {
        const data: ModelsResponse = await mRes.json();
        setModels(data.models || []);
      }
      resetCpForm();
    } else {
      alert("Could not save custom provider");
    }
  };

  const handleDeleteCustomProvider = async (id: string) => {
    if (!confirm("Delete this custom provider and all its models?")) return;
    const res = await fetch(`/api/custom-providers/${id}`, { method: "DELETE" });
    if (res.ok) await reloadCustomProviders();
  };

  const handleTestCustomProvider = async (id: string) => {
    const res = await fetch(`/api/custom-providers/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json();
    alert(data.ok ? "✓ Connected" : `✗ ${data.error || "Test failed"}`);
  };

  const toggleCpModelEnabled = async (cp: CustomProvider, modelId: string) => {
    const newModels = cp.models.map((m) =>
      m.modelId === modelId ? { ...m, enabled: m.enabled === false ? true : false } : m,
    );
    await fetch(`/api/custom-providers/${cp._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ models: newModels }),
    });
    await reloadCustomProviders();
  };

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
          veniceSafeMode,
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
                    {/* Venice-only: Safe Mode toggle + warning when OFF. */}
                    {p.id === "venice" && (
                      <div className="space-y-1 pt-1">
                        <label className="flex items-center gap-2 text-[11px] text-muted">
                          <input
                            type="checkbox"
                            checked={veniceSafeMode}
                            onChange={(e) => setVeniceSafeMode(e.target.checked)}
                            className="accent-accent"
                          />
                          Safe mode{" "}
                          <span className="text-muted/60">
                            {veniceSafeMode
                              ? "ON — content filtering applied"
                              : "OFF — uncensored (default)"}
                          </span>
                        </label>
                        {!veniceSafeMode && (
                          <p className="text-[10px] text-danger/80 ml-6">
                            ⚠ Content filters disabled. Use responsibly for production purposes.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Custom user-defined providers */}
          <section className="space-y-3 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm text-accent font-medium">Custom Providers</h3>
                <p className="text-xs text-muted/80">
                  Add your own provider — local server, niche API, anything OpenAI-compatible.
                  Saved per user in MongoDB so they sync across devices.
                </p>
              </div>
              {!showCustomForm && (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                >
                  + Add Custom Provider
                </button>
              )}
            </div>

            {/* List existing */}
            {customProviders.length > 0 && (
              <div className="space-y-2">
                {customProviders.map((cp) => (
                  <div
                    key={cp._id}
                    className="border border-border rounded-lg p-3 bg-bg/40 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-text font-medium text-sm">{cp.providerName}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted/70">
                          {cp.apiFormat} · {cp.authType}
                        </span>
                        <p className="text-muted/70 mt-0.5 truncate font-mono text-[11px]">
                          {cp.baseUrl}
                          {cp.imageEndpoint}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTestCustomProvider(cp._id)}
                          className="px-2 py-0.5 rounded border border-border text-muted hover:text-text hover:border-border-strong"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => startEditCp(cp)}
                          className="px-2 py-0.5 rounded border border-border text-muted hover:text-text hover:border-border-strong"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCustomProvider(cp._id)}
                          className="px-2 py-0.5 rounded border border-border text-muted hover:text-danger hover:border-danger/40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {cp.models.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {cp.models.map((m) => (
                          <button
                            key={m.modelId}
                            onClick={() => toggleCpModelEnabled(cp, m.modelId)}
                            className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              m.enabled === false
                                ? "border-border text-muted/50 line-through"
                                : "border-accent/30 text-accent bg-accent/5"
                            }`}
                            title={m.enabled === false ? "Disabled — click to enable" : "Click to disable"}
                          >
                            {m.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Form */}
            {showCustomForm && (
              <div className="border border-accent/30 rounded-lg p-3 bg-accent/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Provider name</label>
                    <input
                      type="text"
                      value={cpDraft.providerName}
                      onChange={(e) => setCpDraft({ ...cpDraft, providerName: e.target.value })}
                      placeholder="MyLocalServer"
                      className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Base URL</label>
                    <input
                      type="text"
                      value={cpDraft.baseUrl}
                      onChange={(e) => setCpDraft({ ...cpDraft, baseUrl: e.target.value })}
                      placeholder="http://localhost:8080/v1"
                      className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-muted mb-0.5">
                      API key {editingId && <span className="text-muted/60">(leave blank to keep existing)</span>}
                    </label>
                    <input
                      type="password"
                      value={cpDraft.apiKey}
                      onChange={(e) => setCpDraft({ ...cpDraft, apiKey: e.target.value })}
                      placeholder={editingId ? "(unchanged)" : "API key"}
                      className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">API format</label>
                    <select
                      value={cpDraft.apiFormat}
                      onChange={(e) =>
                        setCpDraft({
                          ...cpDraft,
                          apiFormat: e.target.value as "openai" | "custom",
                        })
                      }
                      className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent/30"
                    >
                      <option value="openai">OpenAI-compatible</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Image endpoint</label>
                    <input
                      type="text"
                      value={cpDraft.imageEndpoint}
                      onChange={(e) =>
                        setCpDraft({ ...cpDraft, imageEndpoint: e.target.value })
                      }
                      className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-0.5">Auth type</label>
                    <select
                      value={cpDraft.authType}
                      onChange={(e) =>
                        setCpDraft({
                          ...cpDraft,
                          authType: e.target.value as "bearer" | "header" | "none",
                        })
                      }
                      className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent/30"
                    >
                      <option value="bearer">Bearer Token</option>
                      <option value="header">API Key Header</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  {cpDraft.authType === "header" && (
                    <div>
                      <label className="block text-[11px] text-muted mb-0.5">Header name</label>
                      <input
                        type="text"
                        value={cpDraft.authHeaderName}
                        onChange={(e) =>
                          setCpDraft({ ...cpDraft, authHeaderName: e.target.value })
                        }
                        placeholder="X-API-Key"
                        className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-accent/30"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-[11px] text-muted">
                      <input
                        type="checkbox"
                        checked={cpDraft.supportsReferenceImage}
                        onChange={(e) =>
                          setCpDraft({ ...cpDraft, supportsReferenceImage: e.target.checked })
                        }
                        className="accent-accent"
                      />
                      Supports reference images
                      <span className="text-muted/60">
                        (the provider accepts an init / reference image alongside the prompt)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Models in this provider */}
                <div>
                  <label className="block text-[11px] text-muted mb-1">Models</label>
                  {cpModelDrafts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {cpModelDrafts.map((m, i) => (
                        <span
                          key={`${m.modelId}-${i}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[11px]"
                        >
                          {m.displayName}{" "}
                          <span className="text-muted/60 font-mono">({m.modelId})</span>
                          <button
                            onClick={() =>
                              setCpModelDrafts((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-muted/70 hover:text-danger"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={cpModelInput.modelId}
                      onChange={(e) =>
                        setCpModelInput({ ...cpModelInput, modelId: e.target.value })
                      }
                      placeholder="model id (e.g. fluently-xl)"
                      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text font-mono placeholder:text-muted/50 focus:outline-none focus:border-accent/30"
                    />
                    <input
                      type="text"
                      value={cpModelInput.displayName}
                      onChange={(e) =>
                        setCpModelInput({ ...cpModelInput, displayName: e.target.value })
                      }
                      placeholder="display name"
                      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30"
                    />
                    <select
                      value={cpModelInput.type}
                      onChange={(e) =>
                        setCpModelInput({
                          ...cpModelInput,
                          type: e.target.value as "image" | "text" | "vision",
                        })
                      }
                      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent/30"
                    >
                      <option value="image">Image generation</option>
                      <option value="text">Text</option>
                      <option value="vision">Vision</option>
                    </select>
                    <input
                      type="text"
                      value={cpModelInput.defaultParams}
                      onChange={(e) =>
                        setCpModelInput({ ...cpModelInput, defaultParams: e.target.value })
                      }
                      placeholder='default params JSON (optional)'
                      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text font-mono placeholder:text-muted/50 focus:outline-none focus:border-accent/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddModelToDraft}
                    className="mt-1 text-[11px] text-accent hover:text-accent-hover transition-colors"
                  >
                    + Add model
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={resetCpForm}
                    className="flex-1 py-1.5 rounded border border-border text-muted hover:text-text hover:border-border-strong text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCustomProvider}
                    className="flex-1 py-1.5 rounded bg-accent text-bg font-medium text-xs hover:bg-accent-hover transition-colors"
                  >
                    {editingId ? "Update provider" : "Add provider"}
                  </button>
                </div>
              </div>
            )}
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
                        <p className="text-text truncate flex items-center gap-1 flex-wrap">
                          {m.recommended && (
                            <span
                              className="text-[9px] px-1 rounded bg-accent/20 text-accent border border-accent/40"
                              title="Recommended for character consistency"
                            >
                              ★ rec
                            </span>
                          )}
                          {m.name}
                          {m.is_custom && (
                            <span className="text-[9px] uppercase tracking-wide px-1 rounded bg-accent/15 text-accent border border-accent/30">
                              custom
                            </span>
                          )}
                          {m.supports_reference_image && (
                            <span
                              className="text-[9px] uppercase tracking-wide px-1 rounded bg-accent/15 text-accent border border-accent/30"
                              title="Accepts a reference image"
                            >
                              📷 ref
                            </span>
                          )}
                          {m.uncensored && (
                            <span
                              className="text-[9px] uppercase tracking-wide px-1 rounded bg-danger/15 text-danger border border-danger/30"
                              title="No content filters"
                            >
                              🔓 uncensored
                            </span>
                          )}
                          {m.paid && (
                            <span
                              className="text-[9px] uppercase tracking-wide px-1 rounded bg-bg/50 text-muted border border-border"
                              title="Requires paid credits"
                            >
                              💰
                            </span>
                          )}
                        </p>
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
