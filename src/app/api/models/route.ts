import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, getModelsDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import {
  getProviderForModel,
  FALLBACK_IMAGE_MODELS,
  PROVIDERS,
  getCuratedModel,
} from "@/lib/providers";

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
      is_custom?: boolean;
      custom_provider_id?: string;
      uncensored?: boolean;
    }> = [];
    let usedFallback = false;

    // Always seed the result with curated models from IMPLEMENTED providers
    // so Venice/Gemini are visible regardless of whether the shared
    // ai_models_db registry happens to contain them. The registry merge
    // below de-dupes by id, so registry entries can still override the
    // names we use here.
    for (const m of FALLBACK_IMAGE_MODELS) {
      const provider = PROVIDERS.find((p) => p.id === m.provider);
      if (!provider?.implemented) continue;
      normalised.push({
        id: m.id,
        name: m.name,
        provider: m.provider,
        provider_implemented: true,
        uncensored: m.uncensored,
      });
    }

    // User-defined custom-provider models always live alongside the
    // registry models, marked with is_custom=true so the UI can badge them.
    try {
      const user = await requireUser();
      const charDb = await getDb();
      const customProviders = await charDb
        .collection("custom_providers")
        .find({ user_id: new ObjectId(user._id) })
        .toArray();
      for (const cp of customProviders) {
        for (const m of (cp.models as Array<{
          modelId: string;
          displayName: string;
          type: string;
          enabled?: boolean;
        }>) || []) {
          if (m.enabled === false) continue;
          if (m.type !== "image") continue;
          normalised.push({
            id: m.modelId,
            name: `${m.displayName} (${cp.providerName})`,
            provider: `custom:${cp._id}`,
            provider_implemented: true,
            is_custom: true,
            custom_provider_id: String(cp._id),
          });
        }
      }
    } catch {
      // requireUser was already called above; if we get here it's just a
      // DB issue — keep going with built-in registry results only.
    }

    try {
      const db = await getModelsDb();
      const docs = (await db.collection<ModelDoc>("models").find({}).limit(2000).toArray()).filter(
        looksLikeImageGen,
      );
      // Append registry rows to the curated seed; the de-dupe step below
      // keeps the LAST occurrence per id so registry overrides curated.
      const fromRegistry = docs.map((d) => {
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
          // Carry the curated uncensored flag onto registry rows so the UI
          // doesn't lose the badge if the registry shadows a curated model.
          uncensored: getCuratedModel(id)?.uncensored,
        };
      });
      normalised.push(...fromRegistry);
    } catch (err) {
      console.warn("ai_models_db not reachable; relying on curated seed:", err);
    }

    if (normalised.length === 0) {
      usedFallback = true;
      normalised = FALLBACK_IMAGE_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        provider_implemented:
          PROVIDERS.find((p) => p.id === m.provider)?.implemented ?? false,
        uncensored: m.uncensored,
      }));
    }

    let filtered = normalised;
    if (providerFilter) filtered = filtered.filter((m) => m.provider === providerFilter);
    if (q) {
      filtered = filtered.filter(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    }

    // De-duplicate by id, preserving the LAST occurrence so registry rows
    // override the curated seed (and a real entry for "fluently-xl" beats
    // the fallback row of the same id).
    const lastIndex = new Map<string, number>();
    filtered.forEach((m, i) => lastIndex.set(m.id, i));
    const out = filtered.filter((m, i) => lastIndex.get(m.id) === i);

    return NextResponse.json({ models: out, used_fallback: usedFallback });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/models error:", error);
    return NextResponse.json({ error: "Failed to list models" }, { status: 500 });
  }
}
