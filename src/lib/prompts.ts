export interface CharacterTraits {
  hair?: string;
  accessories?: string;
  skin?: string;
  expression_default?: string;
  clothing_base?: string;
  [key: string]: string | undefined;
}

export interface PoseDefinition {
  id: string;
  label: string;
  category: "head_rotation" | "expression" | "body" | "custom";
  subcategory: string;
  promptTemplate: string;
}

function buildTraitsString(traits: CharacterTraits, omitClothingBase = false): string {
  const parts: string[] = [];
  if (traits.skin) parts.push(traits.skin);
  if (traits.hair) parts.push(traits.hair);
  if (traits.accessories) parts.push(`wearing ${traits.accessories}`);
  if (!omitClothingBase && traits.clothing_base) parts.push(`in ${traits.clothing_base}`);
  return parts.join(", ") || "the character";
}

export function buildPrompt(
  pose: PoseDefinition,
  traits: CharacterTraits,
  characterName: string,
  clothingOverride?: string
): string {
  const hasClothingOverride = Boolean(clothingOverride);
  const traitsStr = buildTraitsString(traits, hasClothingOverride);
  const expression = traits.expression_default || "neutral";
  const clothing = clothingOverride || traits.clothing_base || "clothing";

  return pose.promptTemplate
    .replace(/\[CHARACTER_TRAITS\]/g, traitsStr)
    .replace(/\[CHARACTER_NAME\]/g, characterName)
    .replace(/\[EXPRESSION\]/g, expression)
    .replace(/\[ACCESSORIES\]/g, traits.accessories || "accessories")
    .replace(/\[HAIR\]/g, traits.hair || "hair")
    .replace(/\[CLOTHING\]/g, clothing);
}

export const STANDARD_POSES: PoseDefinition[] = [
  // HEAD ROTATION (7 poses)
  {
    id: "front_facing",
    label: "Front Facing",
    category: "head_rotation",
    subcategory: "front_facing",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head facing directly forward, symmetrical pose. Eyes making direct contact with camera. [EXPRESSION] expression. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "three_quarter_left",
    label: "Three Quarter Left",
    category: "head_rotation",
    subcategory: "three_quarter_left",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head turned approximately 45 degrees to her left (the viewer's right). Eyes maintain direct contact with camera. [EXPRESSION] expression preserved. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "profile_left",
    label: "Profile Left",
    category: "head_rotation",
    subcategory: "profile_left",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head turned 90 degrees to the left, showing full left profile. [EXPRESSION] expression preserved. [HAIR] visible from the side. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "three_quarter_right",
    label: "Three Quarter Right",
    category: "head_rotation",
    subcategory: "three_quarter_right",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head turned approximately 45 degrees to her right (the viewer's left). Eyes maintain direct contact with camera. [EXPRESSION] expression preserved. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "profile_right",
    label: "Profile Right",
    category: "head_rotation",
    subcategory: "profile_right",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head turned 90 degrees to the right, showing full right profile. [EXPRESSION] expression preserved. [HAIR] visible from the side. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "looking_up",
    label: "Looking Up",
    category: "head_rotation",
    subcategory: "looking_up",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head tilted slightly upward, chin raised. Eyes looking upward. [EXPRESSION] expression. [ACCESSORIES] visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "looking_down",
    label: "Looking Down",
    category: "head_rotation",
    subcategory: "looking_down",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Head tilted slightly downward, chin lowered. Eyes looking downward. [EXPRESSION] expression. [ACCESSORIES] visible. Flat, even studio lighting against clean neutral light gray background.",
  },

  // EXPRESSIONS (6 poses)
  {
    id: "subtle_smile",
    label: "Subtle Smile",
    category: "expression",
    subcategory: "subtle_smile",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Front facing. A gentle, subtle smile with lips barely parted. Warm, approachable expression. Eyes soft and inviting. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "wide_smile",
    label: "Wide Smile",
    category: "expression",
    subcategory: "wide_smile",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Front facing. A broad, open smile showing teeth. Genuine joy and happiness in the expression. Eyes bright and crinkled. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "anger",
    label: "Anger",
    category: "expression",
    subcategory: "anger",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Front facing. An angry expression with furrowed brows, tense jaw, and narrowed eyes. Intense and fierce. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "surprise",
    label: "Surprise",
    category: "expression",
    subcategory: "surprise",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Front facing. A surprised expression with raised eyebrows, wide open eyes, and slightly open mouth. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "sadness",
    label: "Sadness",
    category: "expression",
    subcategory: "sadness",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Front facing. A sad, melancholic expression with downturned mouth, slightly furrowed brows, and glistening eyes. Vulnerable and emotional. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "fish_face",
    label: "Fish Face / Duck Lips",
    category: "expression",
    subcategory: "fish_face",
    promptTemplate:
      "A studio portrait of [CHARACTER_TRAITS]. Front facing. Lips pursed outward in a playful fish face / duck lips pose. Cheeks slightly sucked in. Playful and fun expression. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },

  // BODY (4 poses)
  {
    id: "medium_shot",
    label: "Medium Shot",
    category: "body",
    subcategory: "medium_shot",
    promptTemplate:
      "A studio medium shot of [CHARACTER_TRAITS]. Framed from waist up. [EXPRESSION] expression. Natural, relaxed pose with arms at sides. [CLOTHING] clearly visible. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "full_body_front",
    label: "Full Body Front",
    category: "body",
    subcategory: "full_body_front",
    promptTemplate:
      "A full body studio shot of [CHARACTER_TRAITS]. Standing facing directly forward. [EXPRESSION] expression. Natural standing pose. Full outfit visible from head to feet: [CLOTHING]. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "full_body_back",
    label: "Full Body Back",
    category: "body",
    subcategory: "full_body_back",
    promptTemplate:
      "A full body studio shot of [CHARACTER_TRAITS] seen from behind. Standing with back to camera. Full outfit visible from behind: [CLOTHING]. [HAIR] visible from behind. Flat, even studio lighting against clean neutral light gray background.",
  },
  {
    id: "t_pose",
    label: "T-Pose",
    category: "body",
    subcategory: "t_pose",
    promptTemplate:
      "A full body studio shot of [CHARACTER_TRAITS]. Standing in a T-pose with arms extended horizontally to both sides, palms facing down. [EXPRESSION] expression. Full outfit visible: [CLOTHING]. [ACCESSORIES] fully visible. Flat, even studio lighting against clean neutral light gray background.",
  },
];

export const CATEGORIES = [
  { id: "head_rotation", label: "Head Rotation", icon: "rotate" },
  { id: "expression", label: "Expressions", icon: "smile" },
  { id: "body", label: "Body", icon: "body" },
  { id: "custom", label: "Custom", icon: "custom" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CLOTHING_STYLES = [
  { id: "default", label: "Default (Character Base)" },
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "sporty", label: "Sporty" },
  { id: "fantasy", label: "Fantasy" },
  { id: "scifi", label: "Sci-Fi" },
  { id: "medieval", label: "Medieval" },
  { id: "custom", label: "Custom" },
] as const;

export const AGE_PRESETS = [
  { id: "default", label: "As reference", value: null as number | null },
  { id: "child", label: "Child (5-10)", value: 8 },
  { id: "teenager", label: "Teenager (13-17)", value: 15 },
  { id: "young_adult", label: "Young Adult (20-25)", value: 22 },
  { id: "adult", label: "Adult (30-40)", value: 35 },
  { id: "middle_aged", label: "Middle-aged (45-55)", value: 50 },
  { id: "senior", label: "Senior (65-75)", value: 70 },
  { id: "elderly", label: "Elderly (80+)", value: 82 },
  { id: "custom", label: "Custom age…", value: null as number | null },
] as const;

export type AgePresetId = (typeof AGE_PRESETS)[number]["id"];

/**
 * Returns a strong, explicit instruction string to append to a generation
 * prompt that forces Gemini to apply the chosen clothing style and
 * override any clothing visible in the reference image.
 *
 * Returns an empty string when no clothing override is provided
 * (i.e. user kept "default" / character base clothing).
 */
export function buildClothingInstruction(clothing: string | null | undefined): string {
  if (!clothing || !clothing.trim()) return "";
  return ` IMPORTANT: The character MUST be wearing ${clothing.trim()}. This clothing style is REQUIRED — override any clothing visible in the reference image. The reference image is ONLY for facial features, body type, hair, skin, and identity, NOT for clothing.`;
}

/**
 * Returns an instruction string to append to a generation prompt for the
 * requested age, or an empty string when no age modification is requested.
 *
 * @param age Numeric target age, or null/undefined to skip age modification.
 */
export function buildAgeInstruction(age: number | null | undefined): string {
  if (age === null || age === undefined || Number.isNaN(age)) return "";
  return ` Generate this character at approximately ${age} years old. Maintain their core facial features, bone structure, and distinguishing characteristics, but naturally age/de-age them to match the target age. Show appropriate signs of aging (or youth) in skin, hair, body posture, and facial features.`;
}

// Pose library (Module 16). Each preset has a description that gets
// injected into the prompt when the user picks it.
export interface PosePreset {
  id: string;
  label: string;
  category: "standing" | "seated" | "action" | "emotional" | "professional" | "cinematic";
  description: string;
}

export const POSE_LIBRARY: PosePreset[] = [
  // Standing
  { id: "neutral_standing", label: "Neutral standing", category: "standing", description: "standing in a relaxed neutral pose, weight evenly distributed, arms at sides" },
  { id: "arms_crossed", label: "Arms crossed", category: "standing", description: "standing with arms crossed across the chest, closed body language" },
  { id: "hands_in_pockets", label: "Hands in pockets", category: "standing", description: "standing with hands in pockets, casual relaxed posture" },
  { id: "leaning", label: "Leaning", category: "standing", description: "leaning casually against a wall or surface, weight on one leg" },
  { id: "power_pose", label: "Power pose", category: "standing", description: "wide confident power stance, hands on hips, chest open, chin slightly raised" },
  { id: "relaxed_standing", label: "Relaxed", category: "standing", description: "standing in a loose easy posture, slight lean, low tension" },
  // Seated
  { id: "chair", label: "Seated in chair", category: "seated", description: "seated upright in a chair, feet on the floor, hands resting" },
  { id: "floor", label: "Seated on floor", category: "seated", description: "seated on the floor, knees up, casual relaxed posture" },
  { id: "edge", label: "On edge of surface", category: "seated", description: "perched on the edge of a desk or windowsill, one leg dangling" },
  { id: "cross_legged", label: "Cross-legged", category: "seated", description: "seated cross-legged, hands resting on knees, centered grounded posture" },
  { id: "slouched", label: "Slouched", category: "seated", description: "seated slouched into the chair, low energy, rounded shoulders" },
  // Action
  { id: "walking", label: "Walking", category: "action", description: "mid-stride walking forward, natural gait, sense of movement" },
  { id: "running", label: "Running", category: "action", description: "running mid-stride, dynamic motion, hair and clothing in motion" },
  { id: "fighting_stance", label: "Fighting stance", category: "action", description: "balanced fighting stance, weight low, hands raised in guard" },
  { id: "dancing", label: "Dancing", category: "action", description: "in motion mid-dance, expressive limbs, sense of rhythm" },
  { id: "reaching", label: "Reaching", category: "action", description: "reaching toward something off-camera, body extended, focused gaze" },
  // Emotional
  { id: "praying", label: "Praying", category: "emotional", description: "hands clasped or palms together, head slightly bowed, contemplative" },
  { id: "crying", label: "Crying", category: "emotional", description: "tears on the face, expression of grief, shoulders slightly hunched" },
  { id: "laughing", label: "Laughing", category: "emotional", description: "head tilted back in laughter, mouth open, eyes crinkled with joy" },
  { id: "covering_face", label: "Covering face", category: "emotional", description: "hands raised to cover the face, hiding emotion or vulnerability" },
  { id: "looking_up", label: "Looking up", category: "emotional", description: "head tilted upward, eyes looking up, contemplative or hopeful" },
  // Professional
  { id: "at_desk", label: "At desk", category: "professional", description: "seated at a desk, focused on work, papers or laptop in front" },
  { id: "presenting", label: "Presenting", category: "professional", description: "mid-presentation gesture, one hand raised, confident open stance" },
  { id: "handshake", label: "Handshake", category: "professional", description: "extending hand for a handshake, professional posture" },
  { id: "on_phone", label: "On phone", category: "professional", description: "phone held to the ear or in hand, mid-conversation expression" },
  // Cinematic
  { id: "over_shoulder", label: "Looking over shoulder", category: "cinematic", description: "looking back over the shoulder toward the camera, body turned away" },
  { id: "silhouette", label: "Silhouette", category: "cinematic", description: "standing as a backlit silhouette, identifiable by outline only" },
  { id: "walking_away", label: "Walking away", category: "cinematic", description: "walking away from the camera into the distance, back to viewer" },
  { id: "doorway", label: "Through doorway", category: "cinematic", description: "framed in a doorway, threshold composition, light from beyond" },
];

/**
 * Returns a CHARACTER POSE block when a known pose id is provided.
 */
export function buildPoseInstruction(poseId?: string | null): string {
  if (!poseId) return "";
  const def = POSE_LIBRARY.find((p) => p.id === poseId);
  if (!def) return "";
  return [
    "CHARACTER POSE:",
    `${def.description}.`,
    "The character should be in this specific pose. Maintain natural body proportions and physics.",
  ].join(" ");
}

export const CLOTHING_DESCRIPTIONS: Record<string, string> = {
  default: "",
  casual: "casual everyday clothing like jeans and a comfortable top",
  formal: "elegant formal attire, suit or evening dress",
  sporty: "athletic sportswear, activewear",
  fantasy: "fantasy-style clothing with ornate magical details, robes or armor",
  scifi: "futuristic sci-fi clothing with tech elements, sleek bodysuit or uniform",
  medieval: "medieval-era clothing, tunic, leather armor, or period dress",
  custom: "",
};
