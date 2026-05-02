"use client";

import { useState, useEffect } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface SettingsData {
  apiKeys: Record<string, string>;
  defaultModel: string;
  hasKeys: Record<string, boolean>;
}

const API_KEY_FIELDS = [
  { key: "googleAi", label: "Google AI (Gemini)", placeholder: "AIzaSy..." },
  // Non-functional providers — re-enable once their generation routes are wired up.
  // { key: "openAi", label: "OpenAI (DALL-E)", placeholder: "sk-..." },
  // { key: "replicate", label: "Replicate (SDXL, Flux)", placeholder: "r8_..." },
  // { key: "stabilityAi", label: "Stability AI", placeholder: "sk-..." },
];

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          setSettings(data);
          setKeys(data.apiKeys || {});
        })
        .catch(console.error);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: keys }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        // Refresh settings
        const data = await fetch("/api/settings").then((r) => r.json());
        setSettings(data);
        setKeys(data.apiKeys || {});
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border-strong rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in mx-4">
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

          <div className="space-y-4">
            <div>
              <h3 className="text-sm text-accent font-medium mb-3">API Keys</h3>
              <p className="text-xs text-muted mb-4">
                Keys are encrypted and stored in your session cookie. They are never exposed to the client.
              </p>

              <div className="space-y-3">
                {API_KEY_FIELDS.map((field) => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted">{field.label}</label>
                      {settings?.hasKeys?.[field.key] && (
                        <span className="text-xs text-success">Configured</span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={keys[field.key] || ""}
                      onChange={(e) =>
                        setKeys((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted mb-2">
                Tip: You can also set GOOGLE_AI_API_KEY as an environment variable on the server.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                saved
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-accent text-bg hover:bg-accent-hover"
              } disabled:opacity-50`}
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save Keys"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
