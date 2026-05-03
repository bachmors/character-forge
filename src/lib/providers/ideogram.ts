import type { ImageProvider } from ".";

/**
 * Ideogram provider — PLACEHOLDER.
 *
 * To implement:
 *   - POST https://api.ideogram.ai/generate with multipart form-data:
 *     prompt, aspect_ratio, model=V_3, magic_prompt=AUTO. Header:
 *     Api-Key: <apiKey>.
 *   - Strong text-in-image rendering; less identity preservation.
 */
export const ideogram: ImageProvider = {
  id: "ideogram",
  name: "Ideogram",
  description: "Ideogram v2 / v3. Best-in-class text rendering inside images.",
  modelPatterns: [/^ideogram/i],
  implemented: false,

  async generateImage() {
    throw new Error("Ideogram provider not yet implemented. See providers/ideogram.ts for spec.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    // No standard auth-only endpoint; treat any non-empty key as plausibly valid.
    return { ok: true };
  },
};
