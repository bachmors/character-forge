import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const characters = await db
      .collection("characters")
      .find({})
      .sort({ updated_at: -1 })
      .toArray();
    return NextResponse.json(characters);
  } catch (error) {
    console.error("GET /api/characters error:", error);
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, base_image_url, traits } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const character = {
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
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection("characters").insertOne(character);
    return NextResponse.json({ ...character, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/characters error:", error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }
}
