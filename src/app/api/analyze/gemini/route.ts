import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 });
    }

    const session = await getSession();
    const apiKey = session.apiKeys?.googleAi || process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google AI API key not configured." },
        { status: 400 }
      );
    }

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                text: `Analyze this character image for use in AI image generation. Return a JSON object with these exact fields:
{
  "name_suggestion": "a suggested character name based on appearance",
  "description": "a brief 1-2 sentence description of the character",
  "hair": "hair color, style, length (e.g. 'long wavy auburn hair')",
  "skin": "skin tone and notable features (e.g. 'fair skin with freckles')",
  "accessories": "any accessories visible (e.g. 'silver hoop earrings, black choker')",
  "clothing_base": "base clothing description (e.g. 'white cotton t-shirt')",
  "expression_default": "default expression (e.g. 'neutral', 'confident smile')",
  "body_type": "body type (e.g. 'slim', 'athletic', 'curvy')",
  "age_range": "estimated age range (e.g. '20-25')",
  "distinguishing_features": "any unique features (e.g. 'beauty mark on left cheek')",
  "art_style": "art style if applicable (e.g. 'photorealistic', 'anime', 'digital art')"
}
Return ONLY the JSON object, no markdown formatting or extra text.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Analyze] API error:", errorData);
      return NextResponse.json(
        { error: `Analysis API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const candidates = data.candidates || [];

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No analysis response" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textParts = candidates[0].content?.parts?.filter((p: any) => p.text) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawText = textParts.map((p: any) => p.text).join("");

    try {
      const jsonStr = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const analysis = JSON.parse(jsonStr);
      return NextResponse.json(analysis);
    } catch {
      return NextResponse.json(
        { raw: rawText, error: "Could not parse analysis" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/analyze/gemini error:", error);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}
