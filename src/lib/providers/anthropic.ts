import type { ImageProvider } from ".";

/**
 * Anthropic (Claude) provider — PLACEHOLDER.
 *
 * Note: Claude does NOT generate images. It's listed here for the
 * "image understanding" pathway (analyse a reference image and emit a
 * structured description) and for parity with the other providers in
 * the Settings panel. generateImage() will always throw — this provider
 * exposes only testConnection to validate the API key.
 */
export const anthropic: ImageProvider = {
  id: "anthropic",
  name: "Anthropic (Claude)",
  description: "Claude understands images but does not generate them — used for analysis paths.",
  modelPatterns: [/^claude.*image/i],
  implemented: false,

  async generateImage() {
    throw new Error(
      "Anthropic Claude does not generate images. Use it for image understanding instead.",
    );
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
