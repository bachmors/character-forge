"use client";

import { useEffect, useState } from "react";
import {
  TEMPERAMENTS,
  CORE_MOTIVATIONS,
  DEEPEST_FEARS,
  EMOTIONAL_STATES,
  BODY_LANGUAGE,
  type PsychologyProfile,
  type CharacterProfile,
} from "@/lib/profile";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
  profile?: CharacterProfile;
}

interface Props {
  character: Character;
  onUpdate: (updated: Character) => void;
}

const ENERGY_LABEL = (n: number) =>
  n <= 3 ? "Low (slouched, withdrawn)" : n <= 6 ? "Moderate (everyday)" : "High (alert, dynamic)";

interface PresetOption {
  id: string;
  label: string;
}

interface PresetWithCustomProps {
  label: string;
  options: ReadonlyArray<PresetOption>;
  value?: string;
  customValue?: string;
  onChange: (id: string | undefined, custom: string | undefined) => void;
}

function PresetWithCustom({ label, options, value, customValue, onChange }: PresetWithCustomProps) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <select
        value={value || ""}
        onChange={(e) =>
          onChange(e.target.value || undefined, e.target.value === "custom" ? customValue : undefined)
        }
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
      >
        <option value="">— not set —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {value === "custom" && (
        <input
          type="text"
          value={customValue || ""}
          onChange={(e) => onChange("custom", e.target.value)}
          placeholder="Describe…"
          className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
        />
      )}
    </div>
  );
}

export default function PsychologyPanel({ character, onUpdate }: Props) {
  const [psy, setPsy] = useState<PsychologyProfile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPsy(character.profile?.psychology || {});
  }, [character]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const newProfile: CharacterProfile = {
        ...(character.profile || {}),
        psychology: psy,
      };
      const res = await fetch(`/api/characters/${character._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: newProfile }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError("Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<PsychologyProfile>) => setPsy((prev) => ({ ...prev, ...patch }));

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h3 className="font-serif text-accent text-lg font-semibold">Psychology</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-success/20 text-success border border-success/30"
              : "bg-accent text-bg hover:bg-accent-hover"
          } disabled:opacity-50`}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Psychology"}
        </button>
      </div>

      <p className="text-xs text-muted/80 mb-5 leading-relaxed">
        These traits are appended to every image generation prompt for{" "}
        <span className="text-accent">{character.name}</span> so the psychology becomes visible in
        facial expression, posture, and energy.
      </p>

      <div className="space-y-4">
        <PresetWithCustom
          label="Temperament"
          options={TEMPERAMENTS}
          value={psy.temperament}
          customValue={psy.custom_temperament}
          onChange={(id, custom) => update({ temperament: id, custom_temperament: custom })}
        />
        <PresetWithCustom
          label="Core motivation"
          options={CORE_MOTIVATIONS}
          value={psy.motivation}
          customValue={psy.custom_motivation}
          onChange={(id, custom) => update({ motivation: id, custom_motivation: custom })}
        />
        <PresetWithCustom
          label="Deepest fear"
          options={DEEPEST_FEARS}
          value={psy.fear}
          customValue={psy.custom_fear}
          onChange={(id, custom) => update({ fear: id, custom_fear: custom })}
        />
        <PresetWithCustom
          label="Default emotional state"
          options={EMOTIONAL_STATES}
          value={psy.emotional_state}
          customValue={psy.custom_emotional_state}
          onChange={(id, custom) => update({ emotional_state: id, custom_emotional_state: custom })}
        />

        {/* Energy slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted">Energy level</label>
            <span className="text-xs text-accent">
              {typeof psy.energy === "number" ? `${psy.energy}/10 — ${ENERGY_LABEL(psy.energy)}` : "—"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={psy.energy ?? 5}
            onChange={(e) => update({ energy: Number(e.target.value) })}
            className="w-full accent-accent"
          />
          {psy.energy !== undefined && (
            <button
              onClick={() => update({ energy: undefined })}
              className="mt-1 text-[11px] text-muted hover:text-text transition-colors"
            >
              Clear energy
            </button>
          )}
        </div>

        {/* Body language */}
        <div>
          <label className="block text-xs text-muted mb-1">Body language tendency</label>
          <select
            value={psy.body_language || ""}
            onChange={(e) => update({ body_language: e.target.value || undefined })}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
          >
            <option value="">— not set —</option>
            {BODY_LANGUAGE.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-muted mb-1">Notes (private — not sent to model)</label>
          <textarea
            value={psy.notes || ""}
            onChange={(e) => update({ notes: e.target.value })}
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
        </div>

        {error && (
          <div className="p-2 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
