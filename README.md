## Overview

Radia Copilot is a bilingual (EN/ES) Next.js App Router MVP that lets radiologists paste/dictate their transcription, send it to an OpenAI model, and edit/share the structured report the assistant generates. The UI mirrors the `radiance-report-ai` design language (Geist fonts, Tailwind tokens, shadcn/ui components).

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in API keys below
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the app.

### Environment variables

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | Server-side key for the Chat Completions API. |
| `OPENAI_MODEL` | Optional override (defaults to `gpt-4o-mini`). |

Both variables are read inside `app/api/generate-report`. Only keep them in `.env.local` (never commit real credentials).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in dev mode. |
| `npm run build && npm start` | Production build + serve. |
| `npm run lint` | ESLint (Next.js config). |
| `npm run test` | Vitest unit tests for API helpers. |

## Notes

- The language selector persists preference (localStorage + query param) and hydrates on load.
- `/api/generate-report` validates payloads, builds a bilingual prompt, and uses an OpenAI client wrapper to produce a JSON report. A defensive formatter guards against malformed model responses.
- UI components live in `src/components` and reuse the shared Tailwind design tokens defined in `src/app/globals.css`.
