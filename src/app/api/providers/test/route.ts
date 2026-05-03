import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import { getUserApiKey } from "@/lib/userSettings";

/**
 * POST /api/providers/test
 * Body: { provider: "google" | "venice" | ..., apiKey?: string }
 *
 * If apiKey is supplied, tests it directly without persisting. Otherwise
 * tests the key already stored for the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { provider: id, apiKey } = await req.json();
    const def = getProvider(id);
    if (!def) {
      return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
    }

    let key = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "";
    if (!key) {
      const stored = await getUserApiKey(user._id, id);
      if (stored) key = stored;
    }
    if (!key) return NextResponse.json({ ok: false, error: "No API key configured" });

    const result = await def.testConnection(key);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/providers/test error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 },
    );
  }
}
