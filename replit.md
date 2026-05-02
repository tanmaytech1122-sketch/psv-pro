# PSV Pro v4.0

Professional engineering platform for sizing Pressure Safety Valves (PSV) and Pressure Relief Valves (PRV) per API 520, 521, and 2000. Includes a production-level **PSV Engineering AI Agent** powered by Google Gemini 2.5 Flash with function calling and RAG.

## Project Structure

```
psv-pro/
├── server/
│   ├── engines/psv-engine.js     # 14 calculation sub-engines (API 520/521/2000)
│   ├── routes/
│   │   ├── aiChat.js             # Engineering AI Agent (Gemini + tools + RAG)
│   │   ├── sizing.js             # All PSV sizing endpoints
│   │   ├── projects.js           # Project & case management
│   │   └── report.js             # POST /api/report → .docx download
│   ├── lib/
│   │   ├── rag.js                # TF-IDF RAG over /knowledge/ documents
│   │   ├── tools.js              # Gemini function declarations + executors
│   │   └── reportGenerator.js   # docx report builder
│   ├── middleware/validation.js  # Request validation
│   ├── db/database.js            # JSON flat-file database (fs-based)
│   └── index.js                  # Express server entry point (port 3001)
├── client/                       # React 18 frontend (Vite 5, port 5000)
│   └── src/
│       ├── components/
│       │   └── ai/AIQuery.jsx    # Agent chat UI with intent badges + report download
│       ├── store/appStore.js     # Zustand global state
│       └── utils/api.js          # Axios API client
├── knowledge/                    # RAG knowledge base (Markdown)
│   ├── api520.md                 # API 520 sizing reference
│   ├── api521.md                 # API 521 scenarios & fire case
│   ├── psv-chattering.md         # Chattering causes & prevention
│   └── terminology.md            # PSV/PRV engineering glossary
├── data/psv_pro.json             # Auto-created JSON data store
└── package.json
```

## Tech Stack

- **Frontend**: React 18, TailwindCSS 3, Zustand, TanStack Query v5, Recharts
- **Backend**: Node.js 18+, Express 4, Morgan, Helmet, CORS, compression
- **Database**: Flat-file JSON (custom fs-based implementation, no setup required)
- **AI**: Google Gemini 2.5 Flash — function calling + RAG agent architecture
- **Report**: `docx` package — generates downloadable Word reports

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
- **Secrets**: `GEMINI_API_KEY` (required), `OPENROUTER_API_KEY` (no longer used)
- **Trust proxy**: enabled (`app.set('trust proxy', 1)`) for Replit rate-limiter compatibility

## AI Engineering Agent Architecture

The AI assistant is a **production engineering agent** — not a chatbot:

### Agent Loop (single Gemini call per query)
1. **RAG retrieval** (local TF-IDF, zero API cost): retrieve top-3 relevant chunks from `/knowledge/`
2. **Single Gemini call** with both tools + RAG context injected as system prompt
3. **Intent inference**: if Gemini calls a tool → `calculation`; if text response → `knowledge`
4. **Tool execution**: tools run against the PSV engine (backend, deterministic)
5. **Final answer**: Gemini synthesises tool result + explanation

### Tools (Gemini function declarations)
- `calculate_hydraulic_power(flow_m3hr, head_m, density_kgm3)`
- `size_psv_gas(P_set_barg, T_rel_C, W_kgh, MW, k, Z, ...)`
- `size_psv_steam(P_set_barg, T_rel_C, W_kgh, ...)`
- `size_psv_liquid(P_set_barg, W_kgh, density_kgm3, ...)`
- `size_psv_fire(P_set_barg, vessel_diameter_m, vessel_length_m, ...)`

### RAG Knowledge Base
- TF-IDF cosine similarity, no external API, zero cost
- 13 chunks across 4 documents (api520, api521, psv-chattering, terminology)
- Only injected when relevant (score threshold > 0.05)

### Report Generation
- `POST /api/report` accepts sizing result JSON
- Returns downloadable `.docx` using `docx` npm package
- Structured: Document Info, Process Conditions, Fluid Properties, Results, Assumptions

## Important Notes

- `lowdb` v3 (ESM-only) was replaced with a custom fs-based JSON database
- `node-fetch` v3 removed; Node 18 global `fetch` used instead
- `nodemon` ignores `data/` directory to prevent restart loops from DB writes
- In production, Express serves the built React app from `client/dist`
- API keys stored securely as Replit Secrets (not in .env file)
- OpenRouter / Claude dependency fully removed; Gemini only
