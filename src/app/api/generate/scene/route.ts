import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";
import { getUserApiKey } from "@/lib/userSettings";
import {
  buildCinematographyInstruction,
  buildArtStyleInstruction,
  type CinematographyChoice,
} from "@/lib/cinematography";
import {
  buildPsychologyInstruction,
  type CharacterProfile,
} from "@/lib/profile";

interface IncomingChar {
  name: string;
  description?: string;
  reference_image_url?: string;
  profile?: CharacterProfile;
}

const ASPECT_RATIO_MAP: Record<string, "1:1" | "3:2" | "16:9" | "9:16" | "4:3"> = {
  cinematic: "16:9",
  film: "16:9",
  classic: "4:3",
  square: "1:1",
  vertical: "9:16",
};

/**
 * POST /api/generate/scene
 *
 * Narrative scene generator (Module 8). Renders one or more characters
 * doing something in an environment with explicit narrative context. Reuses
 * the cinematography/art-style helpers and per-character psychology so
 * scenes inherit the same depth as individual portraits.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireUser();
    const body = await req.json();
    const {
      characters,
      action,
      customAction,
      environment,
      customEnvironment,
      narrative,
      aspectRatio,
      cinematography,
      artStyle,
    }: {
      characters: IncomingChar[];
      action: string;
      customAction?: string;
      environment: string;
      customEnvironment?: string;
      narrative?: string;
      aspectRatio: string;
      cinematography?: CinematographyChoice | null;
      artStyle?: string | null;
    } = body || {};

    if (!Array.isArray(characters) || characters.length < 1 || characters.length > 4) {
      return NextResponse.json({ error: "1–4 characters required" }, { status: 400 });
    }
    if (!action || !environment) {
      return NextResponse.json(
        { error: "action and environment are required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const apiKey =
      (await getUserApiKey(authUser._id, "google")) ||
      session.apiKeys?.googleAi ||
      process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google AI API key not configured. Add it in Settings." },
        { status: 400 },
      );
    }

    const actionText = action === "custom" ? (customAction || "").trim() : action;
    const envText = environment === "custom" ? (customEnvironment || "").trim() : environment;

    const characterBlocks = characters
      .map((c, i) => {
        const ord = characters.length === 1 ? "" : ` ${i + 1} (reference image #${i + 1})`;
        const desc = [c.description].filter(Boolean).join(" ");
        return `CHARACTER${ord}: ${c.name}${desc ? ` — ${desc}` : ""}`;
      })
      .join("\n");

    // Per-character psychology stitched together (one paragraph per character).
    const psychSegments = characters
      .map((c, i) => {
        const seg = buildPsychologyInstruction(c.profile?.psychology);
        if (!seg) return "";
        const tag = characters.length === 1 ? "" : ` for character ${i + 1}`;
        return `${seg}${tag ? ` (this applies${tag})` : ""}`;
      })
      .filter(Boolean)
      .join("\n\n");

    let promptText = [
      "Generate a single cinematic scene image:",
      "",
      characterBlocks,
      `ACTION: ${actionText}`,
      `ENVIRONMENT: ${envText}`,
      narrative && narrative.trim() ? `NARRATIVE CONTEXT: ${narrative.trim()}` : "",
      "",
      `This should look like a frame from a film — not posed, not staged, but captured in a moment of real action or emotion. The environment and the ${characters.length === 1 ? "character" : "characters"} should feel integrated, not composited.`,
      characters.length > 1
        ? `CRITICAL: Each of the ${characters.length} characters must be clearly recognizable as a distinct individual from their respective reference image. Different faces, different body types, different hair. Do not blend their features.`
        : "Use the provided reference image ONLY for facial features, body type, hair, skin, and identity.",
    ]
      .filter(Boolean)
      .join("\n");

    const cinematographyInstruction = buildCinematographyInstruction(cinematography);
    const artStyleInstruction = buildArtStyleInstruction(artStyle);
    if (psychSegments) promptText = `${promptText}\n\n${psychSegments}`;
    if (cinematographyInstruction) promptText = `${promptText}\n\n${cinematographyInstruction.trim()}`;
    if (artStyleInstruction) promptText = `${promptText}\n\n${artStyleInstruction.trim()}`;

    // Build multimodal parts: one inlineData per character reference, then text.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    for (const c of characters) {
      const ref = c.reference_image_url;
      if (!ref) continue;
      try {
        if (ref.startsWith("data:")) {
          const m = ref.match(/^data:(.+?);base64,(.+)$/);
          if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
        } else {
          const r = await fetch(ref);
          if (r.ok) {
            const buffer = await r.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType = r.headers.get("content-type") || "image/jpeg";
            parts.push({ inlineData: { mimeType: contentType, data: base64 } });
          }
        }
      } catch (e) {
        console.warn("scene: reference fetch failed:", e);
      }
    }
    parts.push({ text: promptText });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: ASPECT_RATIO_MAP[aspectRatio] || "16:9",
          imageSize: "1K",
        },
      },
    });

    const candidates = response.candidates || [];
    if (candidates.length === 0) {
      return NextResponse.json({ error: "No response from Gemini" }, { status: 500 });
    }
    const responseParts = candidates[0].content?.parts || [];
    let imageData: string | null = null;
    let mimeType = "image/png";
    let textResponse = "";
    for (const p of responseParts) {
      if (p.inlineData?.data) {
        imageData = p.inlineData.data as string;
        mimeType = (p.inlineData.mimeType as string) || "image/png";
      }
      if (p.text) textResponse += p.text;
    }
    if (!imageData) {
      return NextResponse.json(
        {
          error: "Gemini did not generate an image",
          debug: {
            textResponse: textResponse || "empty",
            partsCount: responseParts.length,
            finishReason: candidates[0].finishReason,
          },
        },
        { status: 500 },
      );
    }

    const dataUrl = `data:${mimeType};base64,${imageData}`;
    return NextResponse.json({
      image_url: dataUrl,
      prompt_used: promptText,
      model_used: "gemini-3.1-flash-image-preview",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/generate/scene error:", error);
    return NextResponse.json(
      { error: "Failed to generate scene", details: String(error) },
      { status: 500 },
    );
  }
}
