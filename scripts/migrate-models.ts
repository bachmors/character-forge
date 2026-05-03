/**
 * One-shot migration that backfills `model_used` and `provider` on every
 * existing character_image and multi_scene document that pre-dates
 * Phase B (multi-model support). Idempotent: writes a marker into the
 * `migrations` collection on success and exits early if the marker is
 * already present.
 *
 * Run once after deploying Phase B:
 *   npm run migrate:models
 */
import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;
const MIGRATION_ID = "phase_b_model_provider_backfill_v1";
const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";
const DEFAULT_PROVIDER = "google";

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set. Check .env.local");
    process.exit(1);
  }
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db("character_forge");

  // Idempotency check.
  const existing = await db.collection("migrations").findOne({ id: MIGRATION_ID });
  if (existing) {
    console.log(`Migration ${MIGRATION_ID} already applied at ${existing.applied_at}.`);
    await client.close();
    return;
  }

  // 1. character_images: ensure model_used + provider are set.
  const missingModel = await db
    .collection("character_images")
    .updateMany(
      { $or: [{ model_used: { $exists: false } }, { model_used: "unknown" }] },
      { $set: { model_used: DEFAULT_MODEL } },
    );
  console.log(`character_images: set default model on ${missingModel.modifiedCount} rows`);

  const missingProvider = await db
    .collection("character_images")
    .updateMany(
      { provider: { $exists: false } },
      { $set: { provider: DEFAULT_PROVIDER } },
    );
  console.log(`character_images: set default provider on ${missingProvider.modifiedCount} rows`);

  // 2. multi_scenes: same backfill.
  const sceneModel = await db
    .collection("multi_scenes")
    .updateMany(
      { $or: [{ model_used: { $exists: false } }, { model_used: "unknown" }] },
      { $set: { model_used: DEFAULT_MODEL } },
    );
  console.log(`multi_scenes: set default model on ${sceneModel.modifiedCount} rows`);
  const sceneProvider = await db
    .collection("multi_scenes")
    .updateMany(
      { provider: { $exists: false } },
      { $set: { provider: DEFAULT_PROVIDER } },
    );
  console.log(`multi_scenes: set default provider on ${sceneProvider.modifiedCount} rows`);

  // 3. scenes (narrative scenes): same backfill.
  const narrModel = await db
    .collection("scenes")
    .updateMany(
      { $or: [{ model_used: { $exists: false } }, { model_used: "unknown" }] },
      { $set: { model_used: DEFAULT_MODEL } },
    );
  console.log(`scenes: set default model on ${narrModel.modifiedCount} rows`);
  const narrProvider = await db
    .collection("scenes")
    .updateMany(
      { provider: { $exists: false } },
      { $set: { provider: DEFAULT_PROVIDER } },
    );
  console.log(`scenes: set default provider on ${narrProvider.modifiedCount} rows`);

  // Indexes that make per-model gallery filters cheap.
  await db.collection("character_images").createIndex({ user_id: 1, model_used: 1 });
  await db.collection("character_images").createIndex({ character_id: 1, model_used: 1 });
  console.log("character_images: indexes created");

  await db
    .collection("migrations")
    .insertOne({ id: MIGRATION_ID, applied_at: new Date() });
  console.log(`Migration ${MIGRATION_ID} recorded as applied.`);

  await client.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
