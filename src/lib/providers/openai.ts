import type { ImageProvider } from ".";

/**
 * OpenAI image-generation provider — PLACEHOLDER.
 *
 * To implement:
 *   - DALL·E 3 path: POST https://api.openai.com/v1/images/generations
 *     body: { model: "dall-e-3", prompt, n: 1, size: "1024x1024", response_format: "b64_json" }
 *   - GPT-image-1 path: same endpoint, model: "gpt-image-1". Supports
 *     mask/edit + multi-image reference via /v1/images/edits and the
 *     newer "input_images" field.
 *   - Headers: Authorization: Bearer <apiKey>, OpenAI-Organization (opt).
 *   - Map our aspectRatio to size: "1024x1024" | "1792x1024" | "1024x1792".
 *   - Convert returned b64_json to a data URL with mimeType image/png.
 */
export const openai: ImageProvider = {
  id: "openai",
  name: "OpenAI",
  description: "DALL·E 3, GPT-image-1. Strong text rendering, photographic style.",
  modelPatterns: [/^dall-?e-?\d/i, /^gpt-image/i, /^gpt-4o.*image/i],
  implemented: false,
  // DALL·E 3 is text-to-image; gpt-image-1 supports image edits via
  // /v1/images/edits, but our generation flow only uses
  // /v1/images/generations for now. Flip to true once the edit path is wired.
  supportsReferenceImage: false,

  async generateImage() {
    throw new Error("OpenAI provider not yet implemented. See providers/openai.ts for spec.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
