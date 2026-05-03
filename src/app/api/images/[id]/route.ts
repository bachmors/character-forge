import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

async function verifyImageOwnership(db: Awaited<ReturnType<typeof getDb>>, imageId: string, userId: string, role: string) {
  const image = await db.collection("character_images").findOne({ _id: new ObjectId(imageId) });
  if (!image) return null;
  if (role === "owner") return image;
  // Check via the parent character
  const character = await db.collection("characters").findOne({
    _id: image.character_id,
    user_id: new ObjectId(userId),
  });
  if (!character) return null;
  return image;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const image = await verifyImageOwnership(db, params.id, user._id, user.role);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.selected !== undefined) updateData.selected = body.selected;
    if (body.favorite !== undefined) updateData.favorite = body.favorite;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory;
    if (body.rating !== undefined) {
      const r = Number(body.rating);
      updateData.rating = Number.isFinite(r) && r >= 0 && r <= 5 ? r : 0;
    }

    // When marking as favorite, unmark others in the same pose category
    if (body.favorite === true) {
      await db.collection("character_images").updateMany(
        {
          character_id: image.character_id,
          category: image.category,
          subcategory: image.subcategory,
          _id: { $ne: new ObjectId(params.id) },
        },
        { $set: { favorite: false } }
      );
    }

    const result = await db
      .collection("character_images")
      .findOneAndUpdate(
        { _id: new ObjectId(params.id) },
        { $set: updateData },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/images/[id] error:", error);
    return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const image = await verifyImageOwnership(db, params.id, user._id, user.role);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await db.collection("character_images").deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/images/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
