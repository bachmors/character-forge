import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    const filter = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    const characters = await db
      .collection("characters")
      .find(filter)
      .sort({ updated_at: -1 })
      .toArray();
    return NextResponse.json(characters);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/characters error:", error);
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { name, description, base_image_url, traits, profile } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const character = {
      user_id: new ObjectId(user._id),
      name,
      description: description || "",
      base_image_url: base_image_url || "",
      traits: traits || {
        hair: "",
        accessories: "",
        skin: "",
        expression_default: "neutral",
        clothing_base: "",
      },
      profile: profile || {},
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection("characters").insertOne(character);
    return NextResponse.json({ ...character, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/characters error:", error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }
}
