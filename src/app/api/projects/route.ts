import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

const PROJECT_TYPES = [
  "Short Film",
  "Feature",
  "Series",
  "Commercial",
  "Personal",
] as const;

interface PostBody {
  name: string;
  description?: string;
  type?: string;
  cover_image?: string;
  character_ids?: string[];
}

/**
 * GET /api/projects
 * Lists projects visible to the current user. Owner sees all.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    const filter = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    const projects = await db
      .collection("projects")
      .find(filter)
      .sort({ updated_at: -1 })
      .toArray();
    return NextResponse.json(projects);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Body: { name, description?, type?, cover_image?, character_ids?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as PostBody;
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }
    const db = await getDb();
    const characterIds = (body.character_ids || []).map((id) => new ObjectId(id));

    // If character_ids supplied, verify they belong to the user (or owner).
    if (characterIds.length > 0) {
      const charFilter =
        user.role === "owner"
          ? { _id: { $in: characterIds } }
          : { _id: { $in: characterIds }, user_id: new ObjectId(user._id) };
      const found = await db.collection("characters").find(charFilter).toArray();
      if (found.length !== characterIds.length) {
        return NextResponse.json(
          { error: "One or more characters not found" },
          { status: 404 },
        );
      }
    }

    const now = new Date();
    const doc = {
      user_id: new ObjectId(user._id),
      name: body.name.trim(),
      description: body.description?.trim() || "",
      type: body.type && PROJECT_TYPES.includes(body.type as (typeof PROJECT_TYPES)[number])
        ? body.type
        : "Personal",
      cover_image: body.cover_image || "",
      character_ids: characterIds,
      created_at: now,
      updated_at: now,
    };
    const result = await db.collection("projects").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
