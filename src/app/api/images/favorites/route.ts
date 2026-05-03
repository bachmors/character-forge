import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/images/favorites
 *
 * Returns every favorited image for the current user. Users see only their
 * own; the owner sees everyone's. Used by the /favorites page.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = { favorite: true };
    if (user.role !== "owner") filter.user_id = new ObjectId(user._id);

    const images = await db
      .collection("character_images")
      .find(filter)
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();
    return NextResponse.json(images);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/images/favorites error:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}
