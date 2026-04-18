# PSV Pro v4.0

A professional engineering platform for sizing Pressure Safety Valves (PSV) and Pressure Relief Valves (PRV) according to industry standards (API 520, 521, 2000).

## Project Structure

```
psv-pro/
├── client/          # React 18 frontend (Vite 5)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── store/       # Zustand state management
│   │   ├── utils/       # API client helpers
│   │   └── App.jsx      # Main app with routing
│   └── vite.config.js   # Vite config (port 5000, proxy to 3001)
├── server/          # Express 4 backend
│   ├── db/database.js   # JSON flat-file DB (fs-based, replaces lowdb)
│   ├── engines/         # PSV calculation engines
│   ├── middleware/      # Validation middleware
│   ├── routes/          # API routes (sizing, projects)
│   └── index.js         # Server entry point (port 3001)
├── data/            # JSON data storage (psv_pro.json)
└── package.json     # Root scripts
```

## Tech Stack

- **Frontend**: React 18, TailwindCSS 3, Zustand, TanStack Query v5, Recharts
- **Backend**: Node.js 18+, Express 4, Morgan, Helmet, CORS, compression
- **Database**: Flat-file JSON (custom fs-based implementation)
- **AI**: OpenRouter API (Claude) for natural language queries
- **Build**: Vite 5, npm workspaces-style (root + client)

## Running the App

```bash
npm run dev         # Runs both backend (3001) and frontend (5000) concurrently
npm run dev:server  # Backend only (nodemon, ignores data/ dir)
npm run dev:client  # Frontend only (Vite on port 5000)
npm start           # Production backend only
npm run build       # Build client for production
```

## Key Configuration

- **Frontend port**: 5000 (Vite, `0.0.0.0` host, all hosts allowed for Replit proxy)
- **Backend port**: 3001 (localhost)
- **Vite proxy**: `/api` routes proxied to `http://localhost:3001`
- **Data file**: `data/psv_pro.json`
- **Environment**: `.env` at root (OPENROUTER_API_KEY, PORT, NODE_ENV)

## Important Notes

- `lowdb` v3 (ESM-only) was replaced with a custom `fs`-based JSON database
- `node-fetch` v3 (ESM-only) was removed; Node.js 18 global `fetch` is used instead
- `nodemon` ignores `data/` directory to prevent restart loops from DB writes
- In production, Express serves the built React app from `client/dist`

## API Endpoints

- `GET /api/health` — Health check + engine validation
- `POST /api/size/gas` — API 520 gas sizing
- `POST /api/size/steam` — API 520 steam sizing
- `POST /api/size/liquid` — API 520 liquid sizing
- `POST /api/size/twophase` — API 520 two-phase sizing
- `POST /api/size/fire` — API 521 fire case
- `POST /api/size/thermal` — Thermal relief
- `POST /api/size/tuberupture` — Tube rupture
- `POST /api/size/blowdown` — Blowdown/depressurization
- `POST /api/size/api2000` — API 2000 tank venting
- `POST /api/size/reaction` — Reaction force
- `POST /api/size/ai-query` — Natural language query via AI
- `GET /api/size/corrections` — Correction factors
- `GET /api/size/orifice` — Orifice selection
- `GET /api/projects` — Project management
