# PSV Pro v4.0

Professional engineering platform for sizing Pressure Safety Valves (PSV) and Pressure Relief Valves (PRV) per API 520, 521, and 2000. Includes an AI Engineering Assistant powered by Google Gemini.

## Project Structure

```
psv-pro/
├── server/
│   ├── engines/psv-engine.js   # 14 calculation sub-engines (API 520/521/2000)
│   ├── routes/
│   │   ├── aiChat.js           # AI Engineering Assistant (Gemini)
│   │   ├── sizing.js           # All PSV sizing endpoints
│   │   └── projects.js         # Project & case management
│   ├── middleware/validation.js # Request validation
│   ├── db/database.js          # JSON flat-file database (fs-based)
│   └── index.js                # Express server entry point (port 3001)
├── client/                     # React 18 frontend (Vite 5, port 5000)
│   └── src/
│       ├── components/         # UI components (sizing, AI, projects, layout)
│       ├── store/appStore.js   # Zustand global state
│       └── utils/api.js        # Axios API client
├── data/psv_pro.json           # Auto-created JSON data store
└── package.json
```

## Tech Stack

- **Frontend**: React 18, TailwindCSS 3, Zustand, TanStack Query v5, Recharts
- **Backend**: Node.js 18+, Express 4, Morgan, Helmet, CORS, compression
- **Database**: Flat-file JSON (custom fs-based implementation, no setup required)
- **AI**: Google Gemini 2.5 Flash — behaves as a senior process engineer

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
- **Secrets**: `GEMINI_API_KEY` (required), `OPENROUTER_API_KEY` (optional)

## AI Engineering Assistant Behavior

The AI assistant is designed to behave like a **senior process/chemical engineer**:
- Always gives a partial answer with reasonable assumptions (MW, k, Z, Kd)
- Shows the relevant API formula before numbers
- Asks for only 1–2 critical missing inputs at a time
- Never refuses to proceed due to missing data
- Uses built-in fluid property tables for estimation

## Important Notes

- `lowdb` v3 (ESM-only) was replaced with a custom fs-based JSON database
- `node-fetch` v3 removed; Node 18 global `fetch` used instead
- `nodemon` ignores `data/` directory to prevent restart loops from DB writes
- In production, Express serves the built React app from `client/dist`
- API keys stored securely as Replit Secrets (not in .env file)
