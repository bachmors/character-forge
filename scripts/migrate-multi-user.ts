import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;
const OWNER_EMAIL = "bachmorsartist@gmail.com";

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set. Check .env.local");
    process.exit(1);
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db("character_forge");

  // 1. Create owner user if not exists
  let owner = await db.collection("users").findOne({ email: OWNER_EMAIL });
  if (!owner) {
    const result = await db.collection("users").insertOne({
      email: OWNER_EMAIL,
      password_hash: null,
      role: "owner",
      created_at: new Date(),
      last_login_at: null,
    });
    owner = { _id: result.insertedId, email: OWNER_EMAIL, role: "owner" };
    console.log(`Created owner user: ${OWNER_EMAIL} (id: ${owner._id})`);
  } else {
    console.log(`Owner user already exists: ${OWNER_EMAIL} (id: ${owner._id})`);
  }

  // 2. Assign owner to all orphaned characters
  const charactersResult = await db.collection("characters").updateMany(
    { user_id: { $exists: false } },
    { $set: { user_id: owner._id } }
  );
  console.log(`Assigned owner to ${charactersResult.modifiedCount} characters`);

  // 3. Assign owner to all orphaned images
  const imagesResult = await db.collection("character_images").updateMany(
    { user_id: { $exists: false } },
    { $set: { user_id: owner._id } }
  );
  console.log(`Assigned owner to ${imagesResult.modifiedCount} images`);

  // 4. Create indexes
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("characters").createIndex({ user_id: 1, updated_at: -1 });
  await db.collection("character_images").createIndex({ user_id: 1, character_id: 1 });
  console.log("Indexes created");

  await client.close();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
