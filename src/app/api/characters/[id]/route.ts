import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const character = await db
      .collection("characters")
      .findOne({ _id: new ObjectId(params.id) });

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json(character);
  } catch (error) {
    console.error("GET /api/characters/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch character" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const db = await getDb();

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.base_image_url !== undefined) updateData.base_image_url = body.base_image_url;
    if (body.traits !== undefined) updateData.traits = body.traits;

    const result = await db
      .collection("characters")
      .findOneAndUpdate(
        { _id: new ObjectId(params.id) },
        { $set: updateData },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/characters/[id] error:", error);
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const id = new ObjectId(params.id);

    // Delete character and all associated images
    await db.collection("character_images").deleteMany({ character_id: id });
    const result = await db.collection("characters").deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/characters/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 });
  }
}
