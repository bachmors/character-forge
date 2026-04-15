import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const db = await getDb();

    const updateData: Record<string, unknown> = {};
    if (body.selected !== undefined) updateData.selected = body.selected;
    if (body.favorite !== undefined) updateData.favorite = body.favorite;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory;

    // When marking as favorite, unmark others in the same pose category
    if (body.favorite === true) {
      const image = await db
        .collection("character_images")
        .findOne({ _id: new ObjectId(params.id) });
      if (image) {
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
    console.error("PUT /api/images/[id] error:", error);
    return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const result = await db
      .collection("character_images")
      .deleteOne({ _id: new ObjectId(params.id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/images/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
