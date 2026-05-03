import type { ImageProvider } from ".";

/**
 * Stability AI provider — PLACEHOLDER.
 *
 * To implement:
 *   - SD3 path: POST https://api.stability.ai/v2beta/stable-image/generate/sd3
 *     multipart form-data: model (sd3-medium / sd3.5-large), prompt,
 *     aspect_ratio, output_format=png. Headers: Authorization: Bearer <key>,
 *     Accept: image/* for direct image bytes.
 *   - SDXL path: POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image
 *   - Reference images: image-to-image endpoint at
 *     /v2beta/stable-image/control/style with init_image multipart field.
 */
export const stability: ImageProvider = {
  id: "stability",
  name: "Stability AI",
  description: "Stable Diffusion XL, SD3, SD3.5. Open ecosystem, strong control.",
  modelPatterns: [/^stable.?diffusion/i, /^sdxl/i, /^sd3(\.\d+)?/i, /^sd-?xl/i],
  implemented: false,
  // Stability's image-to-image endpoint exists but we currently scaffold
  // text-to-image only.
  supportsReferenceImage: false,

  async generateImage() {
    throw new Error("Stability provider not yet implemented. See providers/stability.ts for spec.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      const res = await fetch("https://api.stability.ai/v1/user/account", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
