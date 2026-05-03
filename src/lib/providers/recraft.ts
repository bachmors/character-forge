import type { ImageProvider } from ".";

/**
 * Recraft provider — PLACEHOLDER.
 *
 * To implement:
 *   - POST https://external.api.recraft.ai/v1/images/generations with
 *     { prompt, model: "recraftv3", style, size }. Header:
 *     Authorization: Bearer <apiKey>.
 *   - Strong vector-style and brand-styled outputs.
 */
export const recraft: ImageProvider = {
  id: "recraft",
  name: "Recraft",
  description: "Recraft v3. Vector-friendly outputs and brand-style controls.",
  modelPatterns: [/^recraft/i],
  implemented: false,

  async generateImage() {
    throw new Error("Recraft provider not yet implemented. See providers/recraft.ts for spec.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      const res = await fetch("https://external.api.recraft.ai/v1/users/me", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
