import type { ImageProvider, GenerationOptions, GenerationResult } from ".";

/**
 * Venice AI provider — IMPLEMENTED.
 *
 * Venice exposes TWO separate image systems with different model IDs and
 * different request/response shapes:
 *
 *   GENERATE — text-to-image, OpenAI-compatible
 *     POST https://api.venice.ai/api/v1/images/generations
 *     body: { model, prompt, size, response_format: "b64_json" }
 *     resp: { data: [{ b64_json | url }, ...] }
 *
 *   EDIT — image-to-image (reference required)
 *     POST https://api.venice.ai/api/v1/image/edit
 *     body: { model, prompt, image, safe_mode }   (raw base64 in `image`)
 *     resp: { images: ["<base64>", ...] }
 *
 * Routing is decided per-model via the `endpoint` field in the metadata
 * tables below. The two lists are kept separate so the model selector can
 * group them and the route can pick the right URL/body shape automatically.
 */

interface VeniceModelMeta {
  id: string;
  displayName: string;
  endpoint: "generate" | "edit";
  uncensored?: boolean;
  paid?: boolean;
  privateModel?: boolean;
  recommended?: boolean;
  /** Display-only price chip (e.g. "$0.01", "free", "paid"). */
  price?: string;
}

/** Text-to-image models — /v1/images/generations, OpenAI-compatible. */
export const VENICE_GENERATE_MODELS: VeniceModelMeta[] = [
  // Uncensored
  { id: "z-image-turbo", displayName: "Z-Image Turbo", endpoint: "generate", uncensored: true, privateModel: true, price: "free" },
  { id: "seedream-v4-5", displayName: "Seedream V4.5", endpoint: "generate", uncensored: true, paid: true, price: "paid" },
  { id: "seedream-v5-lite", displayName: "Seedream V5 Lite", endpoint: "generate", uncensored: true, paid: true, price: "paid" },
  { id: "lustify-sdxl", displayName: "Lustify SDXL", endpoint: "generate", uncensored: true, privateModel: true, paid: true, price: "paid" },
  { id: "lustify-v8", displayName: "Lustify V8", endpoint: "generate", uncensored: true, privateModel: true, paid: true, price: "paid" },
  { id: "anime-wai", displayName: "Anime WAI", endpoint: "generate", uncensored: true, privateModel: true, paid: true, price: "paid" },
  { id: "chroma", displayName: "Chroma", endpoint: "generate", uncensored: true, privateModel: true, paid: true, price: "paid" },

  // Standard
  { id: "qwen-image", displayName: "Qwen Image", endpoint: "generate", privateModel: true, paid: true, price: "$0.01" },
  { id: "qwen-image-2", displayName: "Qwen Image 2", endpoint: "generate", paid: true, price: "paid" },
  { id: "qwen-image-2-pro", displayName: "Qwen Image 2 Pro", endpoint: "generate", paid: true, price: "paid" },
  { id: "venice-sd35", displayName: "Venice SD 3.5", endpoint: "generate", privateModel: true, price: "free" },
  { id: "grok-imagine-image-pro", displayName: "Grok Imagine Pro", endpoint: "generate", privateModel: true, paid: true, price: "paid" },
  { id: "flux-2-pro", displayName: "Flux 2 Pro", endpoint: "generate", paid: true, price: "paid" },
  { id: "flux-2-max", displayName: "Flux 2 Max", endpoint: "generate", paid: true, price: "paid" },
  { id: "gpt-image-2", displayName: "GPT Image 2", endpoint: "generate", paid: true, price: "paid" },
  { id: "gpt-image-1-5", displayName: "GPT Image 1.5", endpoint: "generate", paid: true, price: "paid" },
  { id: "hunyuan-image-3-0", displayName: "Hunyuan Image 3.0", endpoint: "generate", privateModel: true, paid: true, price: "paid" },
  { id: "imagineart-1-5-pro", displayName: "ImagineArt 1.5 Pro", endpoint: "generate", paid: true, price: "paid" },
  { id: "nano-banana-2", displayName: "Nano Banana 2", endpoint: "generate", paid: true, price: "paid" },
  { id: "nano-banana-pro", displayName: "Nano Banana Pro", endpoint: "generate", paid: true, price: "paid" },
  { id: "recraft-v4", displayName: "Recraft V4", endpoint: "generate", paid: true, price: "paid" },
  { id: "recraft-v4-pro", displayName: "Recraft V4 Pro", endpoint: "generate", paid: true, price: "paid" },
  { id: "wan-2-7", displayName: "Wan 2.7", endpoint: "generate", paid: true, price: "paid" },
  { id: "wan-2-7-pro", displayName: "Wan 2.7 Pro", endpoint: "generate", paid: true, price: "paid" },
];

/** Image-to-image models — /v1/image/edit. Reference image required. */
export const VENICE_EDIT_MODELS: VeniceModelMeta[] = [
  // Uncensored / cheap → recommend qwen-edit for character work.
  { id: "qwen-edit", displayName: "Qwen Edit 2511", endpoint: "edit", uncensored: true, privateModel: true, paid: true, recommended: true, price: "$0.04" },
  { id: "seedream-v4-edit", displayName: "Seedream V4 Edit", endpoint: "edit", uncensored: true, paid: true, price: "$0.05" },
  { id: "seedream-v5-lite-edit", displayName: "Seedream V5 Lite Edit", endpoint: "edit", uncensored: true, paid: true, price: "$0.05" },

  // Standard moderation
  { id: "firered-image-edit", displayName: "FireRed Edit", endpoint: "edit", paid: true, price: "$0.04" },
  { id: "grok-imagine-edit", displayName: "Grok Imagine Edit", endpoint: "edit", paid: true, price: "$0.03" },
  { id: "qwen-image-2-edit", displayName: "Qwen Image 2 Edit", endpoint: "edit", paid: true, price: "$0.05" },
  { id: "qwen-image-2-pro-edit", displayName: "Qwen Image 2 Pro Edit", endpoint: "edit", paid: true, price: "$0.10" },
  { id: "wan-2-7-pro-edit", displayName: "Wan 2.7 Pro Edit", endpoint: "edit", paid: true, price: "$0.09" },
  { id: "flux-2-max-edit", displayName: "Flux 2 Max Edit", endpoint: "edit", paid: true, price: "$0.19" },
  { id: "gpt-image-2-edit", displayName: "GPT Image 2 Edit", endpoint: "edit", paid: true, price: "$0.36" },
  { id: "gpt-image-1-5-edit", displayName: "GPT Image 1.5 Edit", endpoint: "edit", paid: true, price: "$0.36" },
  { id: "nano-banana-2-edit", displayName: "Nano Banana 2 Edit", endpoint: "edit", paid: true, price: "$0.10" },
  { id: "nano-banana-pro-edit", displayName: "Nano Banana Pro Edit", endpoint: "edit", paid: true, price: "$0.18" },
];

/** Combined list, useful for the curated FALLBACK_IMAGE_MODELS spread. */
export const VENICE_IMAGE_MODELS: VeniceModelMeta[] = [
  ...VENICE_EDIT_MODELS,
  ...VENICE_GENERATE_MODELS,
];

export const VENICE_MODEL_INDEX: Map<string, VeniceModelMeta> = new Map(
  VENICE_IMAGE_MODELS.map((m) => [m.id, m]),
);

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
    "Two image systems: text-to-image (/images/generations, 24 models) and image-to-image edit (/image/edit, 13 models including the uncensored qwen-edit).",
  modelPatterns: VENICE_IMAGE_MODELS.map((m) => new RegExp(`^${m.id}$`, "i")),
  implemented: true,
  // Provider-level default; per-model truth is in VENICE_MODEL_INDEX
  // (every edit-endpoint model is reference-capable).
  supportsReferenceImage: false,

  async generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Venice API key not configured. Add it in Settings.");
    }
    const meta = VENICE_MODEL_INDEX.get(model);
    if (!meta) {
      throw new Error(`Unknown Venice model "${model}".`);
    }

    if (meta.endpoint === "edit") {
      // ── /v1/image/edit
      const ref = options.referenceImages?.[0];
      if (!ref) {
        throw new Error(
          `${meta.displayName} is an edit model — it requires a reference image. Upload a base image on the character or switch to a Generate model.`,
        );
      }
      // Strip a data: URL prefix if present — Venice expects RAW base64.
      const rawBase64 = ref.data.startsWith("data:")
        ? ref.data.replace(/^data:[^;]+;base64,/, "")
        : ref.data;
      const mt = (ref.mimeType || "").toLowerCase();
      if (mt && !/^image\/(jpe?g|png|webp|heif|heic|avif)$/.test(mt)) {
        throw new Error(
          `Reference image format ${mt} is not supported by Venice edit. Use JPEG, PNG, WEBP, HEIF, HEIC, or AVIF.`,
        );
      }
      const body = {
        model: meta.id,
        prompt: options.prompt,
        image: rawBase64,
        safe_mode: options.safeMode === true,
      };
      const res = await fetch("https://api.venice.ai/api/v1/image/edit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Venice edit error ${res.status}: ${text.slice(0, 400) || "unknown"}`);
      }
      const data = (await res.json()) as { images?: string[] };
      const first = data.images?.[0];
      if (!first) throw new Error("Venice edit returned no image data.");
      return {
        imageDataUrl: first.startsWith("data:") ? first : `data:image/webp;base64,${first}`,
        modelUsed: model,
        provider: "venice",
      };
    }

    // ── /v1/images/generations  (OpenAI-compatible)
    const body = {
      model: meta.id,
      prompt: options.prompt,
      size: aspectToSize(options.aspectRatio),
      response_format: "b64_json",
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
      throw new Error(`Venice generate error ${res.status}: ${text.slice(0, 400) || "unknown"}`);
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
    throw new Error("Venice generate returned no image data.");
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

/** Returns true when the model id is one of Venice's image models (either system). */
export function isVeniceImageModel(modelId: string): boolean {
  return VENICE_MODEL_INDEX.has(modelId);
}

/**
 * True when the chosen Venice model uses the /image/edit endpoint (and
 * therefore accepts a reference image). Used by the route to decide
 * whether to load the character's base image into options.referenceImages.
 */
export function veniceModelSupportsRef(modelId: string): boolean {
  return VENICE_MODEL_INDEX.get(modelId)?.endpoint === "edit";
}
