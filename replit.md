# PSV Pro v4.0

Professional engineering platform for sizing Pressure Safety Valves (PSV) and Pressure Relief Valves (PRV) per API 520, 521, and 2000. Includes a production-level **PSV Engineering AI Agent** with Gemini function calling, TF-IDF RAG, dataset pipeline, and DOCX/Word report export.

## Project Structure

```
psv-pro/
├── server/
│   ├── engines/psv-engine.js       # 14 calculation sub-engines (API 520/521/2000)
│   ├── routes/
│   │   ├── aiChat.js               # Engineering AI Agent (Gemini + tools + RAG)
│   │   ├── sizing.js               # All PSV sizing endpoints
│   │   ├── projects.js             # Project & case management
│   │   ├── report.js               # POST /api/report → .docx download
│   │   ├── upload.js               # PDF upload, text-to-dataset, dataset CRUD
│   │   └── exportReport.js         # POST /api/export-report → .docx download
│   ├── lib/
│   │   ├── rag.js                  # TF-IDF RAG (topic + section tagging)
│   │   ├── tools.js                # Gemini function declarations + executors
│   │   ├── reportGenerator.js      # docx Word report builder
│   │   ├── datasetBuilder.js       # Text → Alpaca JSON training dataset
│   │   ├── pdfProcessor.js         # PDF → text → dataset pipeline (pdf-parse)
│   │   └── mockTraining.js         # Mock training readiness check (Qwen format)
│   ├── middleware/validation.js     # Request validation
│   ├── db/database.js              # JSON flat-file database (fs-based)
│   └── index.js                    # Express server (port 3001)
├── client/                         # React 18 frontend (Vite 5, port 5000)
│   └── src/
│       ├── components/ai/AIQuery.jsx  # Agent chat UI (intent badges, report download)
│       ├── store/appStore.js          # Zustand global state
│       └── utils/api.js               # Axios API client
├── knowledge/                      # RAG knowledge base (Markdown)
│   ├── api520.md                   # API 520 sizing reference
│   ├── api521.md                   # API 521 scenarios & fire case
│   ├── psv-chattering.md           # Chattering causes & prevention
│   └── terminology.md              # PSV/PRV engineering glossary
├── dataset/
│   └── training_data.json          # Alpaca-format training dataset (auto-built)
├── uploads/                        # Temporary PDF upload storage
├── data/psv_pro.json               # Auto-created JSON data store
└── package.json
```

## Tech Stack

- **Frontend**: React 18, TailwindCSS 3, Zustand, TanStack Query v5, Recharts
- **Backend**: Node.js 18+, Express 4, Morgan, Helmet, CORS, compression
- **Database**: Flat-file JSON (custom fs-based implementation, no setup required)
- **AI**: Google Gemini 2.5 Flash — function calling + RAG agent architecture
- **Report**: `docx` package — generates downloadable Word (.docx) reports
- **PDF**: `pdf-parse` — extracts text from uploaded PDFs for dataset building
- **Upload**: `multer` — handles multipart PDF file uploads (20 MB limit)

## Running the App

```bash
npm run dev         # Runs backend (3001) + frontend (5000) concurrently
npm run dev:server  # Backend only (nodemon, ignores data/ dir)
npm run dev:client  # Frontend only (Vite on port 5000)
npm start           # Production backend only
npm run build       # Build client for production
```

## Key Configuration

- **Frontend port**: 5000 (Vite, `0.0.0.0`, all hosts allowed for Replit proxy)
- **Backend port**: 3001 (localhost)
- **Vite proxy**: `/api` routes → `http://localhost:3001`
- **Data file**: `data/psv_pro.json`
- **Secrets**: `GEMINI_API_KEY` (required), `OPENROUTER_API_KEY` (not used)
- **Trust proxy**: `app.set('trust proxy', 1)` — required for rate-limiter on Replit

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai-chat` | Engineering AI Agent (Gemini + RAG + tools) |
| POST | `/api/report` | Generate PSV report as .docx |
| POST | `/api/export-report` | Alias — generate PSV datasheet as .docx |
| POST | `/api/upload/pdf` | Upload PDF → extract text → build dataset |
| POST | `/api/upload/text` | Submit raw text → build dataset samples |
| GET  | `/api/upload/dataset` | Dataset stats + preview |
| GET  | `/api/upload/dataset/download` | Download full dataset as JSON |
| GET  | `/api/upload/dataset/training-check` | Mock training readiness report |
| GET  | `/api/health` | Health + engine test suite + dataset stats |

## AI Engineering Agent Architecture

### Agent Loop (single Gemini call per query)
1. **RAG retrieval** (local TF-IDF, zero API cost): top-3 chunks with source, topic, section tags
2. **Single Gemini call** with tools + RAG context in system instruction
3. **Intent inference**: tool call → `calculation`; text response → `knowledge`
4. **Tool execution**: runs against PSV engine (backend, deterministic)
5. **Final answer**: Gemini synthesises tool result + explanation

### Gemini Tools
- `calculate_hydraulic_power(flow_m3hr, head_m, density_kgm3)`
- `size_psv_gas(P_set_barg, T_rel_C, W_kgh, MW, k, Z, ...)`
- `size_psv_steam(P_set_barg, T_rel_C, W_kgh, ...)`
- `size_psv_liquid(P_set_barg, W_kgh, density_kgm3, ...)`
- `size_psv_fire(P_set_barg, vessel_diameter_m, vessel_length_m, ...)`

### RAG System (server/lib/rag.js)
- TF-IDF cosine similarity — zero API cost, runs locally
- 13 chunks from 4 knowledge documents, loaded at startup
- Each chunk tagged with: `source`, `topic`, `section`
- Score threshold > 0.05 required before injection
- Context block injected into system instruction for each request

### Dataset Pipeline (server/lib/datasetBuilder.js)
- Converts any text into Alpaca-format JSON: `{ instruction, input, output }`
- Infers meaningful instructions from content keywords (API 520, chattering, fire case, etc.)
- Estimates token count per sample (~1 token per 4 chars)
- Deduplicates by sample ID on every save
- Output: `dataset/training_data.json` (persistent, append-only)

### PDF Pipeline (server/lib/pdfProcessor.js)
- Accepts PDF upload via `multer` (field name: `file`, max 20 MB)
- Extracts text using `pdf-parse`, cleans and de-noises
- Detects domain topic from keyword matching (API 520/521/526/2000, fire case, etc.)
- Saves cleaned text to `uploads/<name>.txt`, feeds to `datasetBuilder`
- Returns: pages, word count, topic, new sample count, text preview

### Mock Training (server/lib/mockTraining.js)
- Validates every sample (non-empty instruction + response, reasonable token count)
- Reports: sample count, valid/invalid, token estimate, training steps, ETA
- Minimum 10 samples required for `ready: true`
- Exports Qwen/Alpaca format preview for target model `Qwen2.5-7B-Instruct`

## Important Notes

- `lowdb` v3 (ESM-only) was replaced with a custom fs-based JSON database
- `node-fetch` v3 removed; Node 18 global `fetch` used instead
- `nodemon` ignores `data/` directory to prevent restart loops
- In production, Express serves the built React app from `client/dist`
- OpenRouter / Claude fully removed — Gemini 2.5 Flash only
- Free tier Gemini limit: 5 req/min — each user query = 1 API call (no classification step)
