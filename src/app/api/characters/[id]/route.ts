import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

async function verifyOwnership(db: Awaited<ReturnType<typeof getDb>>, characterId: string, userId: string, role: string) {
  const character = await db.collection("characters").findOne({ _id: new ObjectId(characterId) });
  if (!character) return null;
  if (role !== "owner" && character.user_id?.toString() !== userId) return null;
  return character;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const character = await verifyOwnership(db, params.id, user._id, user.role);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json(character);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/characters/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch character" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const existing = await verifyOwnership(db, params.id, user._id, user.role);
    if (!existing) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.base_image_url !== undefined) updateData.base_image_url = body.base_image_url;
    if (body.traits !== undefined) updateData.traits = body.traits;
    if (body.profile !== undefined) updateData.profile = body.profile;

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
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/characters/[id] error:", error);
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const existing = await verifyOwnership(db, params.id, user._id, user.role);
    if (!existing) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const id = new ObjectId(params.id);
    await db.collection("character_images").deleteMany({ character_id: id });
    await db.collection("characters").deleteOne({ _id: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/characters/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 });
  }
}
