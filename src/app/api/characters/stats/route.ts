import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/characters/stats
 *
 * Returns one row per character with aggregate stats used by the gallery
 * view. Owners see all characters; other users see only their own.
 *
 * Per-character payload:
 *   - _id, name, description, base_image_url, created_at, updated_at
 *   - image_count          number
 *   - last_image_url       string | null   (latest generation, by created_at)
 *   - last_image_date      string | null
 *   - ages                 number[]        (unique non-null target_age values)
 *   - categories           string[]        (unique pose categories used)
 */
export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();

    const charFilter = user.role === "owner" ? {} : { user_id: new ObjectId(user._id) };
    const characters = await db
      .collection("characters")
      .find(charFilter)
      .sort({ updated_at: -1 })
      .toArray();

    if (characters.length === 0) {
      return NextResponse.json([]);
    }

    const characterIds = characters.map((c) => c._id);

    // One aggregation over the images collection, scoped to the user's
    // characters. Sort by created_at desc first so $first picks the latest.
    const pipeline = [
      { $match: { character_id: { $in: characterIds } } },
      { $sort: { created_at: -1 as const } },
      {
        $group: {
          _id: "$character_id",
          image_count: { $sum: 1 },
          last_image_url: { $first: "$image_url" },
          last_image_date: { $first: "$created_at" },
          ages: { $addToSet: "$target_age" },
          categories: { $addToSet: "$category" },
        },
      },
    ];

    const stats = await db.collection("character_images").aggregate(pipeline).toArray();
    const statsByCharId = new Map<string, (typeof stats)[number]>();
    for (const s of stats) statsByCharId.set(String(s._id), s);

    const result = characters.map((c) => {
      const s = statsByCharId.get(String(c._id));
      const rawAges: unknown[] = (s?.ages as unknown[]) || [];
      const ages = rawAges
        .map((a) => (typeof a === "number" ? a : null))
        .filter((a): a is number => a !== null && Number.isFinite(a) && a > 0)
        .sort((a, b) => a - b);
      const categories = ((s?.categories as unknown[]) || [])
        .filter((x): x is string => typeof x === "string" && x.length > 0);

      return {
        _id: c._id,
        name: c.name,
        description: c.description || "",
        base_image_url: c.base_image_url || "",
        created_at: c.created_at,
        updated_at: c.updated_at,
        image_count: s?.image_count || 0,
        last_image_url: s?.last_image_url || null,
        last_image_date: s?.last_image_date || null,
        ages,
        categories,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/characters/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
