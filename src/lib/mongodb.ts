import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "character_forge";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return db;
}

export { cachedClient };
