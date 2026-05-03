import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

/**
 * Scenes collection — narrative-scene library (Module 8). Distinct from the
 * multi_scenes collection used by Duo/Group: scenes carry an action +
 * environment + narrative + cinematography stack and may be linked into a
 * storyboard sequence.
 */

interface PostBody {
  image_url: string;
  prompt_used?: string;
  character_ids: string[];
  params: {
    action: string;
    customAction?: string;
    environment: string;
    customEnvironment?: string;
    narrative?: string;
    aspectRatio: string;
    cinematography?: Record<string, string>;
    artStyle?: string;
  };
  storyboard_id?: string | null;
  order_in_storyboard?: number;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const storyboardId = req.nextUrl.searchParams.get("storyboard_id");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    if (storyboardId) filter.storyboard_id = storyboardId;
    const scenes = await db
      .collection("scenes")
      .find(filter)
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();
    return NextResponse.json(scenes);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/scenes error:", error);
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as PostBody;
    const { image_url, prompt_used, character_ids, params, storyboard_id, order_in_storyboard } = body || {};
    if (!image_url || !Array.isArray(character_ids) || character_ids.length === 0) {
      return NextResponse.json(
        { error: "image_url and at least 1 character_id are required" },
        { status: 400 },
      );
    }
    const db = await getDb();

    // 4 MB guardrail consistent with /api/images.
    if (Buffer.byteLength(image_url, "utf8") > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const doc = {
      user_id: new ObjectId(user._id),
      image_url,
      prompt_used: prompt_used || "",
      model_used: "gemini-3.1-flash-image-preview",
      character_ids: character_ids.map((id) => new ObjectId(id)),
      params,
      storyboard_id: storyboard_id || null,
      order_in_storyboard:
        typeof order_in_storyboard === "number" ? order_in_storyboard : null,
      created_at: new Date(),
    };
    const result = await db.collection("scenes").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/scenes error:", error);
    return NextResponse.json({ error: "Failed to save scene" }, { status: 500 });
  }
}
