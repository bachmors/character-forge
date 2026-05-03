import type { ImageProvider, GenerationOptions, GenerationResult } from ".";

/**
 * Venice AI provider — IMPLEMENTED.
 *
 * Per Venice docs the image API is OpenAI-compatible:
 *   POST https://api.venice.ai/api/v1/images/generations
 *   Header:  Authorization: Bearer <apiKey>
 *   Body:    { model, prompt, size, response_format, safe_mode? }
 *   Resp:    { data: [{ b64_json }, ...] }
 *
 * All Venice image models are TEXT-TO-IMAGE — none accept a reference
 * image. Identity has to ride in the prompt (the route appends a
 * CHARACTER APPEARANCE block when the chosen model can't take a ref).
 *
 * The previous /image/edit and /image/generate paths in this file were
 * wrong — replaced entirely by /images/generations.
 */

interface VeniceModelMeta {
  id: string;
  displayName: string;
  uncensored?: boolean;
  paid?: boolean;
  privateModel?: boolean;
  group: "uncensored" | "standard";
}

export const VENICE_IMAGE_MODELS: VeniceModelMeta[] = [
  // Uncensored (text-only)
  { id: "z-image-turbo", displayName: "Z-Image Turbo", uncensored: true, privateModel: true, group: "uncensored" },
  { id: "seedream-v4-5", displayName: "Seedream V4.5", uncensored: true, group: "uncensored" },
  { id: "seedream-v5-lite", displayName: "Seedream V5 Lite", uncensored: true, group: "uncensored" },
  { id: "lustify-sdxl", displayName: "Lustify SDXL", uncensored: true, privateModel: true, paid: true, group: "uncensored" },
  { id: "lustify-v8", displayName: "Lustify V8", uncensored: true, privateModel: true, paid: true, group: "uncensored" },
  { id: "anime-wai", displayName: "Anime WAI", uncensored: true, privateModel: true, paid: true, group: "uncensored" },
  { id: "chroma", displayName: "Chroma", uncensored: true, privateModel: true, paid: true, group: "uncensored" },

  // Standard
  { id: "qwen-image", displayName: "Qwen Image", privateModel: true, paid: true, group: "standard" },
  { id: "qwen-image-2", displayName: "Qwen Image 2", paid: true, group: "standard" },
  { id: "qwen-image-2-pro", displayName: "Qwen Image 2 Pro", paid: true, group: "standard" },
  { id: "venice-sd35", displayName: "Venice SD 3.5", privateModel: true, group: "standard" },
  { id: "grok-imagine-image-pro", displayName: "Grok Imagine Pro", privateModel: true, paid: true, group: "standard" },
  { id: "flux-2-pro", displayName: "Flux 2 Pro", paid: true, group: "standard" },
  { id: "flux-2-max", displayName: "Flux 2 Max", paid: true, group: "standard" },
  { id: "gpt-image-2", displayName: "GPT Image 2", paid: true, group: "standard" },
  { id: "gpt-image-1-5", displayName: "GPT Image 1.5", paid: true, group: "standard" },
  { id: "hunyuan-image-3-0", displayName: "Hunyuan Image 3.0", privateModel: true, paid: true, group: "standard" },
  { id: "imagineart-1-5-pro", displayName: "ImagineArt 1.5 Pro", paid: true, group: "standard" },
  { id: "nano-banana-2", displayName: "Nano Banana 2", paid: true, group: "standard" },
  { id: "nano-banana-pro", displayName: "Nano Banana Pro", paid: true, group: "standard" },
  { id: "recraft-v4", displayName: "Recraft V4", paid: true, group: "standard" },
  { id: "recraft-v4-pro", displayName: "Recraft V4 Pro", paid: true, group: "standard" },
  { id: "wan-2-7", displayName: "Wan 2.7", paid: true, group: "standard" },
  { id: "wan-2-7-pro", displayName: "Wan 2.7 Pro", paid: true, group: "standard" },
];

export const VENICE_MODEL_INDEX: Map<string, VeniceModelMeta> = new Map(
  VENICE_IMAGE_MODELS.map((m) => [m.id, m]),
);

/**
 * Map our internal aspect-ratio hints to OpenAI-style "WIDTHxHEIGHT" size
 * strings. The endpoint accepts the three sizes below across most models;
 * unknown ratios fall back to 1024x1024.
 */
function aspectToSize(aspectRatio: string | undefined): string {
  switch (aspectRatio) {
    case "16:9":
      return "1792x1024";
    case "9:16":
      return "1024x1792";
    case "1:1":
    default:
      return "1024x1024";
  }
}

export const venice: ImageProvider = {
  id: "venice",
  name: "Venice AI",
  description:
    "24 image models — uncensored generation included. OpenAI-compatible /v1/images/generations endpoint, text-to-image only.",
  modelPatterns: VENICE_IMAGE_MODELS.map((m) => new RegExp(`^${m.id}$`, "i")),
  implemented: true,
  // No Venice image model accepts a reference today.
  supportsReferenceImage: false,

  async generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Venice API key not configured. Add it in Settings.");
    }

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      size: aspectToSize(options.aspectRatio),
      response_format: "b64_json",
      // Default to false (uncensored). Toggled by the user under Settings.
      safe_mode: options.safeMode === true,
    };

    const res = await fetch("https://api.venice.ai/api/v1/images/generations", {
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
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const first = data.data?.[0];
    if (first?.b64_json) {
      return {
        imageDataUrl: `data:image/png;base64,${first.b64_json}`,
        modelUsed: model,
        provider: "venice",
      };
    }
    if (first?.url) {
      // Inline remote URLs as data URLs so the rest of the app stores them
      // identically to Gemini outputs.
      const imgRes = await fetch(first.url);
      if (!imgRes.ok) throw new Error(`Failed to fetch Venice image url: ${imgRes.status}`);
      const buf = await imgRes.arrayBuffer();
      const mime = imgRes.headers.get("content-type") || "image/png";
      return {
        imageDataUrl: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
        modelUsed: model,
        provider: "venice",
      };
    }

    throw new Error("Venice returned no image data in the response.");
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

/** True when the model id is one of Venice's image-generation models. */
export function isVeniceImageModel(modelId: string): boolean {
  return VENICE_MODEL_INDEX.has(modelId);
}

/**
 * Per-model reference-image capability. All Venice image models are
 * text-to-image today, so this is always false. Kept as a function so
 * the route doesn't have to learn about provider-internal metadata.
 */
export function veniceModelSupportsRef(_modelId: string): boolean {
  return false;
}
