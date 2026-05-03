import { NextRequest, NextResponse } from "next/server";
import { getModelsDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { getProviderForModel, FALLBACK_IMAGE_MODELS, PROVIDERS } from "@/lib/providers";

/**
 * Patterns used to filter the shared `ai_models_db.models` collection
 * down to image-generation models. The collection contains 700+ models
 * across many capabilities, so we either rely on a `capabilities` field
 * (when present) or fall back to a name pattern match.
 */
const IMAGE_GEN_NAME_PATTERNS = [
  /gemini.*image/i,
  /gemini.*flash/i,
  /imagen/i,
  /dall-?e/i,
  /gpt.*image/i,
  /stable.?diffusion/i,
  /sdxl/i,
  /sd3/i,
  /flux/i,
  /ideogram/i,
  /recraft/i,
  /firefly/i,
  /kandinsky/i,
  /playground.*v\d/i,
  /midjourney/i,
];

interface ModelDoc {
  _id?: unknown;
  name?: string;
  id?: string;
  model_id?: string;
  provider?: string;
  capabilities?: string[] | string;
  modalities?: string[] | string;
  category?: string;
  type?: string;
  description?: string;
}

function looksLikeImageGen(doc: ModelDoc): boolean {
  const name = String(doc.name || doc.id || doc.model_id || "");
  if (!name) return false;
  if (IMAGE_GEN_NAME_PATTERNS.some((rx) => rx.test(name))) return true;
  const caps = Array.isArray(doc.capabilities)
    ? doc.capabilities
    : doc.capabilities
      ? [doc.capabilities]
      : [];
  const mods = Array.isArray(doc.modalities)
    ? doc.modalities
    : doc.modalities
      ? [doc.modalities]
      : [];
  const haystack = [...caps, ...mods, doc.category, doc.type]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(" ");
  return /image[-_ ]?gen|text[-_ ]?to[-_ ]?image|t2i|image[-_ ]?out/.test(haystack);
}

/**
 * GET /api/models
 * Query params:
 *   - provider: filter by provider id (matches the provider derived from
 *     the model id; falls back to doc.provider when present)
 *   - q: free-text substring filter on the model name
 *
 * Returns a normalised list of image-generation models from the shared
 * ai_models_db. Falls back to a curated FALLBACK_IMAGE_MODELS list when
 * the registry is empty or unreachable.
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const url = req.nextUrl;
    const providerFilter = url.searchParams.get("provider");
    const q = (url.searchParams.get("q") || "").toLowerCase();

    let normalised: Array<{
      id: string;
      name: string;
      provider: string;
      provider_implemented: boolean;
      description?: string;
    }> = [];
    let usedFallback = false;

    try {
      const db = await getModelsDb();
      const docs = (await db.collection<ModelDoc>("models").find({}).limit(2000).toArray()).filter(
        looksLikeImageGen,
      );
      normalised = docs.map((d) => {
        const id = String(d.id || d.model_id || d.name || "");
        const providerFromMatch = getProviderForModel(id)?.id;
        const provider =
          providerFromMatch ||
          (typeof d.provider === "string" ? d.provider.toLowerCase() : "") ||
          "unknown";
        return {
          id,
          name: String(d.name || id),
          provider,
          provider_implemented:
            PROVIDERS.find((p) => p.id === provider)?.implemented ?? false,
          description: d.description,
        };
      });
    } catch (err) {
      console.warn("ai_models_db not reachable, using fallback list:", err);
    }

    if (normalised.length === 0) {
      usedFallback = true;
      normalised = FALLBACK_IMAGE_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        provider_implemented:
          PROVIDERS.find((p) => p.id === m.provider)?.implemented ?? false,
      }));
    }

    let filtered = normalised;
    if (providerFilter) filtered = filtered.filter((m) => m.provider === providerFilter);
    if (q) {
      filtered = filtered.filter(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    }

    // De-duplicate by id while preserving first occurrence (registry might list duplicates).
    const seen = new Set<string>();
    const out = filtered.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    return NextResponse.json({ models: out, used_fallback: usedFallback });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/models error:", error);
    return NextResponse.json({ error: "Failed to list models" }, { status: 500 });
  }
}
