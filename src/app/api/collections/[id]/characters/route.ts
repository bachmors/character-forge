import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { characterIds } = body;

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
      return NextResponse.json({ error: "characterIds array is required" }, { status: 400 });
    }

    const db = await getDb();
    // Verify ownership
    const col = await db.collection("collections").findOne({ _id: new ObjectId(params.id) });
    if (!col || (user.role !== "owner" && col.user_id?.toString() !== user._id)) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const result = await db
      .collection("collections")
      .findOneAndUpdate(
        { _id: new ObjectId(params.id) },
        {
          $addToSet: { characterIds: { $each: characterIds } },
          $set: { updatedAt: new Date() },
        },
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
    console.error("POST /api/collections/[id]/characters error:", error);
    return NextResponse.json({ error: "Failed to add characters" }, { status: 500 });
  }
}
