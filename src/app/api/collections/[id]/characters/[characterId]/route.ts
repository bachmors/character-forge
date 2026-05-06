import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; characterId: string } }
) {
  try {
    const db = await getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db
      .collection("collections")
      .findOneAndUpdate(
        { _id: new ObjectId(params.id) },
        {
          $pull: { characterIds: params.characterId },
          $set: { updatedAt: new Date() },
        } as any,
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("DELETE /api/collections/[id]/characters/[characterId] error:", error);
    return NextResponse.json({ error: "Failed to remove character" }, { status: 500 });
  }
}
