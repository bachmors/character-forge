import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; characterId: string } }
) {
  try {
    const user = await requireUser();
    const db = await getDb();

    // Verify ownership
    const col = await db.collection("collections").findOne({ _id: new ObjectId(params.id) });
    if (!col || (user.role !== "owner" && col.user_id?.toString() !== user._id)) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

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
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/collections/[id]/characters/[characterId] error:", error);
    return NextResponse.json({ error: "Failed to remove character" }, { status: 500 });
  }
}
