import type { ImageProvider, GenerationOptions, GenerationResult } from ".";

/**
 * Venice AI provider — IMPLEMENTED.
 *
 * Two endpoints:
 *   - /v1/image/generate  text-to-image only (most models)
 *   - /v1/image/edit      image-to-image with a reference (qwen-edit-2511)
 *
 * The provider routes per-model based on VENICE_IMAGE_MODELS metadata.
 * supportsReferenceImage is per-model (not per-provider) so the rest of
 * the app can correctly enable/disable the reference-image UI based on
 * which Venice model the user picked.
 */

type SizingSystem = "pixel" | "aspect" | "resolution_tier" | "default";

export interface VeniceModelMeta {
  id: string;
  displayName: string;
  sizing: SizingSystem;
  /** True only for qwen-edit-2511 today — uses /image/edit. */
  supportsReferenceImage: boolean;
  uncensored?: boolean;
  paid?: boolean;
  privateModel?: boolean;
  recommended?: boolean;
  /**
   * UI grouping in the model selector and Settings models grid.
   *   "ref"       → reference-image capable
   *   "uncensored" → text-only, no content filters
   *   "standard"  → text-only, standard moderation
   */
  group: "ref" | "uncensored" | "standard";
}

export const VENICE_IMAGE_MODELS: VeniceModelMeta[] = [
  // Reference-image-capable
  {
    id: "qwen-edit-2511",
    displayName: "Qwen Edit (Auto)",
    sizing: "pixel",
    supportsReferenceImage: true,
    recommended: true,
    group: "ref",
  },

  // Uncensored (text-only)
  { id: "z-image-turbo", displayName: "Z-Image Turbo", sizing: "pixel", supportsReferenceImage: false, uncensored: true, privateModel: true, group: "uncensored" },
  { id: "seedream-v4-5", displayName: "Seedream V4.5", sizing: "pixel", supportsReferenceImage: false, uncensored: true, group: "uncensored" },
  { id: "seedream-v5-lite", displayName: "Seedream V5 Lite", sizing: "pixel", supportsReferenceImage: false, uncensored: true, group: "uncensored" },
  { id: "lustify-sdxl", displayName: "Lustify SDXL", sizing: "pixel", supportsReferenceImage: false, uncensored: true, privateModel: true, paid: true, group: "uncensored" },
  { id: "lustify-v8", displayName: "Lustify V8", sizing: "pixel", supportsReferenceImage: false, uncensored: true, privateModel: true, paid: true, group: "uncensored" },
  { id: "anime-wai", displayName: "Anime WAI", sizing: "pixel", supportsReferenceImage: false, uncensored: true, privateModel: true, paid: true, group: "uncensored" },
  { id: "chroma", displayName: "Chroma", sizing: "pixel", supportsReferenceImage: false, uncensored: true, privateModel: true, paid: true, group: "uncensored" },

  // Standard text-only
  { id: "venice-sd35", displayName: "Venice SD 3.5", sizing: "pixel", supportsReferenceImage: false, privateModel: true, group: "standard" },
  { id: "flux-2-pro", displayName: "Flux 2 Pro", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "flux-2-max", displayName: "Flux 2 Max", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "gpt-image-2", displayName: "GPT Image 2", sizing: "resolution_tier", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "gpt-image-1-5", displayName: "GPT Image 1.5", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "hunyuan-image-3-0", displayName: "Hunyuan Image 3.0", sizing: "pixel", supportsReferenceImage: false, privateModel: true, paid: true, group: "standard" },
  { id: "imagineart-1-5-pro", displayName: "ImagineArt 1.5 Pro", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "nano-banana-2", displayName: "Nano Banana 2", sizing: "resolution_tier", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "nano-banana-pro", displayName: "Nano Banana Pro", sizing: "resolution_tier", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "recraft-v4", displayName: "Recraft V4", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "recraft-v4-pro", displayName: "Recraft V4 Pro", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "qwen-image-2", displayName: "Qwen Image 2", sizing: "aspect", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "qwen-image-2-pro", displayName: "Qwen Image 2 Pro", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "qwen-image", displayName: "Qwen Image", sizing: "pixel", supportsReferenceImage: false, privateModel: true, paid: true, group: "standard" },
  { id: "wan-2-7", displayName: "Wan 2.7", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "wan-2-7-pro", displayName: "Wan 2.7 Pro", sizing: "pixel", supportsReferenceImage: false, paid: true, group: "standard" },
  { id: "grok-imagine", displayName: "Grok Imagine", sizing: "default", supportsReferenceImage: false, privateModel: true, paid: true, group: "standard" },
];

export const VENICE_MODEL_INDEX: Map<string, VeniceModelMeta> = new Map(
  VENICE_IMAGE_MODELS.map((m) => [m.id, m]),
);

const PIXEL_DIMS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "3:2": { width: 1216, height: 832 },
  "2:3": { width: 832, height: 1216 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

function buildSizingPayload(
  meta: VeniceModelMeta,
  aspectRatio: string | undefined,
): Record<string, unknown> {
  const ar = aspectRatio || "1:1";
  if (meta.sizing === "pixel") {
    const dim = PIXEL_DIMS[ar] || PIXEL_DIMS["1:1"];
    return { width: dim.width, height: dim.height };
  }
  if (meta.sizing === "aspect") return { aspect_ratio: ar };
  if (meta.sizing === "resolution_tier") return { aspect_ratio: ar, resolution: "1K" };
  // "default" — let the model pick its own canvas
  return {};
}

export const venice: ImageProvider = {
  id: "venice",
  name: "Venice AI",
  description:
    "25 image models — uncensored generation plus qwen-edit-2511 for reference-image-driven editing.",
  // Match every Venice model id exactly so registry collisions can't lose
  // them to other providers' broader patterns.
  modelPatterns: VENICE_IMAGE_MODELS.map((m) => new RegExp(`^${m.id}$`, "i")),
  implemented: true,
  // Provider-level default: false. The capability is per-model — the route
  // and UI consult VENICE_MODEL_INDEX to know whether a specific model
  // supports references.
  supportsReferenceImage: false,

  async generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Venice API key not configured. Add it in Settings.");
    }

    // Default to seedream-v5-lite (uncensored, free) when an unknown id
    // slips through — same shape as a generic pixel model.
    const meta = VENICE_MODEL_INDEX.get(model) || {
      id: model,
      displayName: model,
      sizing: "pixel" as SizingSystem,
      supportsReferenceImage: false,
      group: "standard" as const,
    };

    const useEdit =
      meta.supportsReferenceImage &&
      Array.isArray(options.referenceImages) &&
      options.referenceImages.length > 0;

    const safeMode = options.safeMode === true;

    // /image/edit and /image/generate are two DIFFERENT APIs with
    // different schemas. The edit endpoint rejects sizing / format /
    // variants — those are generate-only.
    let url: string;
    let body: Record<string, unknown>;

    if (useEdit) {
      const refImage = options.referenceImages![0];
      // The edit endpoint expects RAW base64 (no "data:image/...;base64,"
      // prefix). Our internal ReferenceImage already stores the raw base64
      // in `data`, but be defensive in case a caller passes a data URL.
      const rawBase64 = refImage.data.startsWith("data:")
        ? refImage.data.replace(/^data:[^;]+;base64,/, "")
        : refImage.data;
      // Venice accepts jpeg, png, webp, heif, heic, avif. compressImage()
      // produces JPEG so this is fine for app-generated references; we
      // only catch the most likely incompatible cases here.
      const mt = (refImage.mimeType || "").toLowerCase();
      if (mt && !/^image\/(jpe?g|png|webp|heif|heic|avif)$/.test(mt)) {
        throw new Error(
          `Reference image format ${mt} is not supported by Venice edit. Use JPEG, PNG, WEBP, HEIF, HEIC, or AVIF.`,
        );
      }
      url = "https://api.venice.ai/api/v1/image/edit";
      body = {
        model: meta.id,
        prompt: options.prompt,
        image: rawBase64,
        safe_mode: safeMode,
      };
    } else {
      const sizingPayload = buildSizingPayload(meta, options.aspectRatio);
      url = "https://api.venice.ai/api/v1/image/generate";
      body = {
        model: meta.id,
        prompt: options.prompt,
        ...sizingPayload,
        steps: 30,
        safe_mode: safeMode,
        format: "webp",
        variants: 1,
        hide_watermark: false,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Venice API error ${res.status}: ${text.slice(0, 400) || "unknown"}`);
    }
    const data = (await res.json()) as {
      id?: string;
      images?: string[];
      timing?: unknown;
    };

    const first = data.images?.[0];
    if (!first) throw new Error("Venice returned no image data in the response.");

    return {
      imageDataUrl: first.startsWith("data:") ? first : `data:image/webp;base64,${first}`,
      modelUsed: model,
      provider: "venice",
    };
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      const res = await fetch("https://api.venice.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};

/** Returns true when the model id matches one of Venice's image generation models. */
export function isVeniceImageModel(modelId: string): boolean {
  return VENICE_MODEL_INDEX.has(modelId);
}

/** Returns true only for Venice models that accept a reference image (e.g. qwen-edit-2511). */
export function veniceModelSupportsRef(modelId: string): boolean {
  return VENICE_MODEL_INDEX.get(modelId)?.supportsReferenceImage === true;
}
