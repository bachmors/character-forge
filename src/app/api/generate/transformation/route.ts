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

interface IncomingChar {
  name: string;
  description?: string;
  reference_image_url?: string;
}

/**
 * POST /api/generate/transformation
 *
 * Generates a side-by-side diptych showing the SAME character in two
 * states (BEFORE / AFTER). Same camera angle, framing, and background;
 * only the transformation changes between the two halves.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireUser();
    const body = await req.json();
    const {
      character,
      beforeLabel,
      beforeText,
      afterLabel,
      afterText,
      cinematography,
      artStyle,
    }: {
      character: IncomingChar;
      beforeLabel: string;
      beforeText: string;
      afterLabel: string;
      afterText: string;
      cinematography?: CinematographyChoice | null;
      artStyle?: string | null;
    } = body || {};

    if (!character || !character.name) {
      return NextResponse.json({ error: "character is required" }, { status: 400 });
    }
    if (!beforeText?.trim() || !afterText?.trim()) {
      return NextResponse.json(
        { error: "beforeText and afterText are required" },
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

    let promptText = [
      `Generate a side-by-side diptych of the same character in two states.`,
      "",
      `LEFT (${beforeLabel || "BEFORE"}): ${character.name} in state — ${beforeText.trim()}.`,
      `RIGHT (${afterLabel || "AFTER"}): ${character.name} in state — ${afterText.trim()}.`,
      "",
      "CRITICAL:",
      "- Same character on both sides — identical facial bone structure, identity, body proportions.",
      "- Same camera angle, same framing, same background, same lighting.",
      "- ONLY the transformation specified above should change between the two halves.",
      "- The viewer should instantly see what changed without ambiguity.",
      "- Equal-width left/right halves with a clean vertical division between them.",
      character.description ? `Character description: ${character.description}` : "",
      "Use the provided reference image ONLY for the character's facial features, body type, and identity — applied consistently to both halves.",
    ]
      .filter(Boolean)
      .join("\n");

    const cinematographyInstruction = buildCinematographyInstruction(cinematography);
    const artStyleInstruction = buildArtStyleInstruction(artStyle);
    if (cinematographyInstruction) promptText = `${promptText}\n\n${cinematographyInstruction.trim()}`;
    if (artStyleInstruction) promptText = `${promptText}\n\n${artStyleInstruction.trim()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    const ref = character.reference_image_url;
    if (ref) {
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
        console.warn("transformation: reference fetch failed:", e);
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
          // A wide canvas accommodates two equal-sized halves cleanly.
          aspectRatio: "16:9",
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
    console.error("POST /api/generate/transformation error:", error);
    return NextResponse.json(
      { error: "Failed to generate transformation", details: String(error) },
      { status: 500 },
    );
  }
}
