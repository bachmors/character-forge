import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers";
import { getUserSettings } from "@/lib/userSettings";

/**
 * GET /api/providers
 * Returns the registered providers with a per-user has_key flag derived
 * from the MongoDB-backed user_settings collection. Keys themselves are
 * never returned.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getUserSettings(user._id);
    const result = PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      implemented: p.implemented,
      supports_reference_image: p.supportsReferenceImage,
      has_key: settings.has_keys[p.id] === true,
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
