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

    // Try primary model first, fall back to alternative if it fails
    const models = ["gemini-3.1-flash-image-preview", "gemini-2.0-flash-exp"];

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      console.log(`[Gemini] Trying model: ${model}`);

      const geminiResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        }),
      });

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.text();
        console.error(`[Gemini] API error (${model}):`, errorData);
        // If this isn't the last model, try the next one
        if (model !== models[models.length - 1]) {
          console.log(`[Gemini] Falling back to next model...`);
          continue;
        }
        return NextResponse.json(
          { error: `Gemini API error: ${geminiResponse.status}`, details: errorData },
          { status: geminiResponse.status }
        );
      }

      const data = await geminiResponse.json();

      // Debug logging — full response structure
      console.log(`[Gemini] Full response (${model}):`, JSON.stringify(data, null, 2));
      if (data.promptFeedback) {
        console.log(`[Gemini] promptFeedback:`, JSON.stringify(data.promptFeedback));
      }
      const candidates = data.candidates || [];
      if (candidates.length > 0) {
        console.log(`[Gemini] finishReason:`, candidates[0].finishReason);
        const partTypes = (candidates[0].content?.parts || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => Object.keys(p).join(",")
        );
        console.log(`[Gemini] part types:`, partTypes);
      }

      if (candidates.length === 0) {
        // If this isn't the last model, try the next one
        if (model !== models[models.length - 1]) {
          console.log(`[Gemini] No candidates, falling back to next model...`);
          continue;
        }
        return NextResponse.json(
          {
            error: "No response from Gemini",
            debug: {
              promptFeedback: data.promptFeedback || null,
              candidateCount: 0,
              model,
            },
          },
          { status: 500 }
        );
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
        // If this isn't the last model, try the next one
        if (model !== models[models.length - 1]) {
          console.log(`[Gemini] No image in response from ${model}, falling back...`);
          continue;
        }
        return NextResponse.json(
          {
            error: "Gemini did not generate an image. Response: " + (textResponse || "empty"),
            debug: {
              promptFeedback: data.promptFeedback || null,
              finishReason: candidates[0].finishReason,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              partTypes: responseParts.map((p: any) => Object.keys(p).join(",")),
              textResponse,
              model,
            },
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
    }

    // Should not reach here, but just in case
    return NextResponse.json({ error: "All models failed" }, { status: 500 });
  } catch (error) {
    console.error("POST /api/generate/gemini error:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
