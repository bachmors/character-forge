import type { ImageProvider, GenerationOptions, GenerationResult } from ".";

/**
 * Venice AI provider — IMPLEMENTED.
 *
 * Uses Venice's NATIVE image-generation endpoint (NOT the OpenAI-compatible
 * one). Different Venice models accept different sizing systems:
 *   - "pixel"          → width + height
 *   - "aspect"         → aspect_ratio only
 *   - "resolution_tier" → aspect_ratio + resolution (1K | 2K | 4K)
 *
 * Endpoint: POST https://api.venice.ai/api/v1/image/generate
 * Auth:     Authorization: Bearer <apiKey>
 *
 * Request body fields used:
 *   model, prompt, height?, width?, aspect_ratio?, resolution?,
 *   steps, safe_mode, format, variants, hide_watermark
 *
 * Response: { id, images: ["<base64 string>"], timing }
 */

type SizingSystem = "pixel" | "aspect" | "resolution_tier";

interface VeniceModelMeta {
  id: string;
  displayName: string;
  sizing: SizingSystem;
  uncensored?: boolean;
}

/** All Venice image-generation models known to this build. */
export const VENICE_IMAGE_MODELS: VeniceModelMeta[] = [
  { id: "flux-dev-uncensored", displayName: "FLUX Dev Uncensored", sizing: "pixel", uncensored: true },
  { id: "flux-dev", displayName: "FLUX Dev", sizing: "pixel" },
  { id: "fluently-xl", displayName: "Fluently XL", sizing: "pixel" },
  { id: "venice-sd35", displayName: "Stable Diffusion 3.5", sizing: "pixel" },
  { id: "qwen-image-2", displayName: "Qwen Image v2", sizing: "aspect" },
  { id: "grok-imagine-image", displayName: "Grok Imagine", sizing: "resolution_tier", uncensored: true },
  { id: "gpt-image-2", displayName: "GPT Image 2", sizing: "resolution_tier" },
  { id: "nano-banana-pro", displayName: "Nano Banana Pro", sizing: "resolution_tier" },
  { id: "nano-banana-2", displayName: "Nano Banana v2", sizing: "resolution_tier" },
];

const VENICE_MODEL_INDEX: Map<string, VeniceModelMeta> = new Map(
  VENICE_IMAGE_MODELS.map((m) => [m.id, m]),
);

/**
 * Normalised aspect-ratio inputs from elsewhere in the app ("1:1", "16:9", …)
 * mapped to width/height pairs for pixel-sizing models. We keep total pixels
 * close to 1MP (~1024×1024) so quality is consistent across aspects.
 */
const PIXEL_DIMS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "3:2": { width: 1216, height: 832 },
  "2:3": { width: 832, height: 1216 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

/**
 * Build the body payload appropriate for the selected Venice model's
 * sizing system. Defaults the canvas to 1024×1024 / 1:1 / 1K resolution
 * when no aspect-ratio hint is provided.
 */
function buildSizingPayload(
  modelMeta: VeniceModelMeta,
  aspectRatio: string | undefined,
): Record<string, unknown> {
  const ar = aspectRatio || "1:1";
  if (modelMeta.sizing === "pixel") {
    const dim = PIXEL_DIMS[ar] || PIXEL_DIMS["1:1"];
    return { width: dim.width, height: dim.height };
  }
  if (modelMeta.sizing === "aspect") {
    return { aspect_ratio: ar };
  }
  // resolution_tier — always pair with a resolution. Default to 1K.
  return { aspect_ratio: ar, resolution: "1K" };
}

export const venice: ImageProvider = {
  id: "venice",
  name: "Venice AI",
  description:
    "Uncensored image models. flux-dev-uncensored, grok-imagine-image, plus 7 others. Native endpoint /v1/image/generate.",
  modelPatterns: [
    /^flux-?dev(-uncensored)?$/i,
    /^fluently-xl$/i,
    /^venice-/i,
    /^qwen-image(-\d)?$/i,
    /^grok-imagine-image$/i,
    /^gpt-image-2$/i,
    /^nano-banana(-pro|-\d)?$/i,
  ],
  implemented: true,
  // Venice's /v1/image/generate is text-to-image only — no reference
  // images. Identity has to be carried by the prompt.
  supportsReferenceImage: false,

  async generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Venice API key not configured. Add it in Settings.");
    }

    // Default to fluently-xl when an unknown id slips through.
    const meta = VENICE_MODEL_INDEX.get(model) || {
      id: model,
      displayName: model,
      sizing: "pixel" as SizingSystem,
    };

    const sizingPayload = buildSizingPayload(meta, options.aspectRatio);
    const body = {
      model: meta.id,
      prompt: options.prompt,
      ...sizingPayload,
      steps: 30,
      safe_mode: options.safeMode === true,
      format: "webp",
      variants: 1,
      hide_watermark: false,
    };

    const res = await fetch("https://api.venice.ai/api/v1/image/generate", {
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

    // Venice returns the image as a base64-encoded string in the requested
    // format (webp by default). Inline as a data URL.
    const imageDataUrl = first.startsWith("data:")
      ? first
      : `data:image/webp;base64,${first}`;

    return {
      imageDataUrl,
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
