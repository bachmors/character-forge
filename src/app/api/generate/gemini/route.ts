import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";
import { buildAgeInstruction, buildClothingInstruction, buildPoseInstruction } from "@/lib/prompts";
import {
  buildPsychologyInstruction,
  buildBackstoryInstruction,
  buildMoodboardInstruction,
  type CharacterProfile,
} from "@/lib/profile";
import {
  buildCinematographyInstruction,
  buildArtStyleInstruction,
  type CinematographyChoice,
} from "@/lib/cinematography";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const {
      prompt,
      referenceImageUrl,
      targetAge,
      clothingDescription,
      characterProfile,
      emotionalStateOverride,
      cinematography,
      artStyle,
      poseId,
      model: modelId,
    }: {
      prompt: string;
      referenceImageUrl?: string;
      targetAge?: number | string | null;
      clothingDescription?: string | null;
      characterProfile?: CharacterProfile;
      emotionalStateOverride?: { id?: string; custom?: string } | null;
      cinematography?: CinematographyChoice | null;
      artStyle?: string | null;
      poseId?: string | null;
      model?: string;
    } = await req.json();

    // Multi-provider routing (Phase A). For non-Gemini models we currently
    // return a friendly 501 — the provider abstraction lives in
    // src/lib/providers but only Gemini is wired up. The selected model id
    // travels with the response so the gallery can record what was used.
    const requestedModel = modelId || "gemini-3.1-flash-image-preview";
    const isGemini = /^gemini/i.test(requestedModel);
    if (!isGemini) {
      return NextResponse.json(
        {
          error: `Generation with "${requestedModel}" is not yet implemented in this build. The provider scaffold is in place — see src/lib/providers — but this run still routes Gemini only.`,
          requested_model: requestedModel,
        },
        { status: 501 },
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const ageNum =
      typeof targetAge === "number"
        ? targetAge
        : typeof targetAge === "string" && targetAge.trim() !== ""
          ? Number(targetAge)
          : null;
    const ageInstruction = buildAgeInstruction(
      ageNum !== null && Number.isFinite(ageNum) ? ageNum : null,
    );
    const clothingInstruction = buildClothingInstruction(
      typeof clothingDescription === "string" ? clothingDescription : null,
    );
    const psychInstruction = buildPsychologyInstruction(
      characterProfile?.psychology,
      emotionalStateOverride,
    );
    const backstoryInstruction = buildBackstoryInstruction(characterProfile?.backstory);
    const moodboardInstruction = buildMoodboardInstruction(characterProfile?.moodboard);
    const cinematographyInstruction = buildCinematographyInstruction(cinematography);
    const artStyleInstruction = buildArtStyleInstruction(artStyle);
    const poseInstruction = buildPoseInstruction(poseId);

    // Order: clothing → age → psychology → background → visual style →
    //        cinematography → art style. Art style is last so its aesthetic
    //        can override the earlier "photographic" instructions when set.
    let finalPrompt = prompt;
    if (clothingInstruction) finalPrompt = `${finalPrompt}\n\n${clothingInstruction.trim()}`;
    if (ageInstruction) finalPrompt = `${finalPrompt}\n\n${ageInstruction.trim()}`;
    if (psychInstruction) finalPrompt = `${finalPrompt}\n\n${psychInstruction.trim()}`;
    if (backstoryInstruction) finalPrompt = `${finalPrompt}\n\n${backstoryInstruction.trim()}`;
    if (moodboardInstruction) finalPrompt = `${finalPrompt}\n\n${moodboardInstruction.trim()}`;
    if (poseInstruction) finalPrompt = `${finalPrompt}\n\n${poseInstruction.trim()}`;
    if (cinematographyInstruction) finalPrompt = `${finalPrompt}\n\n${cinematographyInstruction.trim()}`;
    if (artStyleInstruction) finalPrompt = `${finalPrompt}\n\n${artStyleInstruction.trim()}`;

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
        text: `Generate an image based on this description. Use the provided reference image ONLY for facial features, body type, hair, skin, and character identity — preserve those exactly. IGNORE the clothing, outfit, and accessories from the reference image: instead, apply the clothing and styling specified in the prompt below. The clothing/outfit in the output must match the prompt, NOT the reference image.\n\n${finalPrompt}`,
      });
      contents = [{ role: "user", parts }];
    } else {
      contents = `Generate an image based on this description:\n\n${finalPrompt}`;
    }

    const response = await ai.models.generateContent({
      model: requestedModel,
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
      // Categorise the failure so the front-end can render a friendly card
      // instead of the generic "did not generate an image" line.
      const finishReason = String(candidates[0].finishReason || "").toUpperCase();
      let category: "safety" | "recitation" | "empty" | "other" = "other";
      let message = "The model returned no image.";
      if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
        category = "safety";
        message =
          "The model declined this generation due to its safety policies. Try adjusting your prompt, clothing style, or scene description.";
      } else if (finishReason === "RECITATION") {
        category = "recitation";
        message =
          "The model declined this generation because the prompt risked reproducing copyrighted content. Rephrase the request.";
      } else if (finishReason === "STOP" || finishReason === "MAX_TOKENS") {
        category = "empty";
        message =
          "The model finished without producing an image. Make the prompt more specific about what should appear in the image.";
      } else if (textResponse) {
        // Sometimes the model returns a refusal as text. Surface it so the
        // user can read the actual reason.
        message = textResponse.trim().slice(0, 400);
      }
      return NextResponse.json(
        {
          error: message,
          category,
          finish_reason: finishReason || null,
          text_response: textResponse || null,
        },
        { status: 422 }, // 422 = unprocessable: client should adjust input.
      );
    }

    const dataUrl = `data:${mimeType};base64,${imageData}`;
    return NextResponse.json({
      image_url: dataUrl,
      text_response: textResponse,
      model_used: requestedModel,
      provider: "google",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/generate/gemini error:", error);
    // Map common upstream errors to specific categories the UI can theme.
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    let category: "rate" | "auth" | "size" | "network" | "other" = "other";
    let status = 500;
    let message = "Generation failed. Please try again.";
    if (/quota|rate.?limit|too many requests|resource_?exhausted/.test(lower)) {
      category = "rate";
      status = 429;
      message = "Rate limit reached. Wait a moment and try again.";
    } else if (/api[ _]?key|unauthorized|invalid.+credential|permission_?denied/.test(lower)) {
      category = "auth";
      status = 401;
      message = "API key invalid or missing the right permissions. Check your settings.";
    } else if (/payload too large|413|request entity too large/.test(lower)) {
      category = "size";
      status = 413;
      message = "Reference image too large. Use a smaller image (under 4 MB).";
    } else if (/fetch|network|timeout|enotfound|econnrefused/.test(lower)) {
      category = "network";
      message = "Network error reaching the model provider. Check your connection.";
    }
    return NextResponse.json({ error: message, category, raw }, { status });
  }
}
