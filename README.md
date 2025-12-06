## Overview

Radia Copilot is a bilingual (EN/ES) Next.js App Router application that helps radiologists generate structured medical reports from transcriptions. The system uses AI to automatically detect the study type, load the appropriate template, and generate professional reports following medical standards.

### Key Features

- **Dynamic Template System**: Automatically detects study type using LLM and loads corresponding templates
- **Bilingual Support**: Full support for English and Spanish
- **Template-Based Generation**: Reports follow structured templates that ensure consistency
- **Fallback Mechanism**: If a specific template isn't found, uses keyword-based search as fallback
- **Clean Architecture**: Separation of concerns with services, types, and clients

The UI mirrors the `radiance-report-ai` design language (Geist fonts, Tailwind tokens, shadcn/ui components).

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

## Architecture

### Template System

The application uses a dynamic template system that:

1. **Detects study type** using LLM analysis of the transcription
2. **Loads template** from `src/app/api/templates/{language}/{studyType}.md`
3. **Falls back** to keyword-based search if template not found
4. **Injects template** into the system prompt dynamically

### Directory Structure

```
src/app/api/
├── templates/              # Template files
│   ├── es/                # Spanish templates
│   │   ├── ultrasound-abdominal.md
│   │   ├── ultrasound-abdominal.metadata.json
│   │   └── ...
│   └── en/                # English templates
├── services/              # Business logic
│   ├── studyTypeDetector.ts    # LLM-based study type detection
│   ├── templateLoader.ts        # Template loading and caching
│   ├── templateSearcher.ts      # Keyword-based template search
│   └── promptBuilder.ts         # Dynamic prompt construction
├── clients/               # External service clients
│   └── openaiClient.ts    # OpenAI API wrapper
└── prompts/               # Base system prompts
    ├── es.md
    └── en.md
```

## Adding New Templates

To add a new template, create two files in the appropriate language directory:

### Step 1: Create Template File

Create `src/app/api/templates/{language}/{studyType}.md` with the report structure:

```markdown
ECOGRAFÍA DE TIROIDES

Tiroides: de forma, tamaño y ecogenicidad conservados. La estructura del parénquima es homogénea en ambos lóbulos.
Lóbulo derecho: dimensiones __ mm (LxAPxTR). Ecoestructura homogénea.
Lóbulo izquierdo: dimensiones __ mm (LxAPxTR). Ecoestructura homogénea.
Istmo: de grosor conservado, mide __ mm.
Ganglios cervicales: no se observan adenomegalias.

No se observan nódulos ni lesiones focales al momento del estudio.
```

**Important**: Use `__ mm` placeholders for missing measurements (never invent values).

### Step 2: Create Metadata File

Create `src/app/api/templates/{language}/{studyType}.metadata.json`:

```json
{
  "studyType": "ultrasound-thyroid",
  "modality": "ultrasound",
  "region": "thyroid",
  "keywords": [
    "ecografía tiroides",
    "ultrasonido tiroides",
    "tiroides",
    "lóbulo derecho",
    "lóbulo izquierdo",
    "istmo",
    "nódulo tiroideo",
    "ganglios cervicales"
  ],
  "requiredKeywords": ["tiroides", "tiroideo"],
  "excludeKeywords": []
}
```

### Metadata Fields

| Field | Type | Description | Required |
| --- | --- | --- | --- |
| `studyType` | string | Unique template identifier (must match filename) | Yes |
| `modality` | string | Study modality: "ultrasound", "ct", "mri", "xray", "ecodoppler" | Yes |
| `region` | string | Anatomic region: "abdomen", "chest", "brain", "thyroid", etc. | No |
| `keywords` | string[] | Keywords that may appear in transcriptions | Yes |
| `requiredKeywords` | string[] | Keywords that MUST be present for this template | No |
| `excludeKeywords` | string[] | Keywords that EXCLUDE this template | No |

### Naming Convention

- Use **kebab-case**: `ultrasound-thyroid`, `ct-chest-withContrast`, `mri-brain`
- Be **descriptive**: Name should clearly indicate study type
- Be **consistent**: Same name for both `.md` and `.metadata.json` files

### Best Practices

1. **Keywords**: Include variations and synonyms (e.g., "ecografía", "ultrasonido", "ultrasound")
2. **Structure**: Follow the template format - one organ/structure per line
3. **Placeholders**: Use `__ mm` for missing measurements
4. **Bilingual**: Create versions in both `es/` and `en/` directories
5. **Testing**: Test with sample transcriptions to ensure proper detection

### Example: Complete Template

**File**: `src/app/api/templates/es/ultrasound-thyroid.md`
```markdown
ECOGRAFÍA DE TIROIDES

Tiroides: de forma, tamaño y ecogenicidad conservados. La estructura del parénquima es homogénea en ambos lóbulos.
Lóbulo derecho: dimensiones __ mm (LxAPxTR). Ecoestructura homogénea.
Lóbulo izquierdo: dimensiones __ mm (LxAPxTR). Ecoestructura homogénea.
Istmo: de grosor conservado, mide __ mm.
Ganglios cervicales: no se observan adenomegalias.

No se observan nódulos ni lesiones focales al momento del estudio.
```

**File**: `src/app/api/templates/es/ultrasound-thyroid.metadata.json`
```json
{
  "studyType": "ultrasound-thyroid",
  "modality": "ultrasound",
  "region": "thyroid",
  "keywords": [
    "ecografía tiroides",
    "ultrasonido tiroides",
    "tiroides",
    "lóbulo derecho",
    "lóbulo izquierdo",
    "istmo",
    "nódulo tiroideo",
    "ganglios cervicales"
  ],
  "requiredKeywords": ["tiroides", "tiroideo"]
}
```

### Automatic Detection

Once you create the template files, the system will:
- Automatically detect them (no code changes needed)
- Use them when matching transcriptions
- Cache them in memory for performance

**Note**: Restart the development server after adding new templates to clear the cache.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in dev mode. |
| `npm run build && npm start` | Production build + serve. |
| `npm run lint` | ESLint (Next.js config). |
| `npm run test` | Vitest unit tests for API helpers. |

## Notes

- The language selector persists preference (localStorage + query param) and hydrates on load.
- `/api/generate-report` validates payloads, detects study type using LLM, loads appropriate template, builds a bilingual prompt, and uses an OpenAI client wrapper to produce a JSON report. A defensive formatter guards against malformed model responses.
- UI components live in `src/components` and reuse the shared Tailwind design tokens defined in `src/app/globals.css`.
- Templates are cached in memory for performance. Restart the server after adding new templates.
