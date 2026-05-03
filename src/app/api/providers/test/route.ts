import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import { getProvider } from "@/lib/providers";

/**
 * POST /api/providers/test
 * Body: { provider: "google" | "openai" | ... , apiKey?: string }
 *
 * If apiKey is supplied, tests that key directly without persisting it.
 * Otherwise tests the key currently stored in the user's session.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { provider: id, apiKey } = await req.json();
    const def = getProvider(id);
    if (!def) {
      return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
    }

    let key = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "";
    if (!key) {
      const session = await getSession();
      const stored = session.apiKeys || {};
      key =
        stored[id] ||
        stored[
          ({
            google: "googleAi",
            openai: "openAi",
            replicate: "replicate",
            stability: "stabilityAi",
          } as Record<string, string>)[id] || ""
        ] ||
        "";
    }
    if (!key) return NextResponse.json({ ok: false, error: "No API key configured" });

    const result = await def.testConnection(key);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/providers/test error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 },
    );
  }
}
