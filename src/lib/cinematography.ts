/**
 * Cinematography & art-style controls (Modules 7 + 9).
 *
 * The constants and helpers here are used by every generation surface so
 * that the same camera/lens/lighting and art-style choices can be applied
 * consistently to single-character, multi-character, scene, turnaround,
 * and transformation flows.
 */

export interface CameraAngle {
  id: string;
  label: string;
  description: string;
}

export const CAMERA_ANGLES: CameraAngle[] = [
  { id: "default", label: "Eye level", description: "neutral eye-level camera, viewer-character parity" },
  { id: "low", label: "Low angle", description: "low-angle camera looking up at the character, conveying power and dominance" },
  { id: "high", label: "High angle", description: "high-angle camera looking down at the character, conveying vulnerability and smallness" },
  { id: "dutch", label: "Dutch angle", description: "tilted Dutch-angle camera, conveying tension, unease, and disorientation" },
  { id: "birds_eye", label: "Bird's eye", description: "directly overhead bird's-eye camera, conveying context and isolation" },
  { id: "worms_eye", label: "Worm's eye", description: "extreme low worm's-eye camera, conveying monumentality and grandeur" },
  { id: "ots", label: "Over the shoulder", description: "over-the-shoulder camera framing, conveying intimacy and POV (best for two-character scenes)" },
];

export interface LensChoice {
  id: string;
  label: string;
  description: string;
}

export const LENSES: LensChoice[] = [
  { id: "default", label: "Standard 50mm", description: "natural 50mm framing, true-to-eye perspective" },
  { id: "wide_24", label: "Wide angle 24mm", description: "wide 24mm framing showing the character within the environment, slight edge distortion" },
  { id: "tele_85", label: "Telephoto 85mm", description: "telephoto 85mm portrait framing, compressed background, character isolated from setting" },
  { id: "ecu", label: "Extreme close-up", description: "extreme close-up framing focused on the eyes/mouth/detail" },
  { id: "full_body_wide", label: "Full body wide", description: "full-body wide framing, character within environmental context" },
  { id: "medium_shot", label: "Medium shot", description: "medium shot from the waist up, conversational framing" },
  { id: "cowboy", label: "Cowboy shot", description: "cowboy shot framing the character from mid-thigh upward, classic western framing" },
];

export interface LightingMood {
  id: string;
  label: string;
  description: string;
}

export const LIGHTING_MOODS: LightingMood[] = [
  { id: "default", label: "Natural daylight", description: "natural soft daylight, neutral color temperature" },
  { id: "golden_hour", label: "Golden hour", description: "warm low-sun golden-hour light, cinematic, long shadows" },
  { id: "blue_hour", label: "Blue hour", description: "cool twilight blue-hour light, melancholic, soft contrast" },
  { id: "noir", label: "Noir", description: "high-contrast film-noir lighting, single hard light source, deep dramatic shadows, strong chiaroscuro" },
  { id: "rembrandt", label: "Rembrandt", description: "classic Rembrandt portrait lighting, soft triangle of light on the cheek opposite the key light" },
  { id: "silhouette", label: "Silhouette", description: "strong backlight reducing the character to a silhouette, identity legible by outline only" },
  { id: "neon", label: "Neon", description: "cyberpunk neon lighting, mixed colored artificial sources, magenta and cyan accents" },
  { id: "overcast", label: "Overcast soft", description: "flat even overcast soft light, documentary realism" },
  { id: "candlelight", label: "Candlelight", description: "warm low candlelight, intimate and flickering, deep shadows around the character" },
  { id: "moonlight", label: "Moonlight", description: "cool blue-silver moonlight, mysterious low-key" },
  { id: "studio", label: "Studio", description: "clean professional studio lighting, even and shadow-controlled" },
];

export interface ArtStyle {
  id: string;
  label: string;
  description: string;
}

export const ART_STYLES: ArtStyle[] = [
  { id: "default", label: "Photorealistic", description: "photorealistic photographic image with natural detail" },
  { id: "oil_painting", label: "Oil painting", description: "classical oil painting with rich textures, visible brushwork, painterly color blending" },
  { id: "watercolor", label: "Watercolor", description: "soft watercolor painting with flowing pigment, paper texture, dreamlike washes of color" },
  { id: "comic_book", label: "Comic book", description: "comic-book illustration with bold black linework, flat saturated colors, dynamic composition, halftone dot shading" },
  { id: "manga", label: "Manga / Anime", description: "Japanese manga / anime illustration with clean black linework, large expressive eyes, cel-shaded color, stylized hair" },
  { id: "film_noir", label: "Film noir", description: "black-and-white film-noir aesthetic with extreme contrast and dramatic shadows" },
  { id: "pixar_3d", label: "Pixar / 3D animation", description: "stylized Pixar-like 3D animation, expressive features, slightly exaggerated proportions, soft global illumination" },
  { id: "sketch", label: "Sketch / Pencil drawing", description: "raw pencil sketch with visible construction lines, hatched shading, unfinished quality" },
  { id: "pop_art", label: "Pop art", description: "Warhol-esque pop-art with bold flat colors, posterized tones, halftone patterns" },
  { id: "art_nouveau", label: "Art nouveau", description: "Art nouveau decorative illustration with organic flowing lines, ornamental framing, muted naturalistic palette" },
  { id: "cyberpunk", label: "Cyberpunk", description: "cyberpunk illustration with neon accents, dystopian tech ambience, glowing rim light, dense urban texture" },
  { id: "renaissance", label: "Renaissance", description: "Renaissance painting style with classical composition, chiaroscuro lighting, oil-painting technique reminiscent of the Italian masters" },
  { id: "minimalist", label: "Minimalist", description: "minimalist illustration with simple geometric shapes, limited 3-color palette, lots of negative space" },
  { id: "vintage_photo", label: "Vintage photograph", description: "vintage photographic look, sepia tones, visible film grain, period-feel framing" },
  { id: "graphic_novel", label: "Graphic novel", description: "moody graphic-novel illustration with dense ink work, controlled spotting of black, atmospheric muted color" },
];

export interface CinematographyChoice {
  cameraAngle?: string; // id from CAMERA_ANGLES
  lens?: string;        // id from LENSES
  lighting?: string;    // id from LIGHTING_MOODS
}

/**
 * Returns the CINEMATOGRAPHY block to append to a generation prompt.
 * Returns "" when every choice is "default" (or unset).
 */
export function buildCinematographyInstruction(c?: CinematographyChoice | null): string {
  if (!c) return "";
  const angle = c.cameraAngle && c.cameraAngle !== "default"
    ? CAMERA_ANGLES.find((a) => a.id === c.cameraAngle)
    : null;
  const lens = c.lens && c.lens !== "default" ? LENSES.find((l) => l.id === c.lens) : null;
  const light =
    c.lighting && c.lighting !== "default"
      ? LIGHTING_MOODS.find((l) => l.id === c.lighting)
      : null;
  if (!angle && !lens && !light) return "";

  const lines = ["CINEMATOGRAPHY:"];
  if (angle) lines.push(`Camera angle: ${angle.label} — ${angle.description}.`);
  if (lens) lines.push(`Lens: ${lens.label} — ${lens.description}.`);
  if (light) lines.push(`Lighting: ${light.label} — ${light.description}.`);
  lines.push(
    "Apply these cinematographic choices to create a photographic image with intentional visual storytelling through camera and light.",
  );
  return lines.join(" ");
}

/**
 * Returns the ART STYLE block to append to a generation prompt. Returns ""
 * for "default" / "photorealistic" so existing prompts behave unchanged.
 */
export function buildArtStyleInstruction(styleId?: string | null): string {
  if (!styleId || styleId === "default") return "";
  const def = ART_STYLES.find((s) => s.id === styleId);
  if (!def) return "";
  return [
    "ART STYLE:",
    `Render this image in ${def.label} style — ${def.description}.`,
    "Maintain character identity and recognizability but adapt all visual elements (linework, color palette, texture, composition) to match this aesthetic.",
  ].join(" ");
}
