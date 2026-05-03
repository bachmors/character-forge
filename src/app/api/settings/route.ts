import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    // Return masked keys (only show last 4 chars)
    const keys = session.apiKeys || {};
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(keys)) {
      if (value) {
        masked[key] = "••••" + value.slice(-4);
      }
    }
    return NextResponse.json({
      apiKeys: masked,
      defaultModel: session.defaultModel || "gemini-3.1-flash-image-preview",
      favoriteModels: session.favoriteModels || [],
      veniceSafeMode: session.veniceSafeMode === true,
      hasKeys: {
        googleAi: !!keys.googleAi,
        openAi: !!keys.openAi,
        replicate: !!keys.replicate,
        stabilityAi: !!keys.stabilityAi,
        google: !!keys.google,
        anthropic: !!keys.anthropic,
        openai: !!keys.openai,
        stability: !!keys.stability,
        flux: !!keys.flux,
        ideogram: !!keys.ideogram,
        recraft: !!keys.recraft,
        venice: !!keys.venice,
      },
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getSession();

    if (body.apiKeys) {
      const currentKeys = session.apiKeys || {};
      // Only update keys that are provided and not masked
      for (const [key, value] of Object.entries(body.apiKeys)) {
        if (typeof value === "string" && value && !value.startsWith("••••")) {
          (currentKeys as Record<string, string>)[key] = value;
        }
      }
      session.apiKeys = currentKeys;
    }

    if (body.defaultModel) {
      session.defaultModel = body.defaultModel;
    }
    if (Array.isArray(body.favoriteModels)) {
      session.favoriteModels = body.favoriteModels.filter((x: unknown) => typeof x === "string");
    }
    if (typeof body.veniceSafeMode === "boolean") {
      session.veniceSafeMode = body.veniceSafeMode;
    }

    await session.save();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
