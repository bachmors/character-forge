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
      defaultModel: session.defaultModel || "gemini",
      hasKeys: {
        googleAi: !!keys.googleAi,
        openAi: !!keys.openAi,
        replicate: !!keys.replicate,
        stabilityAi: !!keys.stabilityAi,
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

    await session.save();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
