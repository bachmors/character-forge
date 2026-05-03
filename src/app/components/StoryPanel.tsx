"use client";

import { useEffect, useState } from "react";
import {
  PROFESSIONS,
  PHYSICAL_TRAINING,
  ARC_TYPES,
  SPEECH_PATTERNS,
  PITCH_LEVELS,
  SPEED_LEVELS,
  VOLUME_LEVELS,
  TEXTURE_LEVELS,
  type BackstoryProfile,
  type VoiceProfile,
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

export default function StoryPanel({ character, onUpdate }: Props) {
  const [back, setBack] = useState<BackstoryProfile>({});
  const [voice, setVoice] = useState<VoiceProfile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBack(character.profile?.backstory || {});
    setVoice(character.profile?.voice || {});
  }, [character]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const newProfile: CharacterProfile = {
        ...(character.profile || {}),
        backstory: back,
        voice,
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

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h3 className="font-serif text-accent text-lg font-semibold">Story</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-success/20 text-success border border-success/30"
              : "bg-accent text-bg hover:bg-accent-hover"
          } disabled:opacity-50`}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Story"}
        </button>
      </div>

      {/* Backstory */}
      <section className="space-y-4 mb-8">
        <h4 className="text-sm text-accent font-medium">Backstory</h4>
        <p className="text-xs text-muted/80">
          Profession and physical training are appended to image generation prompts so the
          character&apos;s posture and bearing reflect their background.
        </p>

        <div>
          <label className="block text-xs text-muted mb-1">Origin</label>
          <textarea
            value={back.origin || ""}
            onChange={(e) => setBack((b) => ({ ...b, origin: e.target.value }))}
            placeholder="Where they're from, social class, era…"
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Formative experience</label>
          <textarea
            value={back.formative_experience || ""}
            onChange={(e) => setBack((b) => ({ ...b, formative_experience: e.target.value }))}
            placeholder="The event that shaped them most…"
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Profession / Role</label>
            <select
              value={back.profession || ""}
              onChange={(e) => setBack((b) => ({ ...b, profession: e.target.value || undefined }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
            >
              <option value="">— not set —</option>
              {PROFESSIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {back.profession === "custom" && (
              <input
                type="text"
                value={back.custom_profession || ""}
                onChange={(e) => setBack((b) => ({ ...b, custom_profession: e.target.value }))}
                placeholder="Describe…"
                className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Physical training</label>
            <select
              value={back.physical_training || ""}
              onChange={(e) =>
                setBack((b) => ({ ...b, physical_training: e.target.value || undefined }))
              }
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
            >
              <option value="">— not set —</option>
              {PHYSICAL_TRAINING.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Key relationships (one per line)</label>
          <textarea
            value={back.key_relationships || ""}
            onChange={(e) => setBack((b) => ({ ...b, key_relationships: e.target.value }))}
            placeholder={"Father: absent since age 7\nMentor: Professor Lee\nRival: Darius"}
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none font-mono text-[12px]"
          />
        </div>
      </section>

      {/* Character arc */}
      <section className="space-y-4 mb-8">
        <h4 className="text-sm text-accent font-medium">Character arc</h4>

        <div>
          <label className="block text-xs text-muted mb-1">Arc type</label>
          <select
            value={back.arc_type || ""}
            onChange={(e) => setBack((b) => ({ ...b, arc_type: e.target.value || undefined }))}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
          >
            <option value="">— not set —</option>
            {ARC_TYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">State at start</label>
            <textarea
              value={back.arc_state_start || ""}
              onChange={(e) => setBack((b) => ({ ...b, arc_state_start: e.target.value }))}
              rows={2}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">State at end</label>
            <textarea
              value={back.arc_state_end || ""}
              onChange={(e) => setBack((b) => ({ ...b, arc_state_end: e.target.value }))}
              rows={2}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Turning point</label>
          <textarea
            value={back.arc_turning_point || ""}
            onChange={(e) => setBack((b) => ({ ...b, arc_turning_point: e.target.value }))}
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
        </div>
      </section>

      {/* Voice */}
      <section className="space-y-4 border-t border-border pt-6">
        <h4 className="text-sm text-accent font-medium">Voice</h4>
        <p className="text-xs text-muted/80">
          Reference data for writers and audio. Not sent to the image model.
        </p>

        <div>
          <label className="block text-xs text-muted mb-1">Speech pattern</label>
          <select
            value={voice.speech_pattern || ""}
            onChange={(e) => setVoice((v) => ({ ...v, speech_pattern: e.target.value || undefined }))}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
          >
            <option value="">— not set —</option>
            {SPEECH_PATTERNS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Verbal tics</label>
          <textarea
            value={voice.verbal_tics || ""}
            onChange={(e) => setVoice((v) => ({ ...v, verbal_tics: e.target.value }))}
            placeholder={"Always starts sentences with 'Look...'\nClears throat before lying"}
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">When happy, they say…</label>
            <input
              type="text"
              value={voice.sample_happy || ""}
              onChange={(e) => setVoice((v) => ({ ...v, sample_happy: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">When angry, they say…</label>
            <input
              type="text"
              value={voice.sample_angry || ""}
              onChange={(e) => setVoice((v) => ({ ...v, sample_angry: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Most characteristic phrase</label>
            <input
              type="text"
              value={voice.characteristic_phrase || ""}
              onChange={(e) => setVoice((v) => ({ ...v, characteristic_phrase: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
            />
          </div>
        </div>

        {/* Voice quality */}
        <details className="border border-border rounded-lg">
          <summary className="px-3 py-2 cursor-pointer text-xs text-muted hover:text-text transition-colors">
            Voice quality (audio reference)
          </summary>
          <div className="px-3 pb-3 grid grid-cols-2 gap-3 pt-1">
            {[
              { key: "pitch", label: "Pitch", options: PITCH_LEVELS },
              { key: "speed", label: "Speed", options: SPEED_LEVELS },
              { key: "volume", label: "Volume", options: VOLUME_LEVELS },
              { key: "texture", label: "Texture", options: TEXTURE_LEVELS },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[11px] text-muted mb-1 capitalize">{field.label}</label>
                <select
                  value={(voice as Record<string, string | undefined>)[field.key] || ""}
                  onChange={(e) =>
                    setVoice((v) => ({ ...v, [field.key]: e.target.value || undefined }))
                  }
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent/30 transition-colors capitalize"
                >
                  <option value="">— not set —</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </details>
      </section>

      {error && (
        <div className="p-2 mt-4 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
