## CLAUDE.md — Character Forge Project

### ⚠️ CRITICAL RULES
* **ALWAYS push directly to `main` branch. NEVER create feature branches.**
* **NEVER change the Gemini model from `gemini-3.1-flash-image-preview`**
* **NEVER add fallback models or switch to raw REST API**
* **The generate route uses `@google/genai` SDK — keep it that way**
* Push command: `git add -A && git commit -m "message" && git push origin main`

### Overview
Character Forge is an AI character dataset manager for video generation pipelines.
It manages consistent character image datasets (poses, expressions, body shots) for use with Runway, Kling, Luma, etc.

### Quick Context
* Part of the HNV pipeline: Character Forge -> JSONGen -> VideoJSONGen -> Video platforms
* Characters have base images + traits that auto-populate generation prompts
* Image generation via Gemini API (gemini-3.1-flash-image-preview / Nano Banana 2)
* Image analysis via Gemini API (gemini-2.5-flash for text analysis of uploaded images)
* Deploy target: Vercel (auto-deploys from main branch)
* Design: dark cinematic theme, gold accents (#c4a35a on #0a0a0f)

### Tech Stack
* Next.js 14 App Router + TypeScript
* Tailwind CSS with custom dark theme
* MongoDB Atlas (db: character_forge)
* iron-session for encrypted API key storage in cookies
* @google/genai SDK for Gemini API calls

### Commands
```
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Lint code
```

### Database
* MongoDB Atlas — collections: characters, character_images
* Connection via MONGODB_URI env var

### Environment Variables
```
MONGODB_URI=mongodb+srv://...
GOOGLE_AI_API_KEY=...
SESSION_SECRET=random-32-char-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### API Routes
* /api/characters — CRUD for characters
* /api/images — CRUD for character images (ALWAYS compress with imageUtils before saving)
* /api/generate/gemini — Image generation via Gemini SDK (model: gemini-3.1-flash-image-preview)
* /api/analyze/gemini — Image analysis via Gemini SDK (model: gemini-2.5-flash)
* /api/settings — Save/load API keys to encrypted session

### Image Handling
* Generated images from Gemini are ~2-3MB base64
* MUST compress with `compressImage()` from `src/lib/imageUtils.ts` before saving to MongoDB
* Vercel has 4.5MB request body limit — uncompressed images will cause 413 errors
* Compressed images are ~200-400KB JPEG quality 0.8

### Fonts
* DM Sans — UI
* JetBrains Mono — code/metadata
* Cormorant Garamond — headings
