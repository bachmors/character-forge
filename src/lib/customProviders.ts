/**
 * Shared types and a tiny secret-obfuscation helper for user-defined
 * "custom providers" (Item 4).
 *
 * NOTE on storage: this stores API keys in MongoDB so they sync across
 * devices for the same logged-in user. We obfuscate at-rest with a
 * SESSION_SECRET-derived XOR cipher to avoid plain-text storage —
 * proper at-rest encryption (e.g. KMS/HSM) is a larger follow-up.
 */

import { createHash, createHmac } from "crypto";

export type CustomAuthType = "bearer" | "header" | "none";
export type CustomApiFormat = "openai" | "custom";
export type CustomModelType = "image" | "text" | "vision";

export interface CustomModel {
  modelId: string;
  displayName: string;
  type: CustomModelType;
  defaultParams: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
}

export interface CustomProviderDoc {
  _id?: unknown;
  user_id: unknown;
  providerName: string;
  baseUrl: string;
  /** Stored obfuscated; round-tripped via decryptKey/encryptKey. */
  apiKeyEnc: string | null;
  apiFormat: CustomApiFormat;
  imageEndpoint: string;
  authType: CustomAuthType;
  authHeaderName: string | null;
  /** Whether this provider's image generation accepts a reference image. */
  supportsReferenceImage?: boolean;
  models: CustomModel[];
  created_at: Date;
  updated_at: Date;
}

const SECRET = process.env.SESSION_SECRET || "fallback-key-change-me-at-least-32-chars";

function deriveKey(seed: string): Buffer {
  return createHash("sha256").update(seed).digest();
}

/** XOR-cipher with a SHA-256-derived key. Reversible via the same call. */
function xor(input: Buffer, key: Buffer): Buffer {
  const out = Buffer.alloc(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] ^ key[i % key.length];
  return out;
}

export function encryptKey(plaintext: string): string {
  if (!plaintext) return "";
  const key = deriveKey(SECRET);
  const ct = xor(Buffer.from(plaintext, "utf8"), key);
  // hmac so we can detect tampering on read.
  const tag = createHmac("sha256", key).update(ct).digest("hex").slice(0, 16);
  return `v1:${tag}:${ct.toString("base64")}`;
}

export function decryptKey(stored: string | null): string {
  if (!stored) return "";
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return "";
  const key = deriveKey(SECRET);
  const ct = Buffer.from(parts[2], "base64");
  const expectedTag = createHmac("sha256", key).update(ct).digest("hex").slice(0, 16);
  if (expectedTag !== parts[1]) return "";
  return xor(ct, key).toString("utf8");
}

/**
 * Build the auth headers used to call the custom provider's endpoint.
 */
export function buildAuthHeaders(
  authType: CustomAuthType,
  apiKey: string,
  customHeaderName?: string | null,
): Record<string, string> {
  if (!apiKey || authType === "none") return {};
  if (authType === "bearer") return { Authorization: `Bearer ${apiKey}` };
  if (authType === "header" && customHeaderName) return { [customHeaderName]: apiKey };
  return {};
}

/**
 * Parse a custom-provider image-generation response into a data URL.
 * Tries OpenAI ({data:[{b64_json|url}]}), Stability/SD ({images:[…]}),
 * and direct base64 / data-URL strings.
 */
export async function parseImageResponse(res: Response): Promise<{
  imageDataUrl: string;
  textResponse?: string;
}> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Provider returned HTTP ${res.status}: ${text.slice(0, 400) || "unknown"}`);
  }

  const contentType = res.headers.get("content-type") || "";
  // Some providers return a raw image stream (binary).
  if (contentType.startsWith("image/")) {
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return { imageDataUrl: `data:${contentType};base64,${b64}` };
  }

  const data = (await res.json()) as Record<string, unknown>;

  const candidates: Array<unknown> = [];
  if (Array.isArray((data as { data?: unknown[] }).data)) candidates.push(...(data.data as unknown[]));
  if (Array.isArray((data as { images?: unknown[] }).images))
    candidates.push(...(data.images as unknown[]));
  if (Array.isArray((data as { artifacts?: unknown[] }).artifacts))
    candidates.push(...(data.artifacts as unknown[])); // Stability format

  for (const c of candidates) {
    if (typeof c === "string") {
      return {
        imageDataUrl: c.startsWith("data:") ? c : `data:image/png;base64,${c}`,
      };
    }
    if (c && typeof c === "object") {
      const obj = c as Record<string, unknown>;
      if (typeof obj.b64_json === "string") {
        return { imageDataUrl: `data:image/png;base64,${obj.b64_json}` };
      }
      if (typeof obj.base64 === "string") {
        return { imageDataUrl: `data:image/png;base64,${obj.base64}` };
      }
      if (typeof obj.url === "string") {
        const imgRes = await fetch(obj.url);
        if (!imgRes.ok) throw new Error(`Failed to fetch generated image url: ${imgRes.status}`);
        const buf = await imgRes.arrayBuffer();
        const mime = imgRes.headers.get("content-type") || "image/png";
        return {
          imageDataUrl: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
        };
      }
    }
  }

  throw new Error("Could not parse an image from the provider response.");
}
