import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "characterId is required" }, { status: 400 });
    }

    const db = await getDb();

    // Verify the character belongs to this user (or user is owner)
    if (user.role !== "owner") {
      const character = await db.collection("characters").findOne({
        _id: new ObjectId(characterId),
        user_id: new ObjectId(user._id),
      });
      if (!character) {
        return NextResponse.json({ error: "Character not found" }, { status: 404 });
      }
    }

    const images = await db
      .collection("character_images")
      .find({ character_id: new ObjectId(characterId) })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json(images);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/images error:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const {
      character_id,
      category,
      subcategory,
      image_url,
      prompt_used,
      model_used,
      provider,
      model_version,
      target_age,
    } = body;

    if (!character_id || !image_url) {
      return NextResponse.json(
        { error: "character_id and image_url are required" },
        { status: 400 }
      );
    }

    // Validate image size (base64 data URLs can be large)
    const imageSizeBytes = Buffer.byteLength(image_url, "utf8");
    const maxSizeBytes = 4 * 1024 * 1024; // 4MB
    if (imageSizeBytes > maxSizeBytes) {
      return NextResponse.json(
        {
          error: `Image too large (${(imageSizeBytes / 1024 / 1024).toFixed(1)}MB). Max 4MB. Compress before uploading.`,
        },
        { status: 413 }
      );
    }

    const db = await getDb();

    // Verify the character belongs to this user (or user is owner)
    if (user.role !== "owner") {
      const character = await db.collection("characters").findOne({
        _id: new ObjectId(character_id),
        user_id: new ObjectId(user._id),
      });
      if (!character) {
        return NextResponse.json({ error: "Character not found" }, { status: 404 });
      }
    }

    const ageNum =
      typeof target_age === "number"
        ? target_age
        : typeof target_age === "string" && target_age.trim() !== ""
          ? Number(target_age)
          : null;
    // Derive provider from model name when not supplied (so existing client
    // calls don't have to send it explicitly).
    const inferredProvider =
      provider ||
      (typeof model_used === "string"
        ? /^gemini/i.test(model_used)
          ? "google"
          : /^dall-?e|^gpt-image/i.test(model_used)
            ? "openai"
            : /^stable.?diffusion|^sdxl|^sd3/i.test(model_used)
              ? "stability"
              : /^flux/i.test(model_used)
                ? "flux"
                : /^ideogram/i.test(model_used)
                  ? "ideogram"
                  : /^recraft/i.test(model_used)
                    ? "recraft"
                    : /^(fluently|flux-?dev|venice)/i.test(model_used)
                      ? "venice"
                      : null
        : null);
    const image = {
      character_id: new ObjectId(character_id),
      user_id: new ObjectId(user._id),
      category: category || "custom",
      subcategory: subcategory || "custom",
      image_url,
      prompt_used: prompt_used || "",
      model_used: model_used || "unknown",
      provider: inferredProvider,
      model_version: model_version || null,
      target_age: ageNum !== null && Number.isFinite(ageNum) ? ageNum : null,
      selected: false,
      created_at: new Date(),
    };

    const result = await db.collection("character_images").insertOne(image);
    return NextResponse.json({ ...image, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/images error:", error);
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }
}
