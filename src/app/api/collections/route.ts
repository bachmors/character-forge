import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const collections = await db
      .collection("collections")
      .find({})
      .sort({ order: 1, createdAt: -1 })
      .toArray();
    return NextResponse.json(collections);
  } catch (error) {
    console.error("GET /api/collections error:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, description, coverImage } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDb();
    const maxOrder = await db
      .collection("collections")
      .find({})
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const nextOrder = maxOrder.length > 0 ? (maxOrder[0].order || 0) + 1 : 0;

    const now = new Date();
    const collection = {
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
    console.error("POST /api/collections error:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
