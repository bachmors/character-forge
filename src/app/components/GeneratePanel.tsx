"use client";

import { useState, useCallback, useEffect } from "react";
import {
  STANDARD_POSES, CATEGORIES, CLOTHING_STYLES, CLOTHING_DESCRIPTIONS, AGE_PRESETS, POSE_LIBRARY,
  buildPrompt, type CharacterTraits, type PoseDefinition,
} from "@/lib/prompts";
import { EMOTIONAL_STATES, type CharacterProfile } from "@/lib/profile";
import CinematographyControls, {
  DEFAULT_CINEMATOGRAPHY_STATE,
  type CinematographyState,
} from "./CinematographyControls";

// 12 emotions offered for the Expression Sheet generator (Module 2).
const SHEET_EXPRESSIONS = [
  { id: "joy", label: "Joy / Laughter" },
  { id: "sadness", label: "Sadness / Tears" },
  { id: "anger", label: "Anger / Rage" },
  { id: "fear", label: "Fear / Terror" },
  { id: "surprise", label: "Surprise / Shock" },
  { id: "disgust", label: "Disgust / Revulsion" },
  { id: "contempt", label: "Contempt / Disdain" },
  { id: "love", label: "Love / Tenderness" },
  { id: "guilt", label: "Guilt / Shame" },
  { id: "pride", label: "Pride / Triumph" },
  { id: "boredom", label: "Boredom / Apathy" },
  { id: "curiosity", label: "Curiosity / Wonder" },
];
import { compressImage } from "@/lib/imageUtils";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
  profile?: CharacterProfile;
}

interface CharacterImage {
  _id: string;
  character_id: string;
  category: string;
  subcategory: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  selected: boolean;
  favorite: boolean;
  created_at: string;
}

interface GeneratePanelProps {
  character: Character;
  images: CharacterImage[];
  onImageGenerated: () => void;
  onLightboxOpen: (src: string) => void;
}

export default function GeneratePanel({ character, images, onImageGenerated, onLightboxOpen }: GeneratePanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("head_rotation");
  const [selectedPose, setSelectedPose] = useState<PoseDefinition | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedModelUsed, setGeneratedModelUsed] = useState<string>("");
  const [generatedTargetAge, setGeneratedTargetAge] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Structured error from /api/generate/gemini for the in-canvas error card.
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    category?: string;
    canRetry: boolean;
  } | null>(null);
  const [clothingStyle, setClothingStyle] = useState("default");
  const [customClothing, setCustomClothing] = useState("");
  // Free-text "details" field that stacks ON TOP of any preset clothing
  // (Improvement #2). Persisted on character.profile.clothing_details.
  const [clothingDetails, setClothingDetails] = useState("");
  // Hydrate clothing details from the character's profile when it changes.
  useEffect(() => {
    const saved = (character.profile as { clothing_details?: string } | undefined)
      ?.clothing_details;
    setClothingDetails(typeof saved === "string" ? saved : "");
  }, [character._id, character.profile]);

  const persistClothingDetails = async (value: string) => {
    try {
      const newProfile = { ...(character.profile || {}), clothing_details: value };
      await fetch(`/api/characters/${character._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: newProfile }),
      });
    } catch {
      // ignore — non-critical
    }
  };
  const [agePresetId, setAgePresetId] = useState<string>("default");
  const [customAge, setCustomAge] = useState<string>("");
  // Per-generation emotional state override (Module 1). Empty string means
  // "use the saved psychology profile's default state".
  const [emotionalOverride, setEmotionalOverride] = useState<string>("");
  const [emotionalOverrideCustom, setEmotionalOverrideCustom] = useState<string>("");
  const [cinematography, setCinematography] = useState<CinematographyState>(DEFAULT_CINEMATOGRAPHY_STATE);
  // Pose library (Module 16). "" means "no pose override — let the pose
  // template / custom prompt decide".
  const [poseId, setPoseId] = useState<string>("");

  // Model selector (Phase A). Loaded from /api/models filtered by available
  // providers. Defaults to whatever the user marked as default in Settings.
  const [availableModels, setAvailableModels] = useState<
    Array<{
      id: string;
      name: string;
      provider: string;
      provider_implemented: boolean;
      is_custom?: boolean;
    }>
  >([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image-preview");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mRes, sRes] = await Promise.all([
          fetch("/api/models"),
          fetch("/api/settings"),
        ]);
        if (cancelled) return;
        if (mRes.ok) {
          const data = await mRes.json();
          setAvailableModels(Array.isArray(data.models) ? data.models : []);
        }
        if (sRes.ok) {
          const s = await sRes.json();
          if (s.defaultModel) setSelectedModel(s.defaultModel);
        }
      } catch {
        // network errors are non-fatal — the existing default falls through
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Batch generation state
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentPose: "" });
  const [batchErrors, setBatchErrors] = useState<string[]>([]);

  // Transformation diptych (Module 10) state
  const [showXformPicker, setShowXformPicker] = useState(false);
  const [xformPreset, setXformPreset] = useState<string>("clean_dirty");
  const [xformCustomBefore, setXformCustomBefore] = useState("");
  const [xformCustomAfter, setXformCustomAfter] = useState("");
  const [xformGenerating, setXformGenerating] = useState(false);
  const [xformSaving, setXformSaving] = useState(false);
  const [xformError, setXformError] = useState<string | null>(null);
  const [xformResult, setXformResult] = useState<{
    image_url: string;
    prompt_used: string;
  } | null>(null);

  // Turnaround Sheet (Module 6) state
  const [showTurnPicker, setShowTurnPicker] = useState(false);
  const [turnLayout, setTurnLayout] = useState<"simple" | "standard" | "full">("standard");
  const [turnGenerating, setTurnGenerating] = useState(false);
  const [turnSaving, setTurnSaving] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [turnResult, setTurnResult] = useState<{
    image_url: string;
    prompt_used: string;
    layout: string;
    view_count: number;
  } | null>(null);

  // Expression Sheet (Module 2) state
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [sheetIds, setSheetIds] = useState<string[]>([
    "joy", "sadness", "anger", "fear", "surprise", "love",
  ]);
  const [sheetCount, setSheetCount] = useState<6 | 9>(6);
  const [sheetGenerating, setSheetGenerating] = useState(false);
  const [sheetResult, setSheetResult] = useState<{
    image_url: string;
    prompt_used: string;
    expression_ids: string[];
  } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSaving, setSheetSaving] = useState(false);

  const categoryPoses = STANDARD_POSES.filter((p) => p.category === selectedCategory);

  const getClothingDescription = useCallback(() => {
    // Resolve the preset/custom selection first, then layer on the
    // free-text "details" field if the user provided one.
    let base: string | undefined;
    if (clothingStyle === "default") base = undefined;
    else if (clothingStyle === "custom") base = customClothing || undefined;
    else base = CLOTHING_DESCRIPTIONS[clothingStyle] || undefined;

    const details = clothingDetails.trim();
    if (base && details) return `${base}, with these specific details: ${details}`;
    if (base) return base;
    if (details) return details;
    return undefined;
  }, [clothingStyle, customClothing, clothingDetails]);

  // Resolve the currently selected age into a number, or null for "as reference".
  const getTargetAge = useCallback((): number | null => {
    if (agePresetId === "default") return null;
    if (agePresetId === "custom") {
      const n = Number(customAge);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const preset = AGE_PRESETS.find((p) => p.id === agePresetId);
    return preset?.value ?? null;
  }, [agePresetId, customAge]);

  const handlePoseSelect = (pose: PoseDefinition) => {
    setSelectedPose(pose);
    setIsCustom(false);
    const clothing = clothingStyle === "default"
      ? undefined
      : clothingStyle === "custom"
        ? customClothing || undefined
        : CLOTHING_DESCRIPTIONS[clothingStyle];
    const prompt = buildPrompt(
      pose,
      character.traits as CharacterTraits,
      character.name,
      clothing,
    );
    setEditedPrompt(prompt);
    setGeneratedImage(null);
    setError(null);
  };

  const handleCustom = () => {
    setSelectedPose(null);
    setIsCustom(true);
    setEditedPrompt(customPrompt);
    setGeneratedImage(null);
    setError(null);
  };

  // Generate a single image via Gemini
  const generateImage = useCallback(
    async (prompt: string, age: number | null, clothing: string | null): Promise<{ image_url: string; model_used: string } | null> => {
      const res = await fetch("/api/generate/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          referenceImageUrl: character.base_image_url || undefined,
          targetAge: age,
          clothingDescription: clothing,
          characterProfile: character.profile || undefined,
          emotionalStateOverride: emotionalOverride
            ? { id: emotionalOverride, custom: emotionalOverride === "custom" ? emotionalOverrideCustom : undefined }
            : null,
          cinematography: {
            cameraAngle: cinematography.cameraAngle,
            lens: cinematography.lens,
            lighting: cinematography.lighting,
          },
          artStyle: cinematography.artStyle,
          poseId: poseId || undefined,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Forward the structured payload (category, message) to the catch
        // block so the UI can render an in-canvas error card.
        const err = new Error(data.error || "Generation failed") as Error & {
          category?: string;
          status?: number;
        };
        err.category = data.category;
        err.status = res.status;
        throw err;
      }
      return { image_url: data.image_url, model_used: data.model_used };
    },
    [character.base_image_url, character.profile, emotionalOverride, emotionalOverrideCustom, cinematography, poseId, selectedModel],
  );

  // Compress and save an image
  const saveImage = useCallback(
    async (
      imageUrl: string,
      category: string,
      subcategory: string,
      promptUsed: string,
      modelUsed: string,
      age: number | null,
    ) => {
      const compressed = await compressImage(imageUrl);
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: character._id,
          category,
          subcategory,
          image_url: compressed,
          prompt_used: promptUsed,
          model_used: modelUsed,
          target_age: age,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
    },
    [character._id],
  );

  const handleGenerate = async () => {
    const prompt = isCustom ? customPrompt : editedPrompt;
    if (!prompt.trim()) return;

    setGenerating(true);
    setError(null);
    setErrorDetails(null);
    setGeneratedImage(null);

    try {
      const age = getTargetAge();
      const clothing = getClothingDescription() ?? null;
      const result = await generateImage(prompt, age, clothing);
      if (result) {
        setGeneratedImage(result.image_url);
        setGeneratedModelUsed(result.model_used);
        setGeneratedTargetAge(age);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error. Please try again.";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = (err as any)?.category as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.status as number | undefined;
      const titleMap: Record<string, string> = {
        safety: "Blocked by safety policies",
        recitation: "Blocked to avoid copyrighted content",
        empty: "No image returned",
        rate: "Rate limit reached",
        auth: "API key issue",
        size: "Reference image too large",
        network: "Network error",
      };
      setErrorDetails({
        title: titleMap[cat || ""] || "Generation failed",
        message,
        category: cat,
        // Auth and size errors won't fix themselves on retry; everything else can.
        canRetry: cat !== "auth" && cat !== "size" && status !== 501,
      });
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToDataset = async () => {
    if (!generatedImage) return;

    try {
      await saveImage(
        generatedImage,
        isCustom ? "custom" : selectedPose?.category || "custom",
        isCustom ? "custom" : selectedPose?.subcategory || "custom",
        isCustom ? customPrompt : editedPrompt,
        generatedModelUsed || "gemini",
        generatedTargetAge,
      );
      onImageGenerated();
      setGeneratedImage(null);
      setGeneratedTargetAge(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      console.error("Failed to save:", err);
    }
  };

  // Generate all standard poses sequentially
  const handleGenerateAll = async () => {
    setBatchGenerating(true);
    setBatchErrors([]);
    const poses = STANDARD_POSES;
    setBatchProgress({ current: 0, total: poses.length, currentPose: "" });

    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      setBatchProgress({ current: i, total: poses.length, currentPose: pose.label });

      try {
        const clothing = getClothingDescription() ?? null;
        const prompt = buildPrompt(
          pose,
          character.traits as CharacterTraits,
          character.name,
          clothing ?? undefined,
        );
        const age = getTargetAge();
        const result = await generateImage(prompt, age, clothing);
        if (result) {
          await saveImage(
            result.image_url,
            pose.category,
            pose.subcategory,
            prompt,
            result.model_used,
            age,
          );
          onImageGenerated();
        }
      } catch (err) {
        const errMsg = `${pose.label}: ${err instanceof Error ? err.message : "failed"}`;
        setBatchErrors((prev) => [...prev, errMsg]);
      }

      setBatchProgress({ current: i + 1, total: poses.length, currentPose: "" });
    }

    setBatchGenerating(false);
  };

  // ── Transformation diptych (Module 10) ───────────────────────────────
  const XFORM_PRESETS: Array<{ id: string; label: string; before: string; after: string }> = [
    { id: "clean_dirty", label: "Clean → Dirty / Weathered", before: "pristine, clean, well-groomed", after: "weathered, dirty, battle-worn, with grime and damage to clothing and skin" },
    { id: "healthy_injured", label: "Healthy → Injured / Scarred", before: "healthy, unscarred, vital", after: "visibly injured and scarred, with healing wounds and tired eyes" },
    { id: "well_dressed_ragged", label: "Well-dressed → Ragged", before: "wearing impeccable, well-cut clothing", after: "wearing torn, ragged clothing, fraying edges and worn fabric" },
    { id: "civilian_uniform", label: "Civilian → Uniformed", before: "in civilian clothing, relaxed bearing", after: "in a military or uniformed role, upright disciplined posture" },
    { id: "human_supernatural", label: "Human → Supernatural", before: "fully human, warm-toned skin and eyes", after: "subtly supernatural — luminous or unusual eyes, faint otherworldly aura, otherwise the same person" },
    { id: "innocent_experienced", label: "Innocent → Experienced", before: "innocent and naive, soft open expression, untouched eyes", after: "experienced and weathered, harder eyes, jaw set, the same person but life has marked them" },
    { id: "confident_broken", label: "Confident → Broken", before: "confident, upright, eyes meeting the camera", after: "broken and exhausted, slumped posture, eyes downcast or hollow" },
    { id: "broken_rebuilt", label: "Broken → Rebuilt", before: "broken and depleted, slumped, hollow eyes", after: "rebuilt and grounded, scars visible but composed and present" },
    { id: "alive_ghost", label: "Alive → Ghost / Memory", before: "fully present and alive, solid colors, warm skin tones", after: "translucent and faded as if a memory, slightly desaturated, edges softening into background" },
  ];

  const handleGenerateTransformation = async () => {
    setXformGenerating(true);
    setXformError(null);
    setXformResult(null);
    try {
      let beforeText = "";
      let afterText = "";
      if (xformPreset === "custom") {
        beforeText = xformCustomBefore.trim();
        afterText = xformCustomAfter.trim();
        if (!beforeText || !afterText) {
          setXformError("Fill in both Before and After");
          setXformGenerating(false);
          return;
        }
      } else {
        const def = XFORM_PRESETS.find((p) => p.id === xformPreset);
        if (!def) {
          setXformError("Pick a transformation");
          setXformGenerating(false);
          return;
        }
        beforeText = def.before;
        afterText = def.after;
      }
      const res = await fetch("/api/generate/transformation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: {
            name: character.name,
            description: character.description,
            reference_image_url: character.base_image_url || undefined,
          },
          beforeLabel: "BEFORE",
          beforeText,
          afterLabel: "AFTER",
          afterText,
          cinematography: {
            cameraAngle: cinematography.cameraAngle,
            lens: cinematography.lens,
            lighting: cinematography.lighting,
          },
          artStyle: cinematography.artStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXformError(data.error || "Generation failed");
        return;
      }
      setXformResult(data);
    } catch (err) {
      setXformError(err instanceof Error ? err.message : "Network error");
    } finally {
      setXformGenerating(false);
    }
  };

  const handleSaveTransformation = async () => {
    if (!xformResult) return;
    setXformSaving(true);
    try {
      const compressed = await compressImage(xformResult.image_url);
      await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: character._id,
          category: "transformation",
          subcategory: xformPreset,
          image_url: compressed,
          prompt_used: xformResult.prompt_used,
          model_used: "gemini-3.1-flash-image-preview",
        }),
      });
      onImageGenerated();
      setXformResult(null);
      setShowXformPicker(false);
    } catch (err) {
      setXformError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setXformSaving(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────

  // ── Turnaround Sheet (Module 6) ──────────────────────────────────────
  const handleGenerateTurnaround = async () => {
    setTurnGenerating(true);
    setTurnError(null);
    setTurnResult(null);
    try {
      const traits = character.traits || {};
      const traitsSummary = [traits.hair, traits.skin, traits.accessories]
        .filter((v) => v && String(v).trim())
        .join(", ");
      const clothing = getClothingDescription() ?? null;
      const age = getTargetAge();
      const res = await fetch("/api/generate/turnaround", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: turnLayout,
          character: {
            name: character.name,
            description: character.description,
            traits_summary: traitsSummary || undefined,
            reference_image_url: character.base_image_url || undefined,
            clothing,
            age,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurnError(data.error || "Generation failed");
        return;
      }
      setTurnResult(data);
    } catch (err) {
      setTurnError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTurnGenerating(false);
    }
  };

  const handleSaveTurnaround = async () => {
    if (!turnResult) return;
    setTurnSaving(true);
    try {
      const compressed = await compressImage(turnResult.image_url);
      await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: character._id,
          category: "turnaround",
          subcategory: `${turnResult.view_count}_view`,
          image_url: compressed,
          prompt_used: turnResult.prompt_used,
          model_used: "gemini-3.1-flash-image-preview",
        }),
      });
      onImageGenerated();
      setTurnResult(null);
      setShowTurnPicker(false);
    } catch (err) {
      setTurnError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setTurnSaving(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────

  // ── Expression Sheet (Module 2) ──────────────────────────────────────
  const handleGenerateExpressionSheet = async () => {
    setSheetGenerating(true);
    setSheetError(null);
    setSheetResult(null);
    try {
      // Slice/pad to the target count.
      const ids = sheetIds.slice(0, sheetCount);
      if (ids.length !== sheetCount) {
        setSheetError(`Pick exactly ${sheetCount} expressions`);
        setSheetGenerating(false);
        return;
      }
      const traits = character.traits || {};
      const traitsSummary = [traits.hair, traits.skin, traits.accessories]
        .filter((v) => v && String(v).trim())
        .join(", ");
      const res = await fetch("/api/generate/expression-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: {
            name: character.name,
            description: character.description,
            traits_summary: traitsSummary || undefined,
            reference_image_url: character.base_image_url || undefined,
          },
          expressionIds: ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSheetError(data.error || "Generation failed");
        return;
      }
      setSheetResult(data);
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSheetGenerating(false);
    }
  };

  const handleSaveExpressionSheet = async () => {
    if (!sheetResult) return;
    setSheetSaving(true);
    try {
      const compressed = await compressImage(sheetResult.image_url);
      await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: character._id,
          category: "expression_sheet",
          subcategory: `${sheetCount}_expressions`,
          image_url: compressed,
          prompt_used: sheetResult.prompt_used,
          model_used: "gemini-3.1-flash-image-preview",
        }),
      });
      onImageGenerated();
      setSheetResult(null);
      setShowSheetPicker(false);
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSheetSaving(false);
    }
  };

  const toggleSheetExpression = (id: string) => {
    setSheetIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= sheetCount) return prev; // hard cap at current count
      return [...prev, id];
    });
  };
  // ─────────────────────────────────────────────────────────────────────

  const getPoseImageCount = (pose: PoseDefinition) =>
    images.filter((img) => img.category === pose.category && img.subcategory === pose.subcategory).length;

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="font-serif text-accent text-lg font-semibold">Generate Image</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTurnPicker((v) => !v)}
            disabled={batchGenerating || generating || sheetGenerating || turnGenerating || xformGenerating}
            className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-sm hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate a turnaround sheet (multiple angles in one image)"
          >
            Turnaround
          </button>
          <button
            onClick={() => setShowXformPicker((v) => !v)}
            disabled={batchGenerating || generating || sheetGenerating || turnGenerating || xformGenerating}
            className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-sm hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate a before/after transformation diptych"
          >
            Transformation
          </button>
          <button
            onClick={() => setShowSheetPicker((v) => !v)}
            disabled={batchGenerating || generating || sheetGenerating || turnGenerating}
            className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-sm hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate an expression sheet (6–9 emotions in one image)"
          >
            Expression Sheet
          </button>
          <button
            onClick={handleGenerateAll}
            disabled={batchGenerating || generating || sheetGenerating}
            className="px-4 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/30 text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {batchGenerating ? "Generating..." : "Generate All Poses"}
          </button>
        </div>
      </div>

      {/* Batch generation progress */}
      {batchGenerating && (
        <div className="mb-6 p-4 bg-surface border border-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text">
              {batchProgress.currentPose
                ? `Generating: ${batchProgress.currentPose}`
                : `Completed ${batchProgress.current}/${batchProgress.total}`}
            </span>
            <span className="text-sm text-muted">
              {batchProgress.current}/{batchProgress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{
                width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          {batchErrors.length > 0 && (
            <div className="mt-2 text-xs text-danger">
              {batchErrors.length} error(s): {batchErrors[batchErrors.length - 1]}
            </div>
          )}
        </div>
      )}

      {/* Transformation picker (Module 10) */}
      {showXformPicker && (
        <div className="mb-6 p-4 bg-surface border border-accent/30 rounded-lg space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-sm text-accent font-medium">Transformation diptych</h4>
              <p className="text-[11px] text-muted/80">
                Same character, before &amp; after, side by side. Same camera angle and
                framing in both halves; only the transformation changes.
              </p>
            </div>
            <button
              onClick={() => setShowXformPicker(false)}
              className="text-muted hover:text-text text-xs"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-muted">Transformation</label>
            <div className="flex flex-wrap gap-1.5">
              {XFORM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setXformPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                    xformPreset === p.id
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "border-border text-muted hover:text-text hover:border-border-strong"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setXformPreset("custom")}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  xformPreset === "custom"
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "border-border text-muted hover:text-text hover:border-border-strong"
                }`}
              >
                Custom…
              </button>
            </div>
            {xformPreset === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <input
                  type="text"
                  value={xformCustomBefore}
                  onChange={(e) => setXformCustomBefore(e.target.value)}
                  placeholder="Before: state of the character…"
                  className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
                <input
                  type="text"
                  value={xformCustomAfter}
                  onChange={(e) => setXformCustomAfter(e.target.value)}
                  placeholder="After: state of the character…"
                  className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateTransformation}
            disabled={xformGenerating || generating || batchGenerating || sheetGenerating || turnGenerating}
            className="px-4 py-2 rounded-lg bg-accent text-bg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {xformGenerating ? "Generating diptych…" : "Generate transformation"}
          </button>

          {xformError && (
            <div className="p-2 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
              {xformError}
            </div>
          )}

          {xformResult && (
            <div className="border border-border rounded-lg p-3 bg-bg/40">
              <div className="rounded overflow-hidden bg-bg flex items-center justify-center">
                <img
                  src={xformResult.image_url}
                  alt="Transformation"
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSaveTransformation}
                  disabled={xformSaving}
                  className="px-4 py-1.5 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-medium hover:bg-success/25 transition-colors disabled:opacity-50"
                >
                  {xformSaving ? "Saving…" : "Save to library"}
                </button>
                <button
                  onClick={handleGenerateTransformation}
                  disabled={xformGenerating || xformSaving}
                  className="px-4 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => setXformResult(null)}
                  className="text-muted hover:text-text text-xs"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Turnaround picker (Module 6) */}
      {showTurnPicker && (
        <div className="mb-6 p-4 bg-surface border border-accent/30 rounded-lg space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-sm text-accent font-medium">Turnaround sheet</h4>
              <p className="text-[11px] text-muted/80">
                Same character × multiple angles in one horizontal strip. Uses the current
                clothing &amp; age selections from above.
              </p>
            </div>
            <button
              onClick={() => setShowTurnPicker(false)}
              className="text-muted hover:text-text text-xs"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "simple", label: "Simple 3-view", desc: "Front · Side · Back" },
                { id: "standard", label: "Standard 5-view", desc: "Front · 3⁄4 R · R · 3⁄4 Back · Back" },
                { id: "full", label: "Full 8-view", desc: "Every 45° around" },
              ] as Array<{ id: "simple" | "standard" | "full"; label: string; desc: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTurnLayout(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border text-left transition-colors ${
                  turnLayout === opt.id
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "border-border text-muted hover:text-text hover:border-border-strong"
                }`}
                title={opt.desc}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] text-muted/70">{opt.desc}</div>
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateTurnaround}
            disabled={turnGenerating || generating || batchGenerating || sheetGenerating}
            className="px-4 py-2 rounded-lg bg-accent text-bg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {turnGenerating ? "Generating turnaround…" : `Generate ${turnLayout} turnaround`}
          </button>

          {turnError && (
            <div className="p-2 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
              {turnError}
            </div>
          )}

          {turnResult && (
            <div className="border border-border rounded-lg p-3 bg-bg/40">
              <div className="rounded overflow-hidden bg-bg flex items-center justify-center">
                <img
                  src={turnResult.image_url}
                  alt="Turnaround sheet"
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSaveTurnaround}
                  disabled={turnSaving}
                  className="px-4 py-1.5 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-medium hover:bg-success/25 transition-colors disabled:opacity-50"
                >
                  {turnSaving ? "Saving…" : "Save to library"}
                </button>
                <button
                  onClick={handleGenerateTurnaround}
                  disabled={turnGenerating || turnSaving}
                  className="px-4 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => setTurnResult(null)}
                  className="text-muted hover:text-text text-xs"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expression Sheet picker (Module 2) */}
      {showSheetPicker && (
        <div className="mb-6 p-4 bg-surface border border-accent/30 rounded-lg space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-sm text-accent font-medium">Expression Sheet</h4>
              <p className="text-[11px] text-muted/80">
                Same character × {sheetCount} emotions in one image. Pick exactly{" "}
                {sheetCount} from the list below.
              </p>
            </div>
            <div className="flex items-center gap-1">
              {[6, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setSheetCount(n as 6 | 9);
                    setSheetIds((prev) => prev.slice(0, n));
                  }}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                    sheetCount === n
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "border-border text-muted hover:text-text hover:border-border-strong"
                  }`}
                >
                  {n === 6 ? "2×3 (6)" : "3×3 (9)"}
                </button>
              ))}
              <button
                onClick={() => setShowSheetPicker(false)}
                className="ml-2 text-muted hover:text-text text-xs"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SHEET_EXPRESSIONS.map((e) => {
              const picked = sheetIds.includes(e.id);
              const idx = sheetIds.indexOf(e.id);
              const full = !picked && sheetIds.length >= sheetCount;
              return (
                <button
                  key={e.id}
                  onClick={() => toggleSheetExpression(e.id)}
                  disabled={full}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    picked
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "border-border text-muted hover:text-text hover:border-border-strong"
                  }`}
                >
                  {picked && <span className="mr-1 text-accent">#{idx + 1}</span>}
                  {e.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleGenerateExpressionSheet}
              disabled={
                sheetGenerating ||
                sheetIds.length !== sheetCount ||
                generating ||
                batchGenerating
              }
              className="px-4 py-2 rounded-lg bg-accent text-bg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sheetGenerating ? "Generating sheet…" : `Generate ${sheetCount}-emotion sheet`}
            </button>
            <span className="text-xs text-muted">
              {sheetIds.length}/{sheetCount} selected
            </span>
          </div>

          {sheetError && (
            <div className="p-2 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
              {sheetError}
            </div>
          )}

          {sheetResult && (
            <div className="border border-border rounded-lg p-3 bg-bg/40">
              <div className="rounded overflow-hidden bg-bg flex items-center justify-center">
                <img
                  src={sheetResult.image_url}
                  alt="Expression sheet"
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSaveExpressionSheet}
                  disabled={sheetSaving}
                  className="px-4 py-1.5 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-medium hover:bg-success/25 transition-colors disabled:opacity-50"
                >
                  {sheetSaving ? "Saving…" : "Save to library"}
                </button>
                <button
                  onClick={handleGenerateExpressionSheet}
                  disabled={sheetGenerating || sheetSaving}
                  className="px-4 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => setSheetResult(null)}
                  className="text-muted hover:text-text text-xs"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Prompt Builder */}
        <div className="space-y-4">
          {/* Reference Image */}
          {character.base_image_url && (
            <div>
              <label className="block text-sm text-muted mb-2">Reference Image</label>
              <div
                className="w-32 h-32 rounded-lg border border-border overflow-hidden cursor-pointer hover:border-accent/40 transition-colors"
                onClick={() => onLightboxOpen(character.base_image_url)}
              >
                <img
                  src={character.base_image_url}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-muted mt-1">
                Sent as reference for character consistency
              </p>
            </div>
          )}

          {/* Clothing Style Selector */}
          <div>
            <label className="block text-sm text-muted mb-2">Clothing Style</label>
            <div className="flex flex-wrap gap-2">
              {CLOTHING_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    setClothingStyle(style.id);
                    if (selectedPose) {
                      const clothing =
                        style.id === "default"
                          ? undefined
                          : style.id === "custom"
                            ? customClothing || undefined
                            : CLOTHING_DESCRIPTIONS[style.id];
                      const prompt = buildPrompt(
                        selectedPose,
                        character.traits as CharacterTraits,
                        character.name,
                        clothing,
                      );
                      setEditedPrompt(prompt);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                    clothingStyle === style.id
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "text-muted border-border hover:border-border-strong hover:text-text"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
            {clothingStyle === "custom" && (
              <input
                type="text"
                value={customClothing}
                onChange={(e) => {
                  setCustomClothing(e.target.value);
                  if (selectedPose) {
                    const prompt = buildPrompt(
                      selectedPose,
                      character.traits as CharacterTraits,
                      character.name,
                      e.target.value || undefined,
                    );
                    setEditedPrompt(prompt);
                  }
                }}
                placeholder="Describe the clothing..."
                className="mt-2 w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
              />
            )}

            {/* Custom clothing details (Improvement #2) — stacks ON TOP of
                whatever preset is selected. Persisted on character.profile. */}
            <div className="mt-2">
              <label className="block text-[11px] text-muted mb-1">
                Style details (optional — stacks with preset)
              </label>
              <input
                type="text"
                value={clothingDetails}
                onChange={(e) => setClothingDetails(e.target.value)}
                onBlur={() => persistClothingDetails(clothingDetails)}
                placeholder="e.g. Red leather jacket with gold buttons, black boots"
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
              />
              <p className="text-[10px] text-muted/60 mt-1">
                Saved on the character — auto-fills next time you open this view.
              </p>
            </div>
          </div>

          {/* Age (collapsible — out of the way for users who don't need it) */}
          <details className="border border-border rounded-lg group">
            <summary className="px-3 py-2 cursor-pointer text-sm text-muted hover:text-text transition-colors flex items-center justify-between list-none">
              <span>
                Age{" "}
                <span className="text-xs text-muted/60">
                  ({agePresetId === "default"
                    ? "as reference"
                    : agePresetId === "custom"
                      ? customAge
                        ? `${customAge} yrs`
                        : "custom"
                      : AGE_PRESETS.find((p) => p.id === agePresetId)?.label || "—"})
                </span>
              </span>
              <span className="text-muted/60 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                {AGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAgePresetId(preset.id)}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                      agePresetId === preset.id
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "text-muted border-border hover:border-border-strong hover:text-text"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {agePresetId === "custom" && (
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customAge}
                  onChange={(e) => setCustomAge(e.target.value)}
                  placeholder="Age in years (e.g. 42)"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              )}
              <p className="text-xs text-muted/60">
                When set, the character will be aged/de-aged to this target while
                keeping their core facial features and identity.
              </p>
            </div>
          </details>

          {/* Per-generation emotional state override (Module 1) */}
          <details className="border border-border rounded-lg group">
            <summary className="px-3 py-2 cursor-pointer text-sm text-muted hover:text-text transition-colors flex items-center justify-between list-none">
              <span>
                Mood / Emotional state{" "}
                <span className="text-xs text-muted/60">
                  ({emotionalOverride
                    ? emotionalOverride === "custom"
                      ? emotionalOverrideCustom || "custom"
                      : EMOTIONAL_STATES.find((e) => e.id === emotionalOverride)?.label || "—"
                    : "use profile default"})
                </span>
              </span>
              <span className="text-muted/60 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmotionalOverride("");
                    setEmotionalOverrideCustom("");
                  }}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                    !emotionalOverride
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "text-muted border-border hover:border-border-strong hover:text-text"
                  }`}
                >
                  Use profile default
                </button>
                {EMOTIONAL_STATES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEmotionalOverride(s.id)}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                      emotionalOverride === s.id
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "text-muted border-border hover:border-border-strong hover:text-text"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEmotionalOverride("custom")}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                    emotionalOverride === "custom"
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "text-muted border-border hover:border-border-strong hover:text-text"
                  }`}
                >
                  Custom…
                </button>
              </div>
              {emotionalOverride === "custom" && (
                <input
                  type="text"
                  value={emotionalOverrideCustom}
                  onChange={(e) => setEmotionalOverrideCustom(e.target.value)}
                  placeholder="Describe the mood…"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors"
                />
              )}
              <p className="text-xs text-muted/60">
                One-off override for this generation. The character&apos;s saved psychology
                profile (temperament, motivation, fear, body language) still applies.
              </p>
            </div>
          </details>

          {/* Cinematography + art style (Modules 7 + 9) */}
          <CinematographyControls value={cinematography} onChange={setCinematography} />

          {/* Pose library (Module 16) */}
          <details className="border border-border rounded-lg group">
            <summary className="px-3 py-2 cursor-pointer text-sm text-muted hover:text-text transition-colors flex items-center justify-between list-none">
              <span>
                Pose library{" "}
                <span className="text-xs text-muted/60">
                  ({poseId
                    ? POSE_LIBRARY.find((p) => p.id === poseId)?.label || poseId
                    : "none"})
                </span>
              </span>
              <span className="text-muted/60 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-3">
              <button
                type="button"
                onClick={() => setPoseId("")}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  poseId === ""
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "border-border text-muted hover:text-text hover:border-border-strong"
                }`}
              >
                None (use pose template)
              </button>
              {(["standing", "seated", "action", "emotional", "professional", "cinematic"] as const).map((cat) => {
                const list = POSE_LIBRARY.filter((p) => p.category === cat);
                return (
                  <div key={cat}>
                    <p className="text-[11px] uppercase tracking-wide text-muted/70 mb-1 capitalize">
                      {cat}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPoseId(p.id)}
                          title={p.description}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                            poseId === p.id
                              ? "bg-accent/15 text-accent border-accent/30"
                              : "border-border text-muted hover:text-text hover:border-border-strong"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted/60">
                Picking a pose appends a CHARACTER POSE clause to the prompt that overrides
                the pose template above. Useful when you want a pose the standard list
                doesn&apos;t cover.
              </p>
            </div>
          </details>

          {/* Model selector (Phase A — multi-provider) */}
          <div>
            <label className="block text-xs text-muted mb-1 uppercase tracking-wide">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/30 transition-colors"
            >
              {availableModels.length === 0 ? (
                <option value="gemini-3.1-flash-image-preview">
                  Gemini 3.1 Flash (image preview)
                </option>
              ) : (
                availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.is_custom ? "custom" : m.provider}
                    {!m.provider_implemented && !m.is_custom ? " · scaffold" : ""})
                  </option>
                ))
              )}
            </select>
            {availableModels.find((m) => m.id === selectedModel)?.provider_implemented === false && (
              <p className="mt-1 text-[11px] text-muted/70 italic">
                This provider is scaffolded but not yet wired for generation. Generation
                will return a 501 until the provider is implemented in src/lib/providers.
              </p>
            )}
          </div>

          {/* Smart prompt suggestions (Module 13) */}
          <details className="border border-border rounded-lg group">
            <summary className="px-3 py-2 cursor-pointer text-sm text-muted hover:text-text transition-colors flex items-center justify-between list-none">
              <span>Suggest a scene</span>
              <span className="text-muted/60 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2">
              <p className="text-[11px] text-muted/70">
                Auto-generated from this character&apos;s saved profile. Click one to drop it
                into the custom prompt and switch to Custom mode.
              </p>
              {(() => {
                const psy = character.profile?.psychology;
                const back = character.profile?.backstory;
                const name = character.name;
                const motivation = psy?.motivation;
                const fear = psy?.fear;
                const emotion = psy?.emotional_state || "contemplative";
                const profession = back?.profession;
                const formative = back?.formative_experience;
                const arcStart = back?.arc_state_start;
                const arcEnd = back?.arc_state_end;
                const turning = back?.arc_turning_point;

                const suggestions: string[] = [];
                if (psy && fear) {
                  suggestions.push(
                    `${name} alone in an empty room at night, the moment they realize their deepest fear (${fear}) might come true.`,
                  );
                }
                if (psy && emotion) {
                  suggestions.push(
                    `${name} in a quiet moment of ${emotion}, framed cinematically, environment fading into background.`,
                  );
                }
                if (motivation) {
                  suggestions.push(
                    `${name} at the height of pursuing what they want most (${motivation}), eyes lit with intent.`,
                  );
                }
                if (back && profession) {
                  suggestions.push(
                    `${name} in a setting that reflects their ${profession.toLowerCase()} background, gear of their trade visible, in a private unguarded moment.`,
                  );
                }
                if (formative) {
                  suggestions.push(
                    `${name} at the moment the formative experience returns to them: "${formative.slice(0, 120)}".`,
                  );
                }
                if (arcStart) {
                  suggestions.push(
                    `${name} at the start of their arc — ${arcStart.slice(0, 100)} — pre-transformation.`,
                  );
                }
                if (arcEnd) {
                  suggestions.push(
                    `${name} at the end of their arc — ${arcEnd.slice(0, 100)} — post-transformation, the changed self.`,
                  );
                }
                if (turning) {
                  suggestions.push(
                    `${name} at the turning point: ${turning.slice(0, 120)}.`,
                  );
                }
                if (suggestions.length === 0) {
                  suggestions.push(
                    `${name} alone in a meaningful place, a single decisive moment captured.`,
                    `${name} caught off-guard, an unguarded expression revealing who they are when no one is watching.`,
                  );
                }
                return (
                  <div className="space-y-1.5">
                    {suggestions.slice(0, 5).map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedCategory("custom");
                          setIsCustom(true);
                          setCustomPrompt(s);
                          setEditedPrompt(s);
                        }}
                        className="block w-full text-left px-3 py-2 rounded-lg border border-border bg-bg/40 hover:bg-accent/5 hover:border-accent/30 text-xs text-text/90 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </details>

          {/* Category selector */}
          <div>
            <label className="block text-sm text-muted mb-2">Image Type</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedPose(null);
                    setIsCustom(cat.id === "custom");
                    if (cat.id === "custom") {
                      handleCustom();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                    selectedCategory === cat.id
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "text-muted border-border hover:border-border-strong hover:text-text"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pose selector (for non-custom) */}
          {selectedCategory !== "custom" && (
            <div>
              <label className="block text-sm text-muted mb-2">Pose / Expression</label>
              <div className="grid grid-cols-2 gap-2">
                {categoryPoses.map((pose) => {
                  const count = getPoseImageCount(pose);
                  return (
                    <button
                      key={pose.id}
                      onClick={() => handlePoseSelect(pose)}
                      className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border relative ${
                        selectedPose?.id === pose.id
                          ? "bg-accent/15 text-accent border-accent/30"
                          : "text-muted border-border hover:border-border-strong hover:text-text"
                      }`}
                    >
                      {pose.label}
                      {count > 0 && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-success/20 text-success text-xs flex items-center justify-center">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prompt textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted">
                {isCustom ? "Custom Prompt" : "Generated Prompt"}
              </label>
              {!isCustom && selectedPose && (
                <span className="text-xs text-accent/60">Editable before sending</span>
              )}
            </div>
            <textarea
              value={isCustom ? customPrompt : editedPrompt}
              onChange={(e) => {
                if (isCustom) {
                  setCustomPrompt(e.target.value);
                } else {
                  setEditedPrompt(e.target.value);
                }
              }}
              placeholder={
                isCustom
                  ? "Describe the image you want to generate..."
                  : "Select a pose above to auto-generate a prompt..."
              }
              rows={6}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/30 transition-colors resize-none font-mono"
            />
          </div>

          {/* Generate button */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating || batchGenerating || (!isCustom && !editedPrompt) || (isCustom && !customPrompt)}
              className="flex-1 py-2.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Generating...
                </span>
              ) : (
                <>
                  <span className="hidden md:inline">Generate with Gemini</span>
                  <span className="md:hidden">Generate</span>
                </>
              )}
            </button>
          </div>

          {error && !errorDetails && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        {/* Right: Result */}
        <div>
          <label className="block text-sm text-muted mb-2">Result</label>
          <div
            className={`aspect-square rounded-lg border overflow-hidden ${
              errorDetails && !generating
                ? "border-danger/40 bg-danger/5"
                : "border-border bg-bg"
            }`}
          >
            {generating ? (
              <div className="w-full h-full skeleton-loader flex items-center justify-center">
                <span className="text-muted text-sm animate-pulse-glow">Generating...</span>
              </div>
            ) : errorDetails ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-3">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-danger/80"
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="space-y-1">
                  <p className="text-sm text-danger font-medium">{errorDetails.title}</p>
                  <p className="text-xs text-text/80 leading-snug max-w-xs">
                    {errorDetails.message}
                  </p>
                  {errorDetails.category && (
                    <p className="text-[10px] uppercase tracking-wide text-muted/60">
                      {errorDetails.category}
                    </p>
                  )}
                </div>
                {errorDetails.canRetry && (
                  <button
                    onClick={handleGenerate}
                    className="mt-2 px-4 py-1.5 rounded-lg bg-accent text-bg font-medium text-sm hover:bg-accent-hover transition-colors"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => setErrorDetails(null)}
                  className="text-[11px] text-muted hover:text-text transition-colors"
                >
                  Dismiss
                </button>
              </div>
            ) : generatedImage ? (
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => onLightboxOpen(generatedImage)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted/30">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
          </div>

          {/* Save / Regenerate buttons */}
          {generatedImage && (
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleSaveToDataset}
                className="flex-1 py-2 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-medium hover:bg-success/25 transition-colors"
              >
                Save to Dataset
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border-strong text-sm transition-colors"
              >
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
