import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    const filter = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    const collections = await db
      .collection("collections")
      .find(filter)
      .sort({ order: 1, createdAt: -1 })
      .toArray();
    return NextResponse.json(collections);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/collections error:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { name, category, description, coverImage } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDb();
    const maxOrder = await db
      .collection("collections")
      .find({ user_id: new ObjectId(user._id) })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const nextOrder = maxOrder.length > 0 ? (maxOrder[0].order || 0) + 1 : 0;

    const now = new Date();
    const collection = {
      user_id: new ObjectId(user._id),
      name,
      category: category || "other",
      description: description || null,
      coverImage: coverImage || null,
      characterIds: [],
      order: nextOrder,
      characterOrder: [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("collections").insertOne(collection);
    return NextResponse.json({ ...collection, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/collections error:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
