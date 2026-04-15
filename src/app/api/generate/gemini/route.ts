import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
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

    // Build content — if reference image, use parts array; otherwise simple string
    let contents: string | Array<{ role: string; parts: Array<Record<string, unknown>> }>;

    if (referenceImageUrl) {
      const parts: Array<Record<string, unknown>> = [];
      try {
        const imageResponse = await fetch(referenceImageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
          parts.push({ inlineData: { mimeType: contentType, data: base64 } });
        }
      } catch (e) {
        console.warn("Could not fetch reference image:", e);
      }
      parts.push({
        text: `Generate an image based on this description. Use the provided reference image as a guide for character consistency.\n\n${prompt}`,
      });
      contents = [{ role: "user", parts }];
    } else {
      // Simple string prompt — matches official Google examples exactly
      contents = `Generate an image based on this description:\n\n${prompt}`;
    }

    // Generate with Nano Banana 2 — matching official SDK format
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

    // Extract image from SDK response
    const candidates = response.candidates || [];
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No response from Gemini", debug: JSON.stringify(response) },
        { status: 500 }
      );
    }

    const responseParts = candidates[0].content?.parts || [];
    let imageData: string | null = null;
    let mimeType = "image/png";
    let textResponse = "";

    for (const part of responseParts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
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
    console.error("POST /api/generate/gemini error:", error);
    return NextResponse.json(
      { error: "Failed to generate image", details: String(error) },
      { status: 500 }
    );
  }
}
