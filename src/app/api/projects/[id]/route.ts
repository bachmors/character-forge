import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

async function loadOwnedProject(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  userId: string,
  role: string,
) {
  const filter =
    role === "owner"
      ? { _id: new ObjectId(id) }
      : { _id: new ObjectId(id), user_id: new ObjectId(userId) };
  return db.collection("projects").findOne(filter);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const project = await loadOwnedProject(db, params.id, user._id, user.role);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const project = await loadOwnedProject(db, params.id, user._id, user.role);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.description === "string") update.description = body.description.trim();
    if (typeof body.type === "string") update.type = body.type;
    if (typeof body.cover_image === "string") update.cover_image = body.cover_image;

    if (Array.isArray(body.character_ids)) {
      const ids = body.character_ids.map((id: string) => new ObjectId(id));
      // Verify ownership of every supplied character (unless owner).
      if (user.role !== "owner" && ids.length > 0) {
        const found = await db
          .collection("characters")
          .find({ _id: { $in: ids }, user_id: new ObjectId(user._id) })
          .toArray();
        if (found.length !== ids.length) {
          return NextResponse.json(
            { error: "One or more characters not found" },
            { status: 404 },
          );
        }
      }
      update.character_ids = ids;
    }

    const result = await db
      .collection("projects")
      .findOneAndUpdate({ _id: project._id }, { $set: update }, { returnDocument: "after" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const project = await loadOwnedProject(db, params.id, user._id, user.role);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.collection("projects").deleteOne({ _id: project._id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
