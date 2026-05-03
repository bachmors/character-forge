/**
 * Constants and prompt-builder helpers for multi-character scene generation.
 * Used by both the Duo (/duo) and Group (/groups) flows and by the shared
 * /api/generate/multi route.
 */

export interface SceneFormat {
  id: string;
  label: string;
  /** Inserted into the prompt under "SCENE:". Should describe composition. */
  description: string;
  /** Which modes this format is offered in. */
  modes: ReadonlyArray<"duo" | "group">;
}

export interface SceneDynamic {
  id: string;
  label: string;
  description: string;
  modes: ReadonlyArray<"duo" | "group">;
}

export interface SceneSetting {
  id: string;
  label: string;
  description: string;
}

export const SCENE_FORMATS: SceneFormat[] = [
  // Duo
  { id: "portrait_side_by_side", label: "Portrait side by side", description: "Both characters standing side by side facing the camera, vertical framing, symmetrical composition.", modes: ["duo"] },
  { id: "conversation", label: "Conversation", description: "Both characters angled toward each other in conversation, three-quarter framing, eye contact between them.", modes: ["duo"] },
  { id: "walking_together", label: "Walking together", description: "Full body shot of both characters walking together in the same direction, mid-stride, environmental context visible.", modes: ["duo"] },
  { id: "seated", label: "Seated", description: "Both characters seated together (at a table, on a bench, or similar), waist-up framing.", modes: ["duo"] },
  { id: "cinematic_wide", label: "Cinematic wide", description: "Wide cinematic landscape framing showing both characters within an environment, cinematic color grading, atmospheric.", modes: ["duo", "group"] },
  { id: "close_up_duo", label: "Close-up duo", description: "Tight close-up framing of both faces, intimate composition.", modes: ["duo"] },
  { id: "action", label: "Action", description: "Dynamic action pose, both characters mid-movement, sense of motion and energy.", modes: ["duo"] },

  // Group
  { id: "team_photo", label: "Team photo", description: "All characters facing camera in a team photo arrangement, arranged by height with taller characters at the back, professional posture.", modes: ["group"] },
  { id: "round_table", label: "Round table", description: "All characters seated around a round table, slightly elevated camera angle showing each face clearly.", modes: ["group"] },
  { id: "walking_group", label: "Walking group", description: "All characters walking together as a group in the same direction, full body framing, sense of forward motion.", modes: ["group"] },
  { id: "lineup", label: "Lineup", description: "All characters arranged in a side-by-side line, evenly spaced, formal stance, facing camera.", modes: ["group"] },
  { id: "candid_group", label: "Candid group", description: "Natural candid arrangement, some characters looking at camera, some looking off, relaxed informal energy.", modes: ["group"] },
  { id: "hierarchy", label: "Hierarchy", description: "One character positioned center/front as the focal point, others arranged around them in a hierarchical composition.", modes: ["group"] },
];

export const SCENE_DYNAMICS: SceneDynamic[] = [
  // Duo
  { id: "neutral", label: "Neutral", description: "No specific emotional dynamic between the characters, neutral expressions and posture.", modes: ["duo", "group"] },
  { id: "friendly", label: "Friendly", description: "Warm, comfortable energy between the characters, relaxed smiles, easy posture.", modes: ["duo", "group"] },
  { id: "professional", label: "Professional", description: "Formal, business-like energy, composed posture, professional demeanor.", modes: ["duo", "group"] },
  { id: "romantic", label: "Romantic", description: "Intimate close energy, soft expressions, body language suggesting closeness and affection.", modes: ["duo"] },
  { id: "confrontational", label: "Confrontational", description: "Tension between the characters, body language suggesting conflict or distance, intense expressions.", modes: ["duo"] },
  { id: "mentor_student", label: "Mentor / Student", description: "One character clearly in a guiding/teaching role, the other listening and learning, asymmetric energy.", modes: ["duo"] },
  { id: "parent_child", label: "Parent / Child", description: "One character protective and nurturing toward the other, body language suggesting care and family bond.", modes: ["duo"] },
  { id: "rivals", label: "Rivals", description: "Competitive energy between the characters, posture suggesting opposition and challenge.", modes: ["duo"] },

  // Group
  { id: "team", label: "Team / Colleagues", description: "Professional group dynamic, colleagues working together, unified but composed energy.", modes: ["group"] },
  { id: "family", label: "Family", description: "Multi-generational family group, warm familial energy, body language suggesting close relationships and care.", modes: ["group"] },
  { id: "friends", label: "Friends", description: "Casual relaxed group of friends, informal body language, warm comfortable energy.", modes: ["group"] },
  { id: "formal_gathering", label: "Formal gathering", description: "Formal group at a ceremony or event, composed posture, dignified atmosphere.", modes: ["group"] },
];

export const SCENE_SETTINGS: SceneSetting[] = [
  { id: "studio", label: "Studio", description: "Clean neutral light gray studio background, even soft lighting." },
  { id: "urban", label: "Urban", description: "Urban environment such as a city street or cafe, contemporary architecture in the background, natural city light." },
  { id: "nature", label: "Nature", description: "Outdoor natural environment such as a park, forest, or beach, natural daylight, organic background." },
  { id: "interior", label: "Interior", description: "Interior setting such as a living room or office, warm interior lighting, furniture and architectural elements visible." },
  { id: "custom", label: "Custom…", description: "" },
];

export type ModeId = "duo" | "group";

export interface CharacterPromptInput {
  /** Display name for the character (used in the prompt). */
  name: string;
  /** Profile description (often the character's "description" field). */
  description?: string;
  /** Free-text traits summary (hair/skin/etc). Optional but improves identity preservation. */
  traits?: string;
  /** The pre-resolved clothing description, or null/undefined for "as reference". */
  clothing?: string | null;
  /** Pre-resolved numeric age, or null/undefined for "as reference". */
  age?: number | null;
}

export interface BuildMultiScenePromptArgs {
  mode: ModeId;
  characters: CharacterPromptInput[];
  /** Format id from SCENE_FORMATS. */
  format: string;
  /** Dynamic id from SCENE_DYNAMICS. */
  attitude: string;
  /** Setting id from SCENE_SETTINGS. */
  setting: string;
  /** Free-text override for "custom" setting. */
  customSetting?: string;
}

const POSITION_LABELS_DUO = ["left/primary", "right/secondary"];
const POSITION_LABELS_GROUP = [
  "leftmost",
  "center-left",
  "center",
  "center-right",
  "rightmost",
  "back",
];

function positionLabel(mode: ModeId, index: number, total: number): string {
  if (mode === "duo") return POSITION_LABELS_DUO[index] || `position ${index + 1}`;
  // group
  if (total <= POSITION_LABELS_GROUP.length) return POSITION_LABELS_GROUP[index] || `position ${index + 1}`;
  return `position ${index + 1}`;
}

/**
 * Produces the user-text portion of the multimodal Gemini request. Reference
 * images are passed as separate inlineData parts and the prompt refers to
 * them by 1-based ordinal ("reference image #1", "#2"...) so the model can
 * bind each character to its own face/body without cross-contamination.
 */
export function buildMultiScenePrompt(args: BuildMultiScenePromptArgs): string {
  const { mode, characters, format, attitude, setting, customSetting } = args;
  const formatDef = SCENE_FORMATS.find((f) => f.id === format);
  const attitudeDef = SCENE_DYNAMICS.find((d) => d.id === attitude);
  const settingDef = SCENE_SETTINGS.find((s) => s.id === setting);

  const settingText =
    setting === "custom"
      ? (customSetting || "").trim() || "neutral background"
      : settingDef?.description || settingDef?.label || "neutral background";

  const n = characters.length;
  const dynamicLabel = mode === "duo" ? "RELATIONSHIP DYNAMIC" : "GROUP DYNAMIC";

  const lines: string[] = [];
  lines.push(`Generate a single image containing ${n} characters together.`);
  lines.push("");

  characters.forEach((c, i) => {
    const ord = i + 1;
    const pos = positionLabel(mode, i, n);
    const ageText =
      typeof c.age === "number" && c.age > 0
        ? `approximately ${c.age} years old (naturally aged/de-aged from the reference, preserving core facial features)`
        : "as in the reference";
    const clothingText =
      c.clothing && c.clothing.trim()
        ? `${c.clothing.trim()} (override any clothing visible in the reference image)`
        : "consistent with this character's typical wardrobe";

    lines.push(`CHARACTER ${ord} (position: ${pos}, identified by reference image #${ord}):`);
    lines.push(`- Name: ${c.name}`);
    if (c.description && c.description.trim()) lines.push(`- Description: ${c.description.trim()}`);
    if (c.traits && c.traits.trim()) lines.push(`- Distinguishing traits: ${c.traits.trim()}`);
    lines.push(
      `- Use reference image #${ord} ONLY for facial features, body type, hair, skin, and identity — NOT for clothing.`,
    );
    lines.push(`- Clothing: ${clothingText}`);
    lines.push(`- Age: ${ageText}`);
    lines.push("");
  });

  lines.push(`SCENE: ${formatDef?.description || formatDef?.label || "natural composition"}`);
  lines.push(`${dynamicLabel}: ${attitudeDef?.description || attitudeDef?.label || "neutral"}`);
  lines.push(`SETTING: ${settingText}`);
  lines.push("");
  lines.push(
    `CRITICAL: Each of the ${n} characters must be clearly recognizable as a DISTINCT INDIVIDUAL from their respective reference image. ${n} DIFFERENT FACES, ${n} DIFFERENT BODY TYPES, ${n} DIFFERENT HAIR. Do NOT blend their features. Do NOT make any two characters look like the same person. Each character keeps their identity from their own numbered reference image only. Override any clothing visible in the reference images and apply the clothing specified above for each character.`,
  );

  return lines.join("\n");
}

/** Compact summary for storing/displaying scene parameters next to images. */
export interface StoredSceneParams {
  format: string;
  attitude: string;
  setting: string;
  customSetting?: string;
  per_character: Array<{
    character_id: string;
    age: number | null;
    clothing_style: string | null;
    clothing_description: string | null;
  }>;
}
