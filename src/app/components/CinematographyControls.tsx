"use client";

import {
  CAMERA_ANGLES,
  LENSES,
  LIGHTING_MOODS,
  ART_STYLES,
} from "@/lib/cinematography";

export interface CinematographyState {
  cameraAngle: string;
  lens: string;
  lighting: string;
  artStyle: string;
}

export const DEFAULT_CINEMATOGRAPHY_STATE: CinematographyState = {
  cameraAngle: "default",
  lens: "default",
  lighting: "default",
  artStyle: "default",
};

interface Props {
  value: CinematographyState;
  onChange: (next: CinematographyState) => void;
  /** Render style — "details" wraps in <details>, "inline" renders open. */
  variant?: "details" | "inline";
}

function summary(state: CinematographyState): string {
  const parts: string[] = [];
  if (state.cameraAngle && state.cameraAngle !== "default") {
    const a = CAMERA_ANGLES.find((x) => x.id === state.cameraAngle);
    if (a) parts.push(a.label);
  }
  if (state.lens && state.lens !== "default") {
    const l = LENSES.find((x) => x.id === state.lens);
    if (l) parts.push(l.label);
  }
  if (state.lighting && state.lighting !== "default") {
    const lg = LIGHTING_MOODS.find((x) => x.id === state.lighting);
    if (lg) parts.push(lg.label);
  }
  if (state.artStyle && state.artStyle !== "default") {
    const s = ART_STYLES.find((x) => x.id === state.artStyle);
    if (s) parts.push(s.label);
  }
  return parts.length ? parts.join(" · ") : "defaults";
}

export default function CinematographyControls({ value, onChange, variant = "details" }: Props) {
  const update = (patch: Partial<CinematographyState>) => onChange({ ...value, ...patch });

  const inner = (
    <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] text-muted mb-1">Camera angle</label>
        <select
          value={value.cameraAngle}
          onChange={(e) => update({ cameraAngle: e.target.value })}
          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
        >
          {CAMERA_ANGLES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] text-muted mb-1">Lens / Framing</label>
        <select
          value={value.lens}
          onChange={(e) => update({ lens: e.target.value })}
          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
        >
          {LENSES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] text-muted mb-1">Lighting mood</label>
        <select
          value={value.lighting}
          onChange={(e) => update({ lighting: e.target.value })}
          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
        >
          {LIGHTING_MOODS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] text-muted mb-1">Art style</label>
        <select
          value={value.artStyle}
          onChange={(e) => update({ artStyle: e.target.value })}
          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
        >
          {ART_STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="border border-border rounded-lg">
        <div className="px-3 py-2 text-sm text-muted border-b border-border">
          Camera &amp; Lighting{" "}
          <span className="text-xs text-muted/60">({summary(value)})</span>
        </div>
        {inner}
      </div>
    );
  }

  return (
    <details className="border border-border rounded-lg group">
      <summary className="px-3 py-2 cursor-pointer text-sm text-muted hover:text-text transition-colors flex items-center justify-between list-none">
        <span>
          Camera &amp; Lighting{" "}
          <span className="text-xs text-muted/60">({summary(value)})</span>
        </span>
        <span className="text-muted/60 transition-transform group-open:rotate-90">›</span>
      </summary>
      {inner}
    </details>
  );
}
