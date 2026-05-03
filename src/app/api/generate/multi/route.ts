import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";
import { getUserApiKey } from "@/lib/userSettings";
import { buildMultiScenePrompt, type ModeId } from "@/lib/scenes";
import {
  buildCinematographyInstruction,
  buildArtStyleInstruction,
  type CinematographyChoice,
} from "@/lib/cinematography";

interface IncomingCharacter {
  name: string;
  description?: string;
  traits?: string;
  age?: number | null;
  clothing?: string | null;
  /** Either an https URL or a data: URL. */
  reference_image_url?: string;
}

/**
 * POST /api/generate/multi
 *
 * Multi-character scene generation. Accepts 2–6 characters and a scene
 * configuration. Reference images are passed to Gemini as separate inlineData
 * parts in numbered order; the prompt text binds each character to its own
 * "reference image #N" so identities don't cross-contaminate.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireUser();
    const body = await req.json();
    const {
      mode,
      characters,
      format,
      attitude,
      setting,
      customSetting,
      cinematography,
      artStyle,
    }: {
      mode: ModeId;
      characters: IncomingCharacter[];
      format: string;
      attitude: string;
      setting: string;
      customSetting?: string;
      cinematography?: CinematographyChoice | null;
      artStyle?: string | null;
    } = body || {};

    if (!Array.isArray(characters) || characters.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 characters" },
        { status: 400 },
      );
    }
    if (characters.length > 6) {
      return NextResponse.json(
        { error: "Maximum 6 characters per scene" },
        { status: 400 },
      );
    }
    if (!format || !attitude || !setting) {
      return NextResponse.json(
        { error: "format, attitude, and setting are required" },
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

    // Build the user-text prompt referring to "reference image #N" for each character.
    let promptText = buildMultiScenePrompt({
      mode: mode === "group" ? "group" : "duo",
      characters: characters.map((c) => ({
        name: c.name,
        description: c.description,
        traits: c.traits,
        clothing: c.clothing ?? null,
        age: c.age ?? null,
      })),
      format,
      attitude,
      setting,
      customSetting,
    });
    const cinematographyInstruction = buildCinematographyInstruction(cinematography);
    const artStyleInstruction = buildArtStyleInstruction(artStyle);
    if (cinematographyInstruction) promptText = `${promptText}\n\n${cinematographyInstruction.trim()}`;
    if (artStyleInstruction) promptText = `${promptText}\n\n${artStyleInstruction.trim()}`;

    // Resolve each character's reference image into a Gemini inlineData part,
    // preserving order so #N in the text matches the Nth image part.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    for (const c of characters) {
      const ref = c.reference_image_url;
      if (!ref) continue; // characters without a reference can still appear; the model leans on description
      try {
        if (ref.startsWith("data:")) {
          const matches = ref.match(/^data:(.+?);base64,(.+)$/);
          if (matches) parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
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
        console.warn("multi: could not fetch reference image:", e);
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
          // Wide framing better suits group composition; duos still render fine.
          aspectRatio: characters.length >= 4 || format === "cinematic_wide" ? "16:9" : "1:1",
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
      text_response: textResponse,
      model_used: "gemini-3.1-flash-image-preview",
      prompt_used: promptText,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/generate/multi error:", error);
    return NextResponse.json(
      { error: "Failed to generate multi-character image", details: String(error) },
      { status: 500 },
    );
  }
}
