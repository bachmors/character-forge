"use client";

import { useState, useEffect } from "react";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
}

interface CharacterSheetProps {
  character: Character;
  onUpdate: (updated: Character) => void;
  onLightboxOpen: (src: string) => void;
}

const TRAIT_FIELDS = [
  { key: "hair", label: "Hair", placeholder: "e.g. intricate black box braids" },
  { key: "skin", label: "Skin", placeholder: "e.g. natural brown skin with freckles" },
  { key: "accessories", label: "Accessories", placeholder: "e.g. black lace choker necklace" },
  { key: "clothing_base", label: "Base Clothing", placeholder: "e.g. white ribbed strapless top" },
  { key: "expression_default", label: "Default Expression", placeholder: "e.g. neutral-seductive" },
];

const WARDROBE_PRESETS = [
  { id: "casual", label: "Casual", desc: "jeans, t-shirt, sneakers" },
  { id: "formal", label: "Formal", desc: "suit, dress, elegant attire" },
  { id: "sporty", label: "Sporty", desc: "athletic wear, sportswear" },
  { id: "fantasy", label: "Fantasy", desc: "robes, armor, magical attire" },
  { id: "scifi", label: "Sci-Fi", desc: "futuristic suit, tech gear" },
  { id: "medieval", label: "Medieval", desc: "tunic, leather, period clothing" },
];

export default function CharacterSheet({ character, onUpdate, onLightboxOpen }: CharacterSheetProps) {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description);
  const [baseImageUrl, setBaseImageUrl] = useState(character.base_image_url);
  const [traits, setTraits] = useState<Record<string, string>>(character.traits || {});
  const [customTraits, setCustomTraits] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    setName(character.name);
    setDescription(character.description);
    setBaseImageUrl(character.base_image_url);
    setTraits(character.traits || {});

    // Extract custom traits (not in TRAIT_FIELDS)
    const standardKeys = TRAIT_FIELDS.map((f) => f.key);
    const custom = Object.entries(character.traits || {})
      .filter(([k]) => !standardKeys.includes(k))
      .map(([key, value]) => ({ key, value }));
    setCustomTraits(custom);
  }, [character]);

  const handleAnalyzeImage = async () => {
    const url = baseImageUrl.trim();
    if (!url) return;

    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      // Fetch the image and convert to base64
      const imageRes = await fetch(url);
      if (!imageRes.ok) throw new Error("Could not fetch image");

      const buffer = await imageRes.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const contentType = imageRes.headers.get("content-type") || "image/jpeg";

      // Send to analyze API
      const res = await fetch("/api/analyze/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: contentType }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || "Analysis failed");
        return;
      }

      // Populate fields from analysis
      if (data.name_suggestion && !name.trim()) setName(data.name_suggestion);
      if (data.description) setDescription(data.description);

      const newTraits = { ...traits };
      if (data.hair) newTraits.hair = data.hair;
      if (data.skin) newTraits.skin = data.skin;
      if (data.accessories) newTraits.accessories = data.accessories;
      if (data.clothing_base) newTraits.clothing_base = data.clothing_base;
      if (data.expression_default) newTraits.expression_default = data.expression_default;
      setTraits(newTraits);

      // Add extra analysis fields as custom traits
      const extraFields = ["body_type", "age_range", "distinguishing_features", "art_style"];
      const newCustom = [...customTraits];
      for (const field of extraFields) {
        if (data[field]) {
          const existingIdx = newCustom.findIndex((ct) => ct.key === field);
          if (existingIdx >= 0) {
            newCustom[existingIdx].value = data[field];
          } else {
            newCustom.push({ key: field, value: data[field] });
          }
        }
      }
      setCustomTraits(newCustom);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Merge custom traits into traits object
      const allTraits = { ...traits };
      for (const ct of customTraits) {
        if (ct.key.trim()) {
          allTraits[ct.key.trim()] = ct.value;
        }
      }

      const res = await fetch(`/api/characters/${character._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          base_image_url: baseImageUrl,
          traits: allTraits,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save:", err);
    }
    setSaving(false);
  };

  const addCustomTrait = () => {
    setCustomTraits((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeCustomTrait = (index: number) => {
    setCustomTraits((prev) => prev.filter((_, i) => i !== index));
  };

  const applyWardrobePreset = (preset: (typeof WARDROBE_PRESETS)[number]) => {
    setTraits((prev) => ({ ...prev, clothing_base: preset.desc }));
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-serif text-accent text-lg font-semibold">Character Sheet</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-success/20 text-success border border-success/30"
              : "bg-accent text-bg hover:bg-accent-hover"
          } disabled:opacity-50`}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="space-y-5">
        {/* Base info */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Base Image URL</label>
            <div className="flex gap-3">
              <input
                type="url"
                value={baseImageUrl}
                onChange={(e) => setBaseImageUrl(e.target.value)}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
              />
              {baseImageUrl && (
                <div
                  className="w-12 h-12 rounded-lg border border-border overflow-hidden shrink-0 cursor-pointer hover:border-accent/40 transition-colors"
                  onClick={() => onLightboxOpen(baseImageUrl)}
                >
                  <img src={baseImageUrl} alt="Base" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            {baseImageUrl && (
              <button
                onClick={handleAnalyzeImage}
                disabled={analyzing}
                className="mt-2 px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    Analyzing with Gemini...
                  </span>
                ) : (
                  "Auto-Analyze Image with AI"
                )}
              </button>
            )}
            {analyzeError && <p className="text-xs text-danger mt-1">{analyzeError}</p>}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Standard Traits */}
        <div>
          <h4 className="text-sm text-accent font-medium mb-3">Character Traits</h4>
          <p className="text-xs text-muted mb-4">
            These traits are automatically included in all generation prompts for this character.
          </p>
          <div className="space-y-3">
            {TRAIT_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-muted mb-1">{field.label}</label>
                <input
                  type="text"
                  value={traits[field.key] || ""}
                  onChange={(e) =>
                    setTraits((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Wardrobe Presets */}
        <div>
          <h4 className="text-sm text-accent font-medium mb-3">Wardrobe</h4>
          <p className="text-xs text-muted mb-3">
            Quick-set clothing style. Overrides Base Clothing above.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {WARDROBE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyWardrobePreset(preset)}
                className={`px-3 py-2 rounded-lg text-xs text-left border transition-colors ${
                  traits.clothing_base === preset.desc
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "text-muted border-border hover:border-border-strong hover:text-text"
                }`}
              >
                <span className="font-medium block">{preset.label}</span>
                <span className="text-muted/60 text-[10px]">{preset.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Traits */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm text-accent font-medium">Custom Traits</h4>
            <button
              onClick={addCustomTrait}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              + Add Trait
            </button>
          </div>
          <div className="space-y-2">
            {customTraits.map((ct, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={ct.key}
                  onChange={(e) =>
                    setCustomTraits((prev) =>
                      prev.map((item, idx) =>
                        idx === i ? { ...item, key: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Trait name"
                  className="w-32 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
                <input
                  type="text"
                  value={ct.value}
                  onChange={(e) =>
                    setCustomTraits((prev) =>
                      prev.map((item, idx) =>
                        idx === i ? { ...item, value: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Value"
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
                <button
                  onClick={() => removeCustomTrait(i)}
                  className="text-muted hover:text-danger transition-colors px-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
