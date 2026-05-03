import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers";

/**
 * GET /api/providers
 *
 * Returns the list of registered providers and, for each, whether the
 * current user has stored an API key. Keys themselves are not returned —
 * the Settings UI renders a masked placeholder when has_key is true.
 */
export async function GET() {
  try {
    await requireUser();
    const session = await getSession();
    const keys = session.apiKeys || {};

    // Backward-compat: legacy fields map to new provider ids.
    const legacyMap: Record<string, string> = {
      googleAi: "google",
      openAi: "openai",
      replicate: "replicate",
      stabilityAi: "stability",
    };
    const hasKey = (id: string): boolean => {
      if (keys[id]) return true;
      for (const [legacy, newId] of Object.entries(legacyMap)) {
        if (newId === id && keys[legacy]) return true;
      }
      return false;
    };

    const result = PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      implemented: p.implemented,
      has_key: hasKey(p.id),
    }));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/providers error:", error);
    return NextResponse.json({ error: "Failed to list providers" }, { status: 500 });
  }
}
