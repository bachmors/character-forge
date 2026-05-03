/**
 * Constants and prompt-injection helpers for the character profile modules:
 *   - Psychology  (Module 1)
 *   - Backstory + Arc  (Module 3)
 *   - Voice  (Module 4)
 *   - Mood Board  (Module 5)
 *
 * All fields are optional. The helpers return an empty string when no
 * meaningful data is present so the surrounding prompt is unaffected.
 */

// ────────────────────────────────────────────────────────────────────────────
// Module 1 — Psychology
// ────────────────────────────────────────────────────────────────────────────

export const TEMPERAMENTS = [
  { id: "sanguine", label: "Sanguine — enthusiastic, social, optimistic" },
  { id: "choleric", label: "Choleric — ambitious, decisive, aggressive" },
  { id: "melancholic", label: "Melancholic — analytical, reserved, perfectionist" },
  { id: "phlegmatic", label: "Phlegmatic — calm, reliable, passive" },
] as const;

export const CORE_MOTIVATIONS = [
  { id: "power", label: "Power / Control" },
  { id: "love", label: "Love / Connection" },
  { id: "knowledge", label: "Knowledge / Truth" },
  { id: "freedom", label: "Freedom / Independence" },
  { id: "security", label: "Security / Stability" },
  { id: "recognition", label: "Recognition / Legacy" },
  { id: "justice", label: "Justice / Fairness" },
] as const;

export const DEEPEST_FEARS = [
  { id: "abandonment", label: "Abandonment" },
  { id: "failure", label: "Failure" },
  { id: "loss_of_control", label: "Loss of control" },
  { id: "insignificance", label: "Insignificance" },
  { id: "betrayal", label: "Betrayal" },
  { id: "death", label: "Death / Mortality" },
  { id: "vulnerability", label: "Vulnerability" },
] as const;

export const EMOTIONAL_STATES = [
  { id: "neutral", label: "Neutral / Composed" },
  { id: "happy", label: "Happy / Joyful" },
  { id: "sad", label: "Sad / Melancholic" },
  { id: "angry", label: "Angry / Frustrated" },
  { id: "fearful", label: "Fearful / Anxious" },
  { id: "confident", label: "Confident / Powerful" },
  { id: "vulnerable", label: "Vulnerable / Exposed" },
  { id: "contemplative", label: "Contemplative / Distant" },
  { id: "passionate", label: "Passionate / Intense" },
  { id: "exhausted", label: "Exhausted / Defeated" },
] as const;

export const BODY_LANGUAGE = [
  { id: "open", label: "Open — expansive, exposed torso, forward lean" },
  { id: "closed", label: "Closed — crossed arms, hunched, self-protective" },
  { id: "controlled", label: "Controlled — precise, minimal gesture" },
  { id: "restless", label: "Restless — fidgeting, shifting, unfocused gaze" },
  { id: "dominant", label: "Dominant — wide stance, direct gaze, space-claiming" },
  { id: "submissive", label: "Submissive — small, peripheral, gaze-avoidant" },
] as const;

export interface PsychologyProfile {
  temperament?: string;        // preset id or custom string
  custom_temperament?: string;
  motivation?: string;
  custom_motivation?: string;
  fear?: string;
  custom_fear?: string;
  emotional_state?: string;
  custom_emotional_state?: string;
  energy?: number;             // 1–10
  body_language?: string;
  notes?: string;
}

function pickLabel<T extends { id: string; label: string }>(
  options: ReadonlyArray<T>,
  id?: string,
  customText?: string,
): string | null {
  if (!id) return null;
  if (id === "custom") return customText?.trim() || null;
  return options.find((o) => o.id === id)?.label.split(" — ")[0].trim() || customText?.trim() || null;
}

/**
 * Builds the CHARACTER PSYCHOLOGY paragraph that gets appended to a
 * generation prompt. Returns "" when no meaningful psychology data is set.
 *
 * @param psychology   The character-level saved profile.
 * @param emotionalStateOverride   Per-generation override id; takes priority.
 */
export function buildPsychologyInstruction(
  psychology?: PsychologyProfile | null,
  emotionalStateOverride?: { id?: string; custom?: string } | null,
): string {
  if (!psychology && !emotionalStateOverride?.id) return "";

  const temperament = pickLabel(TEMPERAMENTS, psychology?.temperament, psychology?.custom_temperament);
  const motivation = pickLabel(CORE_MOTIVATIONS, psychology?.motivation, psychology?.custom_motivation);
  const fear = pickLabel(DEEPEST_FEARS, psychology?.fear, psychology?.custom_fear);
  const emotional =
    pickLabel(
      EMOTIONAL_STATES,
      emotionalStateOverride?.id || psychology?.emotional_state,
      emotionalStateOverride?.custom || psychology?.custom_emotional_state,
    ) || null;
  const body = pickLabel(BODY_LANGUAGE, psychology?.body_language);
  const energy = typeof psychology?.energy === "number" ? psychology.energy : null;

  const segments: string[] = [];
  if (temperament) segments.push(`a ${temperament.toLowerCase()} temperament`);
  if (motivation) segments.push(`motivated by ${motivation.toLowerCase()}`);
  if (fear) segments.push(`deeply afraid of ${fear.toLowerCase()}`);
  if (segments.length === 0 && !emotional && !body && energy === null) return "";

  const lines: string[] = ["CHARACTER PSYCHOLOGY:"];
  if (segments.length > 0) {
    lines.push(`This character has ${segments.join(", ")}.`);
  }
  if (emotional) lines.push(`Current emotional state: ${emotional.toLowerCase()}.`);
  if (energy !== null) lines.push(`Energy level: ${energy}/10.`);
  if (body) lines.push(`Body language tendency: ${body.toLowerCase()}.`);
  lines.push(
    "Reflect this psychology in facial expression, posture, eye contact, and overall energy of the character. The psychology should be VISIBLE in the image without being exaggerated or cartoonish.",
  );
  return lines.join(" ");
}

// ────────────────────────────────────────────────────────────────────────────
// Module 3 — Backstory & Character Arc
// ────────────────────────────────────────────────────────────────────────────

export const PROFESSIONS = [
  { id: "military", label: "Military / Law enforcement", posture: "an alert, upright, controlled posture with firm eye contact and economical movement" },
  { id: "artist", label: "Artist / Creative", posture: "a relaxed, expressive posture with slightly open gestures and an observant gaze" },
  { id: "academic", label: "Academic / Scholar", posture: "a contemplative posture with slight forward lean and analytical expression" },
  { id: "athlete", label: "Athlete / Physical", posture: "a powerful balanced posture, weight evenly distributed, contained physical readiness" },
  { id: "business", label: "Business / Corporate", posture: "a poised composed posture, neutral confident expression, controlled gestures" },
  { id: "medical", label: "Medical / Caregiver", posture: "a steady reassuring posture with attentive expression and grounded stance" },
  { id: "criminal", label: "Criminal / Outlaw", posture: "a wary, peripheral-aware posture with guarded body language" },
  { id: "royal", label: "Royal / Aristocratic", posture: "a regal upright posture, chin slightly raised, deliberate restrained movement" },
  { id: "working_class", label: "Working class / Labor", posture: "an honest grounded posture with weathered confident bearing" },
  { id: "religious", label: "Religious / Spiritual", posture: "a calm centered posture with gentle gaze and patient bearing" },
] as const;

export const PHYSICAL_TRAINING = [
  { id: "none", label: "None / Sedentary", posture: "neutral untrained posture" },
  { id: "athletic", label: "Athletic / Sports", posture: "athletic balanced stance with developed muscle tone visible in posture" },
  { id: "military", label: "Military / Martial", posture: "a precise martial-trained stance, squared shoulders, tactical readiness" },
  { id: "dance", label: "Dance / Ballet", posture: "an elegant elongated posture with turned-out feet and lifted carriage" },
  { id: "labor", label: "Manual labor / Physical work", posture: "a strong functional posture shaped by physical work" },
  { id: "yoga", label: "Yoga / Meditation practice", posture: "a centered grounded posture with even breathing and soft alert expression" },
] as const;

export const ARC_TYPES = [
  { id: "positive", label: "Positive change (flawed → growth)" },
  { id: "negative", label: "Negative change (good → corruption)" },
  { id: "flat", label: "Flat arc (tests beliefs, stays true)" },
  { id: "disillusionment", label: "Disillusionment (naive → cynical)" },
  { id: "fall_rise", label: "Fall and rise (loss → recovery)" },
] as const;

export interface BackstoryProfile {
  origin?: string;
  formative_experience?: string;
  profession?: string;
  custom_profession?: string;
  physical_training?: string;
  key_relationships?: string; // free-text list, one per line
  arc_type?: string;
  arc_state_start?: string;
  arc_state_end?: string;
  arc_turning_point?: string;
}

export function buildBackstoryInstruction(b?: BackstoryProfile | null): string {
  if (!b) return "";
  const profDef = PROFESSIONS.find((p) => p.id === b.profession);
  const trainDef = PHYSICAL_TRAINING.find((t) => t.id === b.physical_training);
  const profession =
    b.profession === "custom"
      ? (b.custom_profession || "").trim()
      : profDef?.label.split(" / ")[0] || "";

  const segments: string[] = [];
  if (profession) segments.push(`a ${profession.toLowerCase()} background`);
  if (trainDef) segments.push(`${trainDef.label.split(" / ")[0].toLowerCase()} training`);
  if (segments.length === 0) return "";

  const lines = ["CHARACTER BACKGROUND:"];
  lines.push(`This character has ${segments.join(" with ")}.`);
  if (profDef?.posture) lines.push(`Their bearing reflects this — ${profDef.posture}.`);
  if (trainDef && trainDef.id !== "none") {
    lines.push(`Their body shows ${trainDef.posture}.`);
  }
  return lines.join(" ");
}

// ────────────────────────────────────────────────────────────────────────────
// Module 4 — Voice (no prompt injection — pure reference data)
// ────────────────────────────────────────────────────────────────────────────

export const SPEECH_PATTERNS = [
  { id: "formal", label: "Formal / Articulate" },
  { id: "casual", label: "Casual / Colloquial" },
  { id: "terse", label: "Terse / Minimal" },
  { id: "verbose", label: "Verbose / Elaborate" },
  { id: "poetic", label: "Poetic / Metaphorical" },
  { id: "technical", label: "Technical / Jargon-heavy" },
  { id: "street", label: "Street / Slang" },
] as const;

export const PITCH_LEVELS = ["low", "medium", "high"] as const;
export const SPEED_LEVELS = ["slow", "medium", "fast"] as const;
export const VOLUME_LEVELS = ["quiet", "medium", "loud"] as const;
export const TEXTURE_LEVELS = ["smooth", "rough", "nasal", "breathy"] as const;

export interface VoiceProfile {
  speech_pattern?: string;
  verbal_tics?: string;
  sample_happy?: string;
  sample_angry?: string;
  characteristic_phrase?: string;
  pitch?: string;
  speed?: string;
  volume?: string;
  texture?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Module 5 — Mood Board (optional prompt injection)
// ────────────────────────────────────────────────────────────────────────────

export interface MoodBoardImage {
  src: string;     // data URL or https URL
  caption?: string;
}

export interface MoodBoardPalette {
  primary?: string;     // hex
  secondary?: string;
  accent?: string;
  shadow?: string;
  highlight?: string;
}

export interface MoodBoardProfile {
  images?: MoodBoardImage[];
  palette?: MoodBoardPalette;
  keywords?: string[];
  notes?: string;
  /** When true, palette+keywords are appended to generation prompts. */
  inject_into_prompts?: boolean;
}

export function buildMoodboardInstruction(m?: MoodBoardProfile | null): string {
  if (!m || !m.inject_into_prompts) return "";
  const colors: string[] = [];
  if (m.palette) {
    for (const v of Object.values(m.palette)) {
      if (typeof v === "string" && v.trim()) colors.push(v.trim());
    }
  }
  const keywords = (m.keywords || []).filter((k) => k && k.trim()).map((k) => k.trim());
  if (colors.length === 0 && keywords.length === 0) return "";
  const lines = ["VISUAL STYLE:"];
  if (colors.length) lines.push(`This character's visual identity uses a color palette of ${colors.join(", ")}.`);
  if (keywords.length) lines.push(`The overall aesthetic is ${keywords.join(", ")}.`);
  return lines.join(" ");
}

// ────────────────────────────────────────────────────────────────────────────
// Combined character profile container
// ────────────────────────────────────────────────────────────────────────────

export interface CharacterProfile {
  psychology?: PsychologyProfile;
  backstory?: BackstoryProfile;
  voice?: VoiceProfile;
  moodboard?: MoodBoardProfile;
}
