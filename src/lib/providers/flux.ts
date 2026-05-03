import type { ImageProvider } from ".";

/**
 * Black Forest Labs (FLUX) provider — PLACEHOLDER.
 *
 * To implement:
 *   - POST https://api.bfl.ai/v1/flux-1.1-pro (or flux-kontext-pro) with
 *     { prompt, width, height, prompt_upsampling, seed }. Header:
 *     X-Key: <apiKey>. Returns a polling endpoint; poll until status=Ready
 *     then read the signed URL and fetch the image.
 *   - Reference images: flux-kontext supports init_image input.
 *   - Strong identity preservation makes FLUX a natural second target
 *     after Gemini for this app.
 */
export const flux: ImageProvider = {
  id: "flux",
  name: "Black Forest Labs (FLUX)",
  description: "FLUX 1.1 Pro, FLUX Kontext. Photorealistic detail, strong identity preservation.",
  modelPatterns: [/^flux/i, /^bfl/i],
  implemented: false,

  async generateImage() {
    throw new Error("FLUX provider not yet implemented. See providers/flux.ts for spec.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    // bfl.ai doesn't expose a "list models" endpoint; do a HEAD against the API root.
    try {
      const res = await fetch("https://api.bfl.ai/v1/health", {
        headers: { "X-Key": apiKey },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
