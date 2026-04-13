"use client";

import { useState } from "react";
import { STANDARD_POSES, CATEGORIES, buildPrompt, type CharacterTraits, type PoseDefinition } from "@/lib/prompts";

interface Character {
  _id: string;
  name: string;
  description: string;
  base_image_url: string;
  traits: Record<string, string>;
}

interface GeneratePanelProps {
  character: Character;
  onImageGenerated: () => void;
}

export default function GeneratePanel({ character, onImageGenerated }: GeneratePanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("head_rotation");
  const [selectedPose, setSelectedPose] = useState<PoseDefinition | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryPoses = STANDARD_POSES.filter((p) => p.category === selectedCategory);

  const handlePoseSelect = (pose: PoseDefinition) => {
    setSelectedPose(pose);
    setIsCustom(false);
    const prompt = buildPrompt(pose, character.traits as CharacterTraits, character.name);
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

  const handleGenerate = async () => {
    const prompt = isCustom ? customPrompt : editedPrompt;
    if (!prompt.trim()) return;

    setGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
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
        setError(data.error || "Generation failed");
        return;
      }

      setGeneratedImage(data.image_url);
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToDataset = async () => {
    if (!generatedImage) return;

    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: character._id,
          category: isCustom ? "custom" : selectedPose?.category,
          subcategory: isCustom ? "custom" : selectedPose?.subcategory,
          image_url: generatedImage,
          prompt_used: isCustom ? customPrompt : editedPrompt,
          model_used: "gemini-2.0-flash-exp",
        }),
      });

      if (res.ok) {
        onImageGenerated();
        setGeneratedImage(null);
      }
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  return (
    <div className="p-6 animate-fade-in">
      <h3 className="font-serif text-accent text-lg font-semibold mb-4">Generate Image</h3>

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
                      setEditedPrompt(customPrompt);
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
                {categoryPoses.map((pose) => (
                  <button
                    key={pose.id}
                    onClick={() => handlePoseSelect(pose)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                      selectedPose?.id === pose.id
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "text-muted border-border hover:border-border-strong hover:text-text"
                    }`}
                  >
                    {pose.label}
                  </button>
                ))}
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
              disabled={generating || (!isCustom && !editedPrompt) || (isCustom && !customPrompt)}
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
