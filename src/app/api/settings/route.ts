import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import {
  getUserSettings,
  setUserApiKey,
  setUserSettingValue,
  migrateLegacyKeysIfNeeded,
} from "@/lib/userSettings";

/**
 * Per-user settings (API keys, default model, favorites, Venice safe-mode).
 * Scoped by the authenticated user — different users sharing a browser
 * (or the same user logging out and back in as a different account) are
 * fully isolated. Keys are encrypted at rest in MongoDB.
 *
 * The legacy iron-session apiKeys map is read once on first request to
 * migrate existing users; afterwards iron-session is irrelevant.
 */

export async function GET() {
  try {
    const user = await requireUser();

    // Migrate legacy iron-session keys on first read so existing users
    // don't lose their setup on the upgrade.
    try {
      const session = await getSession();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await migrateLegacyKeysIfNeeded(user._id, session.apiKeys as any);
    } catch {
      // ignore — non-fatal, the user can re-enter the key
    }

    const settings = await getUserSettings(user._id);
    // Build masked display + hasKeys map covering every provider id we
    // know (built-ins + legacy aliases for backward-compat clients).
    const PROVIDER_IDS = [
      "google",
      "venice",
      "openai",
      "anthropic",
      "stability",
      "flux",
      "ideogram",
      "replicate",
      "recraft",
    ];
    const apiKeys: Record<string, string> = {};
    const hasKeys: Record<string, boolean> = {};
    for (const id of PROVIDER_IDS) {
      const has = settings.has_keys[id] === true;
      hasKeys[id] = has;
      if (has) apiKeys[id] = "••••••••";
    }
    // Legacy aliases mirrored to the new ids so older client builds keep working.
    hasKeys.googleAi = hasKeys.google;
    hasKeys.openAi = hasKeys.openai;
    hasKeys.stabilityAi = hasKeys.stability;

    return NextResponse.json({
      apiKeys,
      defaultModel: settings.default_model || "gemini-3.1-flash-image-preview",
      favoriteModels: settings.favorite_models,
      veniceSafeMode: settings.venice_safe_mode,
      hasKeys,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (body.apiKeys && typeof body.apiKeys === "object") {
      // Map legacy ids back to canonical provider ids on the way in.
      const legacyMap: Record<string, string> = {
        googleAi: "google",
        openAi: "openai",
        stabilityAi: "stability",
      };
      for (const [k, value] of Object.entries(body.apiKeys)) {
        if (typeof value !== "string") continue;
        // Empty string clears; masked placeholder leaves it untouched.
        if (value.startsWith("••••")) continue;
        const providerId = legacyMap[k] || k;
        await setUserApiKey(user._id, providerId, value || null);
      }
    }
    if (typeof body.defaultModel === "string" && body.defaultModel.trim()) {
      await setUserSettingValue(user._id, "default_model", body.defaultModel.trim());
    }
    if (Array.isArray(body.favoriteModels)) {
      await setUserSettingValue(
        user._id,
        "favorite_models",
        body.favoriteModels.filter((x: unknown) => typeof x === "string"),
      );
    }
    if (typeof body.veniceSafeMode === "boolean") {
      await setUserSettingValue(user._id, "venice_safe_mode", body.veniceSafeMode);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
