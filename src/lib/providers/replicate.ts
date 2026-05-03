import type { ImageProvider } from ".";

/**
 * Replicate provider — PLACEHOLDER.
 *
 * Replicate hosts many image-generation models behind a single
 * prediction-creation API:
 *   - POST https://api.replicate.com/v1/predictions
 *     { version: "<version_hash>", input: { prompt, ... } }
 *     Header: Authorization: Token <apiKey>
 *     Returns a prediction id; poll its `urls.get` until status=succeeded.
 */
export const replicate: ImageProvider = {
  id: "replicate",
  name: "Replicate",
  description: "Replicate hosts many community models — SDXL, Flux, Kandinsky, etc.",
  modelPatterns: [/^replicate\//i, /^r8\b/i],
  implemented: false,
  // Per-model — many Replicate models accept image inputs. Defaulting to
  // false until the actual generation path is wired model-by-model.
  supportsReferenceImage: false,

  async generateImage() {
    throw new Error("Replicate provider not yet implemented. See providers/replicate.ts for spec.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      const res = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Token ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
