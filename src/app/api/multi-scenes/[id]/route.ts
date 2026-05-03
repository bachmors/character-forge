import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

/**
 * DELETE /api/multi-scenes/[id]
 *
 * Removes a multi-character scene and every per-character mirror row that
 * references it. Owners can delete any; users only their own.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const sceneFilter =
      user.role === "owner"
        ? { _id: new ObjectId(params.id) }
        : { _id: new ObjectId(params.id), user_id: new ObjectId(user._id) };

    const scene = await db.collection("multi_scenes").findOne(sceneFilter);
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Cascade-delete the per-character mirrors.
    await db.collection("character_images").deleteMany({ multi_scene_id: scene._id });
    await db.collection("multi_scenes").deleteOne({ _id: scene._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/multi-scenes/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete scene" }, { status: 500 });
  }
}
