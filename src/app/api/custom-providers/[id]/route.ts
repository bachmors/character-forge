import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import {
  buildAuthHeaders,
  decryptKey,
  encryptKey,
  type CustomAuthType,
} from "@/lib/customProviders";

async function loadOwned(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  userId: string,
) {
  return db.collection("custom_providers").findOne({
    _id: new ObjectId(id),
    user_id: new ObjectId(userId),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const existing = await loadOwned(db, params.id, user._id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (typeof body.providerName === "string") update.providerName = body.providerName.trim();
    if (typeof body.baseUrl === "string")
      update.baseUrl = body.baseUrl.trim().replace(/\/$/, "");
    if (typeof body.apiKey === "string") {
      // Empty string clears the key; null leaves it untouched.
      update.apiKeyEnc = body.apiKey ? encryptKey(body.apiKey) : null;
    }
    if (typeof body.apiFormat === "string") update.apiFormat = body.apiFormat;
    if (typeof body.imageEndpoint === "string") update.imageEndpoint = body.imageEndpoint;
    if (typeof body.authType === "string") update.authType = body.authType;
    if (body.authHeaderName !== undefined) update.authHeaderName = body.authHeaderName || null;
    if (typeof body.supportsReferenceImage === "boolean")
      update.supportsReferenceImage = body.supportsReferenceImage;
    if (Array.isArray(body.models)) update.models = body.models;

    const result = await db
      .collection("custom_providers")
      .findOneAndUpdate(
        { _id: existing._id },
        { $set: update },
        { returnDocument: "after" },
      );
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Strip apiKeyEnc from response.
    return NextResponse.json({
      ...result,
      apiKeyEnc: undefined,
      has_key: Boolean(result.apiKeyEnc),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/custom-providers/[id] error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const result = await db.collection("custom_providers").deleteOne({
      _id: new ObjectId(params.id),
      user_id: new ObjectId(user._id),
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/custom-providers/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

/**
 * POST /api/custom-providers/[id]
 * Action endpoint — body: { action: "test" }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const existing = await loadOwned(db, params.id, user._id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();

    if (body.action === "test") {
      const apiKey = decryptKey(existing.apiKeyEnc);
      const headers = buildAuthHeaders(
        existing.authType as CustomAuthType,
        apiKey,
        existing.authHeaderName,
      );
      try {
        // No standard "is alive" endpoint across all custom providers, so
        // we hit /models if it looks OpenAI-compatible, else just hit the
        // base URL with HEAD.
        const probe =
          existing.apiFormat === "openai"
            ? `${existing.baseUrl}/models`
            : existing.baseUrl;
        const res = await fetch(probe, { headers });
        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            error: `HTTP ${res.status}`,
          });
        }
        return NextResponse.json({ ok: true });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          error: err instanceof Error ? err.message : "Network error",
        });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/custom-providers/[id] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
