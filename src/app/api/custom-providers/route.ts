import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import {
  encryptKey,
  type CustomApiFormat,
  type CustomAuthType,
  type CustomModel,
} from "@/lib/customProviders";

interface PostBody {
  providerName: string;
  baseUrl: string;
  apiKey?: string;
  apiFormat?: CustomApiFormat;
  imageEndpoint?: string;
  authType?: CustomAuthType;
  authHeaderName?: string | null;
  supportsReferenceImage?: boolean;
  models?: Array<Partial<CustomModel> & { modelId: string; displayName: string }>;
}

/**
 * GET /api/custom-providers
 * Lists the user's custom providers. API keys are NEVER returned — the
 * has_key flag tells the UI whether to show the masked-input state.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    const docs = await db
      .collection("custom_providers")
      .find({ user_id: new ObjectId(user._id) })
      .sort({ updated_at: -1 })
      .toArray();
    return NextResponse.json(
      docs.map((d) => ({
        _id: d._id,
        providerName: d.providerName,
        baseUrl: d.baseUrl,
        has_key: Boolean(d.apiKeyEnc),
        apiFormat: d.apiFormat,
        imageEndpoint: d.imageEndpoint,
        authType: d.authType,
        authHeaderName: d.authHeaderName,
        supportsReferenceImage: d.supportsReferenceImage === true,
        models: d.models || [],
        created_at: d.created_at,
        updated_at: d.updated_at,
      })),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/custom-providers error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/custom-providers
 * Body: { providerName, baseUrl, apiKey?, apiFormat?, imageEndpoint?,
 *         authType?, authHeaderName?, models? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as PostBody;
    if (!body.providerName?.trim() || !body.baseUrl?.trim()) {
      return NextResponse.json(
        { error: "providerName and baseUrl are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const now = new Date();
    const doc = {
      user_id: new ObjectId(user._id),
      providerName: body.providerName.trim(),
      baseUrl: body.baseUrl.trim().replace(/\/$/, ""),
      apiKeyEnc: body.apiKey ? encryptKey(body.apiKey) : null,
      apiFormat: (body.apiFormat || "openai") as CustomApiFormat,
      imageEndpoint: body.imageEndpoint || "/images/generations",
      authType: (body.authType || "bearer") as CustomAuthType,
      authHeaderName: body.authHeaderName || null,
      supportsReferenceImage: body.supportsReferenceImage === true,
      models: (body.models || []).map((m) => ({
        modelId: m.modelId,
        displayName: m.displayName,
        type: m.type || "image",
        defaultParams: m.defaultParams || {},
        enabled: m.enabled ?? true,
        createdAt: now,
      })),
      created_at: now,
      updated_at: now,
    };
    const result = await db.collection("custom_providers").insertOne(doc);
    return NextResponse.json({ _id: result.insertedId, ...doc, apiKeyEnc: undefined }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/custom-providers error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
