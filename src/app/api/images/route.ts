import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get("characterId");
    if (!characterId) {
      return NextResponse.json({ error: "characterId is required" }, { status: 400 });
    }

    const db = await getDb();
    const images = await db
      .collection("character_images")
      .find({ character_id: new ObjectId(characterId) })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json(images);
  } catch (error) {
    console.error("GET /api/images error:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { character_id, category, subcategory, image_url, prompt_used, model_used } = body;

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
    const image = {
      character_id: new ObjectId(character_id),
      category: category || "custom",
      subcategory: subcategory || "custom",
      image_url,
      prompt_used: prompt_used || "",
      model_used: model_used || "unknown",
      selected: false,
      created_at: new Date(),
    };

    const result = await db.collection("character_images").insertOne(image);
    return NextResponse.json({ ...image, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/images error:", error);
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }
}
