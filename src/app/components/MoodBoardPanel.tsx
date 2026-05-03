"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/imageUtils";
import {
  type CharacterProfile,
  type MoodBoardProfile,
  type MoodBoardImage,
  type MoodBoardPalette,
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
  onLightboxOpen: (src: string) => void;
}

const PALETTE_LABELS: Array<{ key: keyof MoodBoardPalette; label: string }> = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "shadow", label: "Shadow" },
  { key: "highlight", label: "Highlight" },
];

export default function MoodBoardPanel({ character, onUpdate, onLightboxOpen }: Props) {
  const [board, setBoard] = useState<MoodBoardProfile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBoard(character.profile?.moodboard || {});
  }, [character]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const newProfile: CharacterProfile = {
        ...(character.profile || {}),
        moodboard: board,
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

  const addImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressImage(reader.result as string);
        const newImg: MoodBoardImage = { src: compressed, caption: "" };
        setBoard((b) => ({ ...b, images: [...(b.images || []), newImg] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not compress image");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (idx: number) => {
    setBoard((b) => ({
      ...b,
      images: (b.images || []).filter((_, i) => i !== idx),
    }));
  };
  const updateImageCaption = (idx: number, caption: string) => {
    setBoard((b) => ({
      ...b,
      images: (b.images || []).map((im, i) => (i === idx ? { ...im, caption } : im)),
    }));
  };

  const setPaletteColor = (key: keyof MoodBoardPalette, value: string) => {
    setBoard((b) => ({ ...b, palette: { ...(b.palette || {}), [key]: value } }));
  };

  const addKeyword = () => {
    const k = keywordDraft.trim();
    if (!k) return;
    setBoard((b) => {
      const existing = b.keywords || [];
      if (existing.includes(k)) return b;
      return { ...b, keywords: [...existing, k] };
    });
    setKeywordDraft("");
  };

  const removeKeyword = (k: string) => {
    setBoard((b) => ({ ...b, keywords: (b.keywords || []).filter((x) => x !== k) }));
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h3 className="font-serif text-accent text-lg font-semibold">Mood Board</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-success/20 text-success border border-success/30"
              : "bg-accent text-bg hover:bg-accent-hover"
          } disabled:opacity-50`}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Mood Board"}
        </button>
      </div>

      {/* Reference images */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h4 className="text-sm text-accent font-medium">Reference images</h4>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1 rounded-lg border border-accent/30 text-accent text-xs hover:bg-accent/10 transition-colors"
          >
            + Upload image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addImageFromFile(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
        </div>

        {(board.images || []).length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f && f.type.startsWith("image/")) addImageFromFile(f);
            }}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted text-sm cursor-pointer hover:border-accent/40 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            Click or drop image here.
            <br />
            <span className="text-xs text-muted/70">
              Actor faces, outfits, environments, pose references…
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(board.images || []).map((im, idx) => (
              <div key={idx} className="border border-border rounded-lg overflow-hidden bg-surface">
                <div
                  className="aspect-square bg-bg cursor-pointer"
                  onClick={() => onLightboxOpen(im.src)}
                >
                  <img src={im.src} alt={im.caption || "reference"} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 space-y-1">
                  <input
                    type="text"
                    value={im.caption || ""}
                    onChange={(e) => updateImageCaption(idx, e.target.value)}
                    placeholder="Caption…"
                    className="w-full bg-bg border border-border rounded px-2 py-1 text-[11px] text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="text-[11px] text-muted hover:text-danger transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Palette */}
      <section className="mb-8">
        <h4 className="text-sm text-accent font-medium mb-3">Color palette</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PALETTE_LABELS.map(({ key, label }) => {
            const value = board.palette?.[key] || "";
            return (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[11px] text-muted">{label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={value || "#000000"}
                    onChange={(e) => setPaletteColor(key, e.target.value)}
                    className="w-10 h-10 rounded border border-border bg-bg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setPaletteColor(key, e.target.value)}
                    placeholder="#hex"
                    className="flex-1 min-w-0 bg-bg border border-border rounded px-2 py-1 text-[11px] text-text placeholder:text-muted/50 font-mono focus:outline-none focus:border-accent/30 transition-colors"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Keywords */}
      <section className="mb-8">
        <h4 className="text-sm text-accent font-medium mb-3">Visual keywords</h4>
        <p className="text-xs text-muted/80 mb-2">
          e.g. <span className="text-accent/70">gritty, ethereal, noir, warm, saturated</span>.
          Optional: also send palette + keywords to the image model on every generation.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(board.keywords || []).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 text-xs"
            >
              {k}
              <button
                onClick={() => removeKeyword(k)}
                className="text-accent/70 hover:text-danger"
                aria-label={`Remove ${k}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="Add keyword and press Enter"
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
          />
          <button
            onClick={addKeyword}
            className="px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
          >
            Add
          </button>
        </div>

        <label className="flex items-center gap-2 mt-3 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={!!board.inject_into_prompts}
            onChange={(e) =>
              setBoard((b) => ({ ...b, inject_into_prompts: e.target.checked }))
            }
            className="accent-accent"
          />
          Inject palette + keywords into image generation prompts
        </label>
      </section>

      {/* Notes */}
      <section className="mb-2">
        <h4 className="text-sm text-accent font-medium mb-2">Inspiration notes</h4>
        <textarea
          value={board.notes || ""}
          onChange={(e) => setBoard((b) => ({ ...b, notes: e.target.value }))}
          rows={4}
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none"
          placeholder="Free notes on visual direction, references, mood…"
        />
      </section>

      {error && (
        <div className="p-2 mt-4 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
