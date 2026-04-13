## CLAUDE.md — Character Forge Project

### Overview
Character Forge is an AI character dataset manager for video generation pipelines.
It manages consistent character image datasets (poses, expressions, body shots) for use with Runway, Kling, Luma, etc.

### Quick Context
* Part of the HNV pipeline: Character Forge -> JSONGen -> VideoJSONGen -> Video platforms
* Characters have base images + traits that auto-populate generation prompts
* Image generation via Gemini API (MVP), with multi-model support planned
* Deploy target: Vercel
* Design: dark cinematic theme, gold accents (#c4a35a on #0a0a0f)

### Tech Stack
* Next.js 14 App Router + TypeScript
* Tailwind CSS with custom dark theme
* MongoDB Atlas (db: character_forge)
* iron-session for encrypted API key storage in cookies
* Google AI (Gemini) for image generation

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
* /api/images — CRUD for character images
* /api/generate/gemini — Image generation via Gemini API
* /api/settings — Save/load API keys to encrypted session

### Fonts
* DM Sans — UI
* JetBrains Mono — code/metadata
* Cormorant Garamond — headings
