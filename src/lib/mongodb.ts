import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "character_forge";
const MODELS_DB_NAME = "ai_models_db";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let cachedModelsDb: Db | null = null;

async function getClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }
  cachedClient = await MongoClient.connect(MONGODB_URI);
  return cachedClient;
}

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const client = await getClient();
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

/**
 * Returns a handle to the shared `ai_models_db` database (same MongoDB
 * cluster, different database). Used to read the model registry that the
 * provider/model selector pulls from.
 */
export async function getModelsDb(): Promise<Db> {
  if (cachedModelsDb) return cachedModelsDb;
  const client = await getClient();
  cachedModelsDb = client.db(MODELS_DB_NAME);
  return cachedModelsDb;
}

export { cachedClient };
