import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const MODELS = [
  "gemini-3.1-flash-image-preview",  // Nano Banana 2 — primary
  "gemini-2.5-flash-image",          // Nano Banana original — fallback
];

async function tryGenerateImage(
  apiKey: string,
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>,
  modelId: string
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `API ${response.status}: ${errorText}`, model: modelId };
  }

  const data = await response.json();

  // Check for safety blocks
  if (data.promptFeedback?.blockReason) {
    return { success: false, error: `Blocked: ${data.promptFeedback.blockReason}`, model: modelId, data };
  }

  const candidates = data.candidates || [];
  if (candidates.length === 0) {
    return { success: false, error: "No candidates", model: modelId, data };
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
    return {
      success: false,
      error: "No image in response",
      model: modelId,
      textResponse,
      finishReason: candidates[0].finishReason,
      partsCount: responseParts.length,
    };
  }

  return { success: true, imageData, mimeType, textResponse, model: modelId };
}

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

    // Build request parts
    const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

    if (referenceImageUrl) {
      try {
        const imageResponse = await fetch(referenceImageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
          parts.push({ inline_data: { mime_type: contentType, data: base64 } });
        }
      } catch (e) {
        console.warn("Could not fetch reference image:", e);
      }
    }

    parts.push({
      text: `Generate an image based on this description. If a reference image is provided, use it as a guide for character consistency.\n\n${prompt}`,
    });

    // Try models in order until one works
    const errors: Array<Record<string, unknown>> = [];

    for (const modelId of MODELS) {
      console.log(`Trying model: ${modelId}`);
      const result = await tryGenerateImage(apiKey, parts, modelId);

      if (result.success && result.imageData) {
        const dataUrl = `data:${result.mimeType};base64,${result.imageData}`;
        return NextResponse.json({
          image_url: dataUrl,
          text_response: result.textResponse,
          model_used: result.model,
        });
      }

      console.warn(`Model ${modelId} failed:`, result.error);
      errors.push(result);
    }

    // All models failed
    return NextResponse.json(
      {
        error: "All models failed to generate an image",
        attempts: errors.map((e) => ({ model: e.model, error: e.error, finishReason: e.finishReason })),
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("POST /api/generate/gemini error:", error);
    return NextResponse.json({ error: "Failed to generate image", details: String(error) }, { status: 500 });
  }
}
