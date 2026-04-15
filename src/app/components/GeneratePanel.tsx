"use client";

import { useState, useCallback } from "react";
import {
  STANDARD_POSES, CATEGORIES, CLOTHING_STYLES, CLOTHING_DESCRIPTIONS,
  buildPrompt, type CharacterTraits, type PoseDefinition,
} from "@/lib/prompts";
import { compressImage } from "@/lib/imageUtils";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
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
}

export default function GeneratePanel({ character, images, onImageGenerated }: GeneratePanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("head_rotation");
  const [selectedPose, setSelectedPose] = useState<PoseDefinition | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedModelUsed, setGeneratedModelUsed] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [clothingStyle, setClothingStyle] = useState("default");
  const [customClothing, setCustomClothing] = useState("");

  // Batch generation state
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentPose: "" });
  const [batchErrors, setBatchErrors] = useState<string[]>([]);

  const categoryPoses = STANDARD_POSES.filter((p) => p.category === selectedCategory);

  const getClothingDescription = useCallback(() => {
    if (clothingStyle === "default") return undefined;
    if (clothingStyle === "custom") return customClothing || undefined;
    return CLOTHING_DESCRIPTIONS[clothingStyle] || undefined;
  }, [clothingStyle, customClothing]);

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
    async (prompt: string): Promise<{ image_url: string; model_used: string } | null> => {
      const res = await fetch("/api/generate/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          referenceImageUrl: character.base_image_url || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }
      return { image_url: data.image_url, model_used: data.model_used };
    },
    [character.base_image_url],
  );

  // Compress and save an image
  const saveImage = useCallback(
    async (
      imageUrl: string,
      category: string,
      subcategory: string,
      promptUsed: string,
      modelUsed: string,
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
    setGeneratedImage(null);

    try {
      const result = await generateImage(prompt);
      if (result) {
        setGeneratedImage(result.image_url);
        setGeneratedModelUsed(result.model_used);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
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
      );
      onImageGenerated();
      setGeneratedImage(null);
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
        const prompt = buildPrompt(
          pose,
          character.traits as CharacterTraits,
          character.name,
          getClothingDescription(),
        );
        const result = await generateImage(prompt);
        if (result) {
          await saveImage(
            result.image_url,
            pose.category,
            pose.subcategory,
            prompt,
            result.model_used,
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

  const getPoseImageCount = (pose: PoseDefinition) =>
    images.filter((img) => img.category === pose.category && img.subcategory === pose.subcategory).length;

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-accent text-lg font-semibold">Generate Image</h3>
        <button
          onClick={handleGenerateAll}
          disabled={batchGenerating || generating}
          className="px-4 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/30 text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {batchGenerating ? "Generating..." : "Generate All Poses"}
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Prompt Builder */}
        <div className="space-y-4">
          {/* Reference Image */}
          {character.base_image_url && (
            <div>
              <label className="block text-sm text-muted mb-2">Reference Image</label>
              <div className="w-32 h-32 rounded-lg border border-border overflow-hidden">
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
          </div>

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
                "Generate with Gemini"
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        {/* Right: Result */}
        <div>
          <label className="block text-sm text-muted mb-2">Result</label>
          <div className="aspect-square rounded-lg border border-border bg-bg overflow-hidden">
            {generating ? (
              <div className="w-full h-full skeleton-loader flex items-center justify-center">
                <span className="text-muted text-sm animate-pulse-glow">Generating...</span>
              </div>
            ) : generatedImage ? (
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-full object-contain"
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
