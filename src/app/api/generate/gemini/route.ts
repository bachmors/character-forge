import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { prompt, referenceImageUrl } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Get API key from session or env
    const session = await getSession();
    const apiKey = session.apiKeys?.googleAi || process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google AI API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    // Build the request parts
    const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

    // If we have a reference image, fetch it and include as inline_data
    if (referenceImageUrl) {
      try {
        const imageResponse = await fetch(referenceImageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
          parts.push({
            inline_data: {
              mime_type: contentType,
              data: base64,
            },
          });
        }
      } catch (e) {
        console.warn("Could not fetch reference image:", e);
      }
    }

    parts.push({
      text: `Generate an image based on this description. If a reference image is provided, use it as a guide for character consistency.\n\n${prompt}`,
    });

    // Call Gemini API — Nano Banana 2 (gemini-3.1-flash-image-preview)
    const model = "gemini-3.1-flash-image-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error("Gemini API error:", errorData);
      return NextResponse.json(
        { error: `Gemini API error: ${geminiResponse.status}` },
        { status: geminiResponse.status }
      );
    }

    const data = await geminiResponse.json();

    // Extract image from response
    const candidates = data.candidates || [];
    if (candidates.length === 0) {
      return NextResponse.json({ error: "No response from Gemini" }, { status: 500 });
    }

    const responseParts = candidates[0].content?.parts || [];
    let imageData: string | null = null;
    let mimeType = "image/png";
    let textResponse = "";

    for (const part of responseParts) {
      if (part.inline_data) {
        imageData = part.inline_data.data;
        mimeType = part.inline_data.mime_type || "image/png";
      }
      if (part.text) {
        textResponse += part.text;
      }
    }

    if (!imageData) {
      return NextResponse.json(
        {
          error: "Gemini did not generate an image. Response: " + (textResponse || "empty"),
        },
        { status: 500 }
      );
    }

    // Return image as base64 data URL
    const dataUrl = `data:${mimeType};base64,${imageData}`;
    return NextResponse.json({
      image_url: dataUrl,
      text_response: textResponse,
      model_used: model,
    });
  } catch (error) {
    console.error("POST /api/generate/gemini error:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
