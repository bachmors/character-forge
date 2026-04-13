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
}

const TRAIT_FIELDS = [
  { key: "hair", label: "Hair", placeholder: "e.g. intricate black box braids" },
  { key: "skin", label: "Skin", placeholder: "e.g. natural brown skin with freckles" },
  { key: "accessories", label: "Accessories", placeholder: "e.g. black lace choker necklace" },
  { key: "clothing_base", label: "Base Clothing", placeholder: "e.g. white ribbed strapless top" },
  { key: "expression_default", label: "Default Expression", placeholder: "e.g. neutral-seductive" },
];

export default function CharacterSheet({ character, onUpdate }: CharacterSheetProps) {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description);
  const [baseImageUrl, setBaseImageUrl] = useState(character.base_image_url);
  const [traits, setTraits] = useState<Record<string, string>>(character.traits || {});
  const [customTraits, setCustomTraits] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
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
                <div className="w-12 h-12 rounded-lg border border-border overflow-hidden shrink-0">
                  <img src={baseImageUrl} alt="Base" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
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
