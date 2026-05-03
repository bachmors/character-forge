import { GoogleGenAI } from "@google/genai";
import type { ImageProvider, GenerationOptions, GenerationResult } from ".";

/**
 * Google Gemini image-generation provider.
 *
 * Currently the only fully-implemented provider. Extracted from the
 * inline call inside /api/generate/gemini so the rest of the providers
 * can mirror this surface as they come online.
 */
export const gemini: ImageProvider = {
  id: "google",
  name: "Google (Gemini)",
  description: "Gemini 2.0/3.x image generation models. Multi-image input for identity reference.",
  modelPatterns: [
    /^gemini.*image/i,
    /^gemini.*flash.*image/i,
    /^gemini-2\.0-flash-preview-image-generation$/i,
    /^gemini-3\.1-flash-image/i,
  ],
  implemented: true,
  // Gemini's multimodal endpoint takes inlineData parts so we can pass
  // the character's reference image alongside the prompt for identity
  // preservation.
  supportsReferenceImage: true,

  async generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult> {
    const ai = new GoogleGenAI({ apiKey });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    for (const ref of options.referenceImages || []) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    }
    parts.push({ text: options.prompt });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          aspectRatio: (options.aspectRatio || "1:1") as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          imageSize: (options.imageSize || "1K") as any,
        },
      },
    });

    const candidates = response.candidates || [];
    if (candidates.length === 0) throw new Error("No response from Gemini");

    const responseParts = candidates[0].content?.parts || [];
    let imageData: string | null = null;
    let mimeType = "image/png";
    let textResponse = "";
    for (const p of responseParts) {
      if (p.inlineData?.data) {
        imageData = p.inlineData.data as string;
        mimeType = (p.inlineData.mimeType as string) || "image/png";
      }
      if (p.text) textResponse += p.text;
    }
    if (!imageData) throw new Error("Gemini did not generate an image");

    return {
      imageDataUrl: `data:${mimeType};base64,${imageData}`,
      textResponse,
      modelUsed: model,
      provider: "google",
    };
  },

  async testConnection(apiKey: string): Promise<{ ok: boolean; error?: string }> {
    if (!apiKey || !apiKey.trim()) return { ok: false, error: "No API key" };
    // Lightweight reachability check: list models.
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};
