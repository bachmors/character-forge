/**
 * Per-user settings store, scoped to the authenticated user via MongoDB.
 *
 * BEFORE this file existed, API keys lived in the iron-session cookie
 * — that's per-browser, not per-user, so two users sharing a browser
 * (or a user logging out and another logging in) could see the previous
 * user's keys. Keys now live in `character_forge.user_settings`,
 * always scoped by user_id, encrypted at rest with the same XOR
 * cipher used for custom-provider keys.
 *
 * Schema:
 *   { user_id, api_keys_enc: { [providerId]: <encrypted> },
 *     venice_safe_mode, default_model, favorite_models,
 *     created_at, updated_at }
 *
 * Read paths return decrypted-on-demand values; write paths re-encrypt.
 */

import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { encryptKey, decryptKey } from "./customProviders";

export interface UserSettings {
  has_keys: Record<string, boolean>;
  venice_safe_mode: boolean;
  default_model: string | null;
  favorite_models: string[];
}

interface UserSettingsDoc {
  user_id: ObjectId;
  api_keys_enc?: Record<string, string>;
  venice_safe_mode?: boolean;
  default_model?: string;
  favorite_models?: string[];
  created_at?: Date;
  updated_at?: Date;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const db = await getDb();
  const doc = (await db
    .collection("user_settings")
    .findOne({ user_id: new ObjectId(userId) })) as UserSettingsDoc | null;
  const has_keys: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(doc?.api_keys_enc || {})) {
    if (v) has_keys[k] = true;
  }
  return {
    has_keys,
    venice_safe_mode: doc?.venice_safe_mode === true,
    default_model: doc?.default_model || null,
    favorite_models: doc?.favorite_models || [],
  };
}

/** Returns the decrypted API key for the given provider, or null when none is stored. */
export async function getUserApiKey(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const db = await getDb();
  const doc = (await db
    .collection("user_settings")
    .findOne(
      { user_id: new ObjectId(userId) },
      { projection: { api_keys_enc: 1 } },
    )) as UserSettingsDoc | null;
  const enc = doc?.api_keys_enc?.[providerId];
  if (!enc) return null;
  const plain = decryptKey(enc);
  return plain || null;
}

/** Stores (or clears, when key is empty/null) a single provider's API key. */
export async function setUserApiKey(
  userId: string,
  providerId: string,
  key: string | null,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  if (!key) {
    // Clear the key without removing other entries.
    await db.collection("user_settings").updateOne(
      { user_id: new ObjectId(userId) },
      {
        $unset: { [`api_keys_enc.${providerId}`]: "" },
        $set: { updated_at: now },
        $setOnInsert: { user_id: new ObjectId(userId), created_at: now },
      },
      { upsert: true },
    );
    return;
  }
  await db.collection("user_settings").updateOne(
    { user_id: new ObjectId(userId) },
    {
      $set: { [`api_keys_enc.${providerId}`]: encryptKey(key), updated_at: now },
      $setOnInsert: { user_id: new ObjectId(userId), created_at: now },
    },
    { upsert: true },
  );
}

export async function setUserSettingValue<T>(
  userId: string,
  field: "venice_safe_mode" | "default_model" | "favorite_models",
  value: T,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db.collection("user_settings").updateOne(
    { user_id: new ObjectId(userId) },
    {
      $set: { [field]: value, updated_at: now },
      $setOnInsert: { user_id: new ObjectId(userId), created_at: now },
    },
    { upsert: true },
  );
}

/**
 * Resolves the Gemini API key for a given user.
 * Priority: user's own key > legacy session key > GEMINI_DEFAULT_API_KEY env var > GOOGLE_AI_API_KEY env var
 * Returns null if no key is available.
 */
export async function resolveGeminiKey(userId: string): Promise<string | null> {
  const userKey = await getUserApiKey(userId, "google");
  if (userKey) return userKey;
  if (process.env.GEMINI_DEFAULT_API_KEY) return process.env.GEMINI_DEFAULT_API_KEY;
  if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  return null;
}

/** Returns whether a default Gemini key is configured server-side. */
export function hasDefaultGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_DEFAULT_API_KEY || process.env.GOOGLE_AI_API_KEY);
}

/**
 * One-shot migration from the legacy iron-session apiKeys map onto the
 * MongoDB-backed store. Call from /api/settings GET when the MongoDB
 * record is empty so existing users don't lose their keys on the upgrade.
 */
export async function migrateLegacyKeysIfNeeded(
  userId: string,
  legacyKeys: Record<string, string | undefined> | undefined,
): Promise<boolean> {
  if (!legacyKeys) return false;
  const current = await getUserSettings(userId);
  if (Object.keys(current.has_keys).length > 0) return false;
  // Mapping legacy field names → new provider ids.
  const map: Record<string, string> = {
    googleAi: "google",
    openAi: "openai",
    stabilityAi: "stability",
  };
  let migrated = false;
  for (const [k, v] of Object.entries(legacyKeys)) {
    if (typeof v === "string" && v && !v.startsWith("••••")) {
      const id = map[k] || k;
      await setUserApiKey(userId, id, v);
      migrated = true;
    }
  }
  return migrated;
}
