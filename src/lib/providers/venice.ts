import type { ImageProvider, GenerationOptions, GenerationResult } from ".";

/**
 * Venice AI provider — IMPLEMENTED.
 *
 * Venice exposes an OpenAI-compatible image-generation endpoint. Models
 * include fluently-xl (general purpose), flux-dev, and flux-dev-uncensored.
 *
 * Docs: https://docs.venice.ai
 * Endpoint: POST https://api.venice.ai/api/v1/images/generations
 *   {
 *     model: "fluently-xl" | "flux-dev" | "flux-dev-uncensored" | ...,
 *     prompt: string,
 *     width: number,
 *     height: number,
 *     steps?: number,
 *   }
 * Header: Authorization: Bearer <apiKey>
 *
 * Response (OpenAI-compatible): { data: [{ b64_json } | { url }] }
 */

const ASPECT_TO_DIM: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "3:2": { width: 1280, height: 853 },
  "4:3": { width: 1024, height: 768 },
};

export const venice: ImageProvider = {
  id: "venice",
  name: "Venice AI",
  description: "Uncensored image models (fluently-xl, flux-dev, flux-dev-uncensored). OpenAI-compatible API.",
  modelPatterns: [/^fluently/i, /^flux-?dev/i, /^venice/i],
  implemented: true,

  async generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Venice API key not configured. Add it in Settings.");
    }
    const dim = ASPECT_TO_DIM[options.aspectRatio || "1:1"] || ASPECT_TO_DIM["1:1"];

    const res = await fetch("https://api.venice.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: options.prompt,
        width: dim.width,
        height: dim.height,
        steps: 30,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Venice API error ${res.status}: ${text.slice(0, 400) || "unknown"}`);
    }
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      // Some Venice responses use "images" instead of "data"
      images?: Array<string | { b64_json?: string; url?: string }>;
    };

    // Try the OpenAI-compatible shape first.
    const first = data.data?.[0];
    if (first?.b64_json) {
      return {
        imageDataUrl: `data:image/png;base64,${first.b64_json}`,
        modelUsed: model,
        provider: "venice",
      };
    }
    if (first?.url) {
      // Pull the image and inline it as a data URL so the rest of the app
      // can store/serve it the same way as Gemini outputs.
      const imgRes = await fetch(first.url);
      if (!imgRes.ok) throw new Error(`Failed to fetch Venice image url: ${imgRes.status}`);
      const buf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const mime = imgRes.headers.get("content-type") || "image/png";
      return {
        imageDataUrl: `data:${mime};base64,${b64}`,
        modelUsed: model,
        provider: "venice",
      };
    }

    // Fallback: handle "images" array (some providers wrap differently).
    const alt = data.images?.[0];
    if (typeof alt === "string") {
      return {
        imageDataUrl: alt.startsWith("data:") ? alt : `data:image/png;base64,${alt}`,
        modelUsed: model,
        provider: "venice",
      };
    }
    if (alt && typeof alt === "object" && "b64_json" in alt && alt.b64_json) {
      return {
        imageDataUrl: `data:image/png;base64,${alt.b64_json}`,
        modelUsed: model,
        provider: "venice",
      };
    }

    throw new Error("Venice returned no image data in the response.");
  },

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    try {
      // Models endpoint is the cheapest "is this key valid" probe.
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
