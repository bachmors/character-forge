import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";
import { getUserApiKey } from "@/lib/userSettings";

const EXPRESSION_OPTIONS: Array<{ id: string; label: string; description: string }> = [
  { id: "joy", label: "Joy / Laughter", description: "open mouth in laughter, crinkled eyes, pure joy" },
  { id: "sadness", label: "Sadness / Tears", description: "downturned mouth, glistening eyes, slumped expression" },
  { id: "anger", label: "Anger / Rage", description: "furrowed brows, tense jaw, narrowed intense eyes" },
  { id: "fear", label: "Fear / Terror", description: "wide eyes, slightly open mouth, raised eyebrows" },
  { id: "surprise", label: "Surprise / Shock", description: "raised eyebrows, mouth open in O shape, wide eyes" },
  { id: "disgust", label: "Disgust / Revulsion", description: "wrinkled nose, raised upper lip, narrowed eyes" },
  { id: "contempt", label: "Contempt / Disdain", description: "one corner of the mouth raised, half-lidded eyes" },
  { id: "love", label: "Love / Tenderness", description: "soft eyes, gentle slight smile, warm expression" },
  { id: "guilt", label: "Guilt / Shame", description: "lowered head, downcast eyes, mouth slightly closed" },
  { id: "pride", label: "Pride / Triumph", description: "raised chin, slight smile, confident gaze" },
  { id: "boredom", label: "Boredom / Apathy", description: "half-lidded eyes, neutral mouth, distant gaze" },
  { id: "curiosity", label: "Curiosity / Wonder", description: "slightly tilted head, open eyes, parted lips" },
];

interface IncomingChar {
  name: string;
  description?: string;
  reference_image_url?: string;
  traits_summary?: string;
}

/**
 * POST /api/generate/expression-sheet
 *
 * Generates a single image showing the SAME character displayed across 6 or
 * 9 different emotions arranged in a 2×3 or 3×3 grid. Each cell shows the
 * same person from shoulders up; only the facial expression changes.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireUser();
    const body = await req.json();
    const {
      character,
      expressionIds,
    }: { character: IncomingChar; expressionIds: string[] } = body || {};

    if (!character || !character.name) {
      return NextResponse.json({ error: "character is required" }, { status: 400 });
    }
    if (!Array.isArray(expressionIds) || ![6, 9].includes(expressionIds.length)) {
      return NextResponse.json(
        { error: "Pick exactly 6 or 9 expressions" },
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

    const cells = expressionIds.map((id) => EXPRESSION_OPTIONS.find((e) => e.id === id)).filter(
      (e): e is (typeof EXPRESSION_OPTIONS)[number] => Boolean(e),
    );
    if (cells.length !== expressionIds.length) {
      return NextResponse.json({ error: "Unknown expression id" }, { status: 400 });
    }

    const cols = cells.length === 6 ? 3 : 3;
    const rows = cells.length === 6 ? 2 : 3;
    const positions = cells.map((c, i) => {
      const r = Math.floor(i / cols);
      const col = i % cols;
      const rowName = r === 0 ? "Top" : r === rows - 1 ? "Bottom" : "Middle";
      const colName = col === 0 ? "left" : col === cols - 1 ? "right" : "center";
      return `${rowName}-${colName}: ${c.label} — ${c.description}`;
    });

    const promptText = [
      `Create a character expression sheet showing ${character.name} displaying ${cells.length} different emotions in a ${rows}×${cols} grid layout.`,
      "Each cell shows the same character from shoulders up with:",
      ...positions,
      "",
      "CRITICAL: Same character, same camera angle, same lighting in every cell.",
      "ONLY the facial expression changes. The character must be clearly recognizable as the SAME person in all cells.",
      "Clean white or neutral background. Label each emotion below the portrait in clean small text.",
      character.description ? `Character description: ${character.description}` : "",
      character.traits_summary ? `Distinguishing traits: ${character.traits_summary}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Build multimodal parts: reference image (if any) followed by the text.
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
        console.warn("expression-sheet: reference fetch failed:", e);
      }
    }
    parts.push({
      text: `Use the provided reference image ONLY for the character's facial features, body type, and identity. Apply this consistent identity across every cell of the expression sheet.\n\n${promptText}`,
    });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          // 3-wide grid lays out best in 3:2 (6 cells) or square (9 cells).
          aspectRatio: cells.length === 6 ? "3:2" : "1:1",
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
      expression_ids: expressionIds,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/generate/expression-sheet error:", error);
    return NextResponse.json(
      { error: "Failed to generate expression sheet", details: String(error) },
      { status: 500 },
    );
  }
}
