import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";

const TURNAROUND_LAYOUTS: Record<string, { count: number; views: string[] }> = {
  simple: {
    count: 3,
    views: ["Front", "Right side profile", "Back"],
  },
  standard: {
    count: 5,
    views: ["Front", "Three-quarter right", "Right side profile", "Three-quarter back", "Back"],
  },
  full: {
    count: 8,
    views: [
      "Front",
      "Three-quarter right",
      "Right side profile",
      "Three-quarter back right",
      "Back",
      "Three-quarter back left",
      "Left side profile",
      "Three-quarter left",
    ],
  },
};

interface IncomingChar {
  name: string;
  description?: string;
  reference_image_url?: string;
  clothing?: string | null;
  age?: number | null;
  traits_summary?: string;
}

/**
 * POST /api/generate/turnaround
 *
 * Generates a horizontal turnaround sheet — the same character from N
 * camera angles in one image. Used for visual-consistency reference in
 * film, animation, and game design pipelines.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await req.json();
    const { character, layout }: { character: IncomingChar; layout: string } = body || {};

    if (!character || !character.name) {
      return NextResponse.json({ error: "character is required" }, { status: 400 });
    }
    const def = TURNAROUND_LAYOUTS[layout];
    if (!def) {
      return NextResponse.json(
        { error: "layout must be 'simple', 'standard', or 'full'" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const apiKey = session.apiKeys?.googleAi || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google AI API key not configured. Add it in Settings." },
        { status: 400 },
      );
    }

    const clothingClause =
      character.clothing && character.clothing.trim()
        ? `Current clothing style: ${character.clothing.trim()} — applied identically to every view, override any clothing visible in the reference image.`
        : "Current clothing as in the reference image, applied identically to every view.";
    const ageClause =
      typeof character.age === "number" && character.age > 0
        ? `Character age: approximately ${character.age} years old, applied identically to every view.`
        : "";

    const promptText = [
      `Generate a character turnaround sheet showing ${character.name} from ${def.count} angles in a horizontal strip on a clean neutral light gray background.`,
      `Views from left to right: ${def.views.join(" | ")}.`,
      "",
      "CRITICAL:",
      "- Same character in ALL views — identical facial features, body proportions, hair, skin, and clothing.",
      "- Same lighting and scale in every view.",
      "- Character standing in a relaxed neutral pose (close to T-pose) appropriate for a turnaround reference.",
      "- Clean light gray background with no environmental distractions.",
      "- Each view clearly shows its specific angle without ambiguity.",
      "- Even spacing between views, all aligned on a common horizon line.",
      "",
      character.description ? `Character description: ${character.description}` : "",
      character.traits_summary ? `Distinguishing traits: ${character.traits_summary}` : "",
      clothingClause,
      ageClause,
    ]
      .filter(Boolean)
      .join("\n");

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
        console.warn("turnaround: reference fetch failed:", e);
      }
    }
    parts.push({
      text: `Use the provided reference image ONLY for the character's facial features, body type, and identity — the same identity must appear in every angle of the turnaround.\n\n${promptText}`,
    });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          // A wide strip is the natural shape for a turnaround. 8 views need
          // an even wider canvas; Gemini's "16:9" is the closest preset.
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
      layout,
      view_count: def.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/generate/turnaround error:", error);
    return NextResponse.json(
      { error: "Failed to generate turnaround", details: String(error) },
      { status: 500 },
    );
  }
}
