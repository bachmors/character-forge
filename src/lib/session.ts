import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  /**
   * Per-provider API keys, keyed by provider id (see PROVIDERS in
   * src/lib/providers). Legacy keys (googleAi, openAi, replicate,
   * stabilityAi) are still read for backwards compatibility — the
   * settings save-path normalises everything onto the new shape over
   * time.
   *
   * NOTE: keys live in the encrypted iron-session cookie. Storage in
   * MongoDB user_settings would require server-side encryption-at-rest;
   * keeping the per-cookie path lets us ship multi-provider support now
   * without weakening the security posture.
   */
  apiKeys?: {
    // Legacy fields (still read by the existing Gemini route)
    googleAi?: string;
    openAi?: string;
    replicate?: string;
    stabilityAi?: string;
    // New provider keys (see src/lib/providers)
    google?: string;
    anthropic?: string;
    openai?: string;
    stability?: string;
    flux?: string;
    ideogram?: string;
    recraft?: string;
    venice?: string;
    [providerId: string]: string | undefined;
  };
  /** Favorited model ids (for the model selector in the generation panel). */
  favoriteModels?: string[];
  /** Default model id used when the user hasn't picked one. */
  defaultModel?: string;
  /** Venice-specific: when true, generations request safe_mode: true. Defaults to false (uncensored). */
  veniceSafeMode?: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_1234",
  cookieName: "character-forge-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
