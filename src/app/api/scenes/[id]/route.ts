import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const filter =
      user.role === "owner"
        ? { _id: new ObjectId(params.id) }
        : { _id: new ObjectId(params.id), user_id: new ObjectId(user._id) };
    const result = await db.collection("scenes").deleteOne(filter);
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/scenes/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete scene" }, { status: 500 });
  }
}
