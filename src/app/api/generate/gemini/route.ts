import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { prompt, referenceImageUrl } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const session = await getSession();
    const apiKey = session.apiKeys?.googleAi || process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google AI API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any;

    if (referenceImageUrl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      try {
        // Handle both URLs and data URLs
        if (referenceImageUrl.startsWith("data:")) {
          const matches = referenceImageUrl.match(/^data:(.+?);base64,(.+)$/);
          if (matches) {
            parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
          }
        } else {
          const imageResponse = await fetch(referenceImageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString("base64");
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            parts.push({ inlineData: { mimeType: contentType, data: base64 } });
          }
        }
      } catch (e) {
        console.warn("Could not fetch reference image:", e);
      }
      parts.push({
        text: `Generate an image based on this description. Use the provided reference image ONLY for facial features, body type, hair, skin, and character identity — preserve those exactly. IGNORE the clothing, outfit, and accessories from the reference image: instead, apply the clothing and styling specified in the prompt below. The clothing/outfit in the output must match the prompt, NOT the reference image.\n\n${prompt}`,
      });
      contents = [{ role: "user", parts }];
    } else {
      contents = `Generate an image based on this description:\n\n${prompt}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

    const candidates = response.candidates || [];
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No response from Gemini" },
        { status: 500 }
      );
    }

    const responseParts = candidates[0].content?.parts || [];
    let imageData: string | null = null;
    let mimeType = "image/png";
    let textResponse = "";

    for (const part of responseParts) {
      if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data as string;
        mimeType = (part.inlineData.mimeType as string) || "image/png";
      }
      if (part.text) {
        textResponse += part.text;
      }
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
        { status: 500 }
      );
    }

    const dataUrl = `data:${mimeType};base64,${imageData}`;
    return NextResponse.json({
      image_url: dataUrl,
      text_response: textResponse,
      model_used: "gemini-3.1-flash-image-preview",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/generate/gemini error:", error);
    return NextResponse.json(
      { error: "Failed to generate image", details: String(error) },
      { status: 500 }
    );
  }
}
