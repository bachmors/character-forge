import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import type { StoredSceneParams } from "@/lib/scenes";

interface PostBody {
  image_url: string;
  prompt_used?: string;
  model_used?: string;
  mode: "duo" | "group";
  character_ids: string[];
  params: StoredSceneParams;
}

/**
 * GET /api/multi-scenes
 *
 * Lists multi-character scenes. Accepts an optional ?mode=duo|group filter and
 * an optional ?character_id=X to limit to scenes including a specific character.
 * Owners see all; users see only their own scenes.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const db = await getDb();

    const mode = req.nextUrl.searchParams.get("mode");
    const characterId = req.nextUrl.searchParams.get("character_id");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    if (mode === "duo" || mode === "group") filter.mode = mode;
    if (characterId) filter.character_ids = new ObjectId(characterId);

    const scenes = await db
      .collection("multi_scenes")
      .find(filter)
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();
    return NextResponse.json(scenes);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/multi-scenes error:", error);
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }
}

/**
 * POST /api/multi-scenes
 *
 * Persists a generated multi-character scene. Creates one master document in
 * `multi_scenes` plus one row per participating character in `character_images`
 * so the scene also surfaces in each individual character's gallery (the
 * existing image gallery code renders these without modification).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as PostBody;
    const { image_url, prompt_used, model_used, mode, character_ids, params } = body || {};

    if (!image_url || !Array.isArray(character_ids) || character_ids.length < 2) {
      return NextResponse.json(
        { error: "image_url and at least 2 character_ids are required" },
        { status: 400 },
      );
    }
    if (character_ids.length > 6) {
      return NextResponse.json({ error: "Maximum 6 characters per scene" }, { status: 400 });
    }
    if (mode !== "duo" && mode !== "group") {
      return NextResponse.json({ error: "mode must be 'duo' or 'group'" }, { status: 400 });
    }

    const db = await getDb();
    const charObjectIds = character_ids.map((id) => new ObjectId(id));

    // Verify all participating characters belong to this user (or owner).
    const charFilter =
      user.role === "owner"
        ? { _id: { $in: charObjectIds } }
        : { _id: { $in: charObjectIds }, user_id: new ObjectId(user._id) };
    const found = await db.collection("characters").find(charFilter).toArray();
    if (found.length !== character_ids.length) {
      return NextResponse.json({ error: "One or more characters not found" }, { status: 404 });
    }

    // Image-size guardrail (same as /api/images).
    const imageSizeBytes = Buffer.byteLength(image_url, "utf8");
    if (imageSizeBytes > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: `Image too large (${(imageSizeBytes / 1024 / 1024).toFixed(1)}MB). Max 4MB.` },
        { status: 413 },
      );
    }

    const now = new Date();
    const userObjectId = new ObjectId(user._id);

    // Master scene record.
    const masterDoc = {
      user_id: userObjectId,
      mode,
      character_ids: charObjectIds,
      character_names: found.map((c) => c.name),
      image_url,
      prompt_used: prompt_used || "",
      model_used: model_used || "gemini-3.1-flash-image-preview",
      params,
      created_at: now,
    };
    const masterResult = await db.collection("multi_scenes").insertOne(masterDoc);
    const masterId = masterResult.insertedId;

    // Per-character mirrors so the scene appears in each individual gallery.
    const subcategory = params.format || (mode === "duo" ? "duo" : "group");
    const charById = new Map(found.map((c) => [String(c._id), c]));
    const perCharRows = charObjectIds.map((cid) => {
      const otherIds = charObjectIds.filter((x) => !x.equals(cid));
      const otherNames = found
        .filter((c) => !cid.equals(c._id))
        .map((c) => c.name);
      const perChar = params.per_character.find((p) => p.character_id === String(cid));
      const ageNum =
        perChar && typeof perChar.age === "number" && Number.isFinite(perChar.age) && perChar.age > 0
          ? perChar.age
          : null;
      const charDoc = charById.get(String(cid));
      return {
        character_id: cid,
        user_id: userObjectId,
        category: mode === "duo" ? "multi_duo" : "multi_group",
        subcategory,
        image_url,
        prompt_used: prompt_used || "",
        model_used: model_used || "gemini-3.1-flash-image-preview",
        target_age: ageNum,
        selected: false,
        favorite: false,
        // Multi-scene linkage:
        multi_scene_id: masterId,
        co_character_ids: otherIds,
        co_character_names: otherNames,
        scene_format: params.format,
        scene_attitude: params.attitude,
        scene_owner_name: charDoc?.name,
        created_at: now,
      };
    });
    if (perCharRows.length > 0) {
      await db.collection("character_images").insertMany(perCharRows);
    }

    return NextResponse.json(
      { ...masterDoc, _id: masterId },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/multi-scenes error:", error);
    return NextResponse.json({ error: "Failed to save scene" }, { status: 500 });
  }
}
