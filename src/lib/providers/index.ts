/**
 * Provider registry for image-generation models.
 *
 * Adding a new provider is two steps:
 *   1. Create src/lib/providers/<name>.ts implementing ImageProvider.
 *   2. Import + register it in PROVIDERS below.
 *
 * The Settings panel and the Generate panel discover providers via this
 * registry, so new entries appear in the UI automatically.
 */

import { gemini } from "./gemini";
import { openai } from "./openai";
import { stability } from "./stability";
import { flux } from "./flux";
import { ideogram } from "./ideogram";
import { anthropic } from "./anthropic";
import { replicate } from "./replicate";
import { recraft } from "./recraft";
import { venice } from "./venice";

export interface ReferenceImage {
  /** base64-encoded image data without the data: URL prefix */
  data: string;
  mimeType: string;
}

export interface GenerationOptions {
  prompt: string;
  referenceImages?: ReferenceImage[];
  /** Aspect ratio hint: "1:1" | "16:9" | "3:2" | "9:16" | "4:3" — providers map this to native flags */
  aspectRatio?: string;
  imageSize?: string;
  /**
   * Venice-specific. False (default) disables content filtering for
   * uncensored models. The route reads it from session.veniceSafeMode
   * and forwards it here.
   */
  safeMode?: boolean;
}

export interface GenerationResult {
  /** Full data URL (data:<mime>;base64,<data>) */
  imageDataUrl: string;
  textResponse?: string;
  modelUsed: string;
  provider: string;
}

export interface ImageProvider {
  /** Stable id, used in storage and routing (e.g. "google", "openai") */
  id: string;
  /** Display name */
  name: string;
  /** Short tagline for the settings UI */
  description: string;
  /** Patterns a model id should match for this provider's image-gen models */
  modelPatterns: RegExp[];
  /** Whether generateImage is wired up; false ⇒ placeholder (Settings shows "soon") */
  implemented: boolean;
  generateImage(
    apiKey: string,
    model: string,
    options: GenerationOptions,
  ): Promise<GenerationResult>;
  /** Cheap/lightweight call used by the Test Connection button */
  testConnection(apiKey: string): Promise<{ ok: boolean; error?: string }>;
}

export const PROVIDERS: ImageProvider[] = [
  gemini,
  venice,
  openai,
  stability,
  flux,
  ideogram,
  anthropic,
  replicate,
  recraft,
];

export function getProvider(id: string): ImageProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Returns the provider whose modelPatterns match the given model id, if any. */
export function getProviderForModel(modelId: string): ImageProvider | undefined {
  return PROVIDERS.find((p) => p.modelPatterns.some((rx) => rx.test(modelId)));
}

export interface CuratedModel {
  id: string;
  provider: string;
  name: string;
  uncensored?: boolean;
}

/**
 * Curated list of image-generation models. Used in two places:
 *   1. Always merged into /api/models so models from implemented
 *      providers (Gemini, Venice) show up regardless of what the
 *      shared ai_models_db registry contains.
 *   2. As the sole result when the registry is empty / unreachable.
 */
export const FALLBACK_IMAGE_MODELS: CuratedModel[] = [
  { id: "gemini-3.1-flash-image-preview", provider: "google", name: "Gemini 3.1 Flash (image preview)" },
  { id: "gemini-2.0-flash-preview-image-generation", provider: "google", name: "Gemini 2.0 Flash (image preview)" },
  { id: "dall-e-3", provider: "openai", name: "DALL·E 3" },
  { id: "gpt-image-1", provider: "openai", name: "GPT-image-1" },
  { id: "stable-diffusion-xl", provider: "stability", name: "Stable Diffusion XL" },
  { id: "sd3-medium", provider: "stability", name: "Stable Diffusion 3 Medium" },
  { id: "sd3.5-large", provider: "stability", name: "Stable Diffusion 3.5 Large" },
  { id: "flux-1.1-pro", provider: "flux", name: "FLUX 1.1 Pro" },
  { id: "flux-kontext-pro", provider: "flux", name: "FLUX Kontext Pro" },
  { id: "ideogram-v3", provider: "ideogram", name: "Ideogram v3" },
  { id: "recraft-v3", provider: "recraft", name: "Recraft v3" },
  // Venice — full image-generation lineup (9 models). Uncensored ones
  // are explicitly flagged so the UI can badge them.
  { id: "flux-dev-uncensored", provider: "venice", name: "FLUX Dev Uncensored (Venice)", uncensored: true },
  { id: "flux-dev", provider: "venice", name: "FLUX Dev (Venice)" },
  { id: "fluently-xl", provider: "venice", name: "Fluently XL (Venice)" },
  { id: "grok-imagine-image", provider: "venice", name: "Grok Imagine (Venice)", uncensored: true },
  { id: "venice-sd35", provider: "venice", name: "Stable Diffusion 3.5 (Venice)" },
  { id: "qwen-image-2", provider: "venice", name: "Qwen Image v2 (Venice)" },
  { id: "gpt-image-2", provider: "venice", name: "GPT Image 2 (Venice)" },
  { id: "nano-banana-pro", provider: "venice", name: "Nano Banana Pro (Venice)" },
  { id: "nano-banana-2", provider: "venice", name: "Nano Banana v2 (Venice)" },
];

/** Look up the curated metadata for a model id (used for the uncensored flag). */
export function getCuratedModel(id: string): CuratedModel | undefined {
  return FALLBACK_IMAGE_MODELS.find((m) => m.id === id);
}
