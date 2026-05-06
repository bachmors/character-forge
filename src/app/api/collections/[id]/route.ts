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

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
    if (body.characterIds !== undefined) updateData.characterIds = body.characterIds;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.characterOrder !== undefined) updateData.characterOrder = body.characterOrder;

    const result = await db
      .collection("collections")
      .findOneAndUpdate(
        { _id: new ObjectId(params.id) },
        { $set: updateData },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const result = await db
      .collection("collections")
      .deleteOne({ _id: new ObjectId(params.id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
