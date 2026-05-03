import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/relationships
 * Returns every relationship visible to the current user.
 * Owners see all. Other users see only their own.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    const filter = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    const rels = await db
      .collection("character_relationships")
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();
    return NextResponse.json(rels);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/relationships error:", error);
    return NextResponse.json({ error: "Failed to fetch relationships" }, { status: 500 });
  }
}

/**
 * POST /api/relationships
 * Body: { from_character_id, to_character_id, type }
 * Both characters must belong to the current user (unless owner).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { from_character_id, to_character_id, type } = body || {};

    if (!from_character_id || !to_character_id || !type) {
      return NextResponse.json(
        { error: "from_character_id, to_character_id, and type are required" },
        { status: 400 },
      );
    }
    if (from_character_id === to_character_id) {
      return NextResponse.json(
        { error: "A character cannot have a relationship with itself" },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Verify both characters exist and (unless owner) belong to this user.
    const fromId = new ObjectId(from_character_id);
    const toId = new ObjectId(to_character_id);
    const charFilter =
      user.role === "owner"
        ? { _id: { $in: [fromId, toId] } }
        : { _id: { $in: [fromId, toId] }, user_id: new ObjectId(user._id) };
    const found = await db.collection("characters").find(charFilter).toArray();
    if (found.length !== 2) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const rel = {
      user_id: new ObjectId(user._id),
      from_character_id: fromId,
      to_character_id: toId,
      type: String(type).trim().slice(0, 80),
      created_at: new Date(),
    };
    const result = await db.collection("character_relationships").insertOne(rel);
    return NextResponse.json({ ...rel, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/relationships error:", error);
    return NextResponse.json({ error: "Failed to create relationship" }, { status: 500 });
  }
}
