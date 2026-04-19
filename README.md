# PSV Pro v4.0

**Professional Pressure Safety Valve Sizing Platform**

Full-stack engineering tool for PSV/PRV relief valve sizing per API 520, 521, and 2000, with an AI Engineering Assistant powered by Google Gemini.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18+ · Express 4 · JSON flat-file store |
| Frontend | React 18 · Vite 5 · TailwindCSS 3 · Recharts |
| AI Assistant | Google Gemini 2.5 Flash (senior engineer persona) |
| Engine | 14 modular calculation sub-engines · 44 built-in regression tests |
| API | RESTful JSON · rate-limited · request-validated |

---

## Quick Start

```bash
# Install all dependencies
npm install && cd client && npm install && cd ..

# Development (hot-reload on both frontend and backend)
npm run dev
# Backend  →  http://localhost:3001
# Frontend →  http://localhost:5000
```

---

## Project Structure

```
psv-pro/
├── server/
│   ├── engines/
│   │   └── psv-engine.js       # 14 calculation sub-engines (API 520/521/2000)
│   ├── routes/
│   │   ├── aiChat.js           # AI Engineering Assistant (Gemini)
│   │   ├── sizing.js           # All PSV sizing endpoints
│   │   └── projects.js         # Project & case management
│   ├── middleware/
│   │   └── validation.js       # Request validation
│   ├── db/
│   │   └── database.js         # JSON flat-file database (fs-based)
│   └── index.js                # Express server entry point (port 3001)
├── client/
│   ├── src/
│   │   ├── components/         # React UI components
│   │   ├── store/appStore.js   # Zustand global state
│   │   └── utils/api.js        # Axios API client
│   └── vite.config.js          # Vite config (port 5000, proxy → 3001)
├── data/
│   └── psv_pro.json            # Auto-created data store
└── package.json
```

---

## Environment Variables

Set these as Replit Secrets or in your `.env` file:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key (AI Engineering Assistant) |
| `OPENROUTER_API_KEY` | Optional | OpenRouter key (Claude fallback for AI query parsing) |
| `PORT` | No | API server port (default: `3001`) |
| `NODE_ENV` | No | Set to `production` to serve built frontend from Express |

---

## Calculation Modules

| Module | Standard | Method |
|--------|----------|--------|
| Gas / Vapour | API 520 §3.6 | Critical (Eq.3) + subcritical (Eq.4) |
| Steam | API 520 §3.7 | Napier equation + Ksh + Kn |
| Liquid | API 520 §3.8 | Kw back-pressure, Kv viscosity |
| Two-Phase | API 520 App C | Leung (1986) omega method |
| External Fire | API 521 §5.15 | Wetted area + Q = 21,000·F·Aw^0.82 |
| Depressurisation | API 521 §5.6 | Isentropic ideal-gas ODE |
| Thermal Relief | API 521 §5.20 | Q = β·Q_heat/(500·SG·Cp) |
| Tube Rupture | API 521 §5.19 | Two-thirds pressure credibility rule |
| Tank Breathing | API 2000 §4 | Table 2 + movement rates |
| Reaction Force | API 520 Part II §4 | Momentum + pressure thrust |

---

## AI Engineering Assistant

The AI assistant behaves like a **senior process engineer**, not a form-filling chatbot:

- Gives partial answers immediately using reasonable engineering assumptions
- States assumed values (MW, k, Z, Kd) and proceeds with calculations
- Shows the relevant API formula before plugging in numbers
- Asks for only the 1–2 most critical missing inputs
- Interprets hydraulic power calculations with tool-augmented responses

**Example:** Ask *"Design a PSV for a hydrocarbon gas system"* — the AI will assume a C6/C7 mixture (MW ≈ 93, k ≈ 1.05, Z ≈ 0.95), show the API 520 gas sizing formula, and ask only for flow rate and set pressure.

---

## API Reference

### Sizing Endpoints

```
POST /api/size/gas
POST /api/size/steam
POST /api/size/liquid
POST /api/size/twophase
POST /api/size/fire
POST /api/size/blowdown
POST /api/size/blowdown/autosize
POST /api/size/thermal
POST /api/size/tuberupture
POST /api/size/api2000
POST /api/size/reaction
POST /api/size/ai-query
GET  /api/size/orifice?A=<area>
GET  /api/size/corrections?P_set=&P_back=&valve_type=&k=
GET  /api/size/eos?P=&T=&fluid=
GET  /api/size/validate
```

All responses: `{ ok: true, result: { ... } }` or `{ ok: false, error: "..." }`

### AI Chat

```
POST /api/ai-chat        { messages: [{ role, content }] }
```

### Project Management

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:pid/cases
POST   /api/projects/:pid/cases
GET    /api/projects/:pid/cases/:id
PUT    /api/projects/:pid/cases/:id
DELETE /api/projects/:pid/cases/:id
```

### Health Check

```
GET /api/health
→ { ok: true, version: "4.0.0", engine: { tests: "44/44", pass: true }, uptime: "..." }
```

---

## Gas Sizing Example

```bash
curl -X POST http://localhost:3001/api/size/gas \
  -H "Content-Type: application/json" \
  -d '{
    "P_set": 150,
    "OP": 10,
    "T_rel": 400,
    "W": 25000,
    "MW": 44.1,
    "k": 1.14,
    "Z": 0.97
  }'
```

```json
{
  "ok": true,
  "result": {
    "A_in2": 1.8743,
    "isCrit": true,
    "P1_psia": 179.696,
    "orifice": { "d": "L", "a": 2.853, "in_sz": "3×4", "cap_pct": 65.7 }
  }
}
```

---

## Production Deployment

```bash
# Build frontend
cd client && npm run build && cd ..

# Start in production mode (Express serves built React)
NODE_ENV=production node server/index.js
```

---

## Validated Against

- API 520 9th Edition (2014) — §3.6.2 published example: A = 1.874 in² ✓
- API 520 9th Edition — §3.7 steam example: A = 2.123 in² ✓
- GPSA Engineering Data Book 14th Ed. — Table 4-3 C coefficient ✓
- NIST WebBook — PR EOS Z-factor (7 fluids, 15 reference points) ✓
- IAPWS-IF97 — T_sat at 7 pressures, ±0.02% ✓
- Leung (1986) AIChE J. — omega method SI cross-check ✓
- API 521 §5.15 — fire geometry (15 cases, 3 orientations) ✓
- API 2000 7th Ed. — Table 2 (7 tank sizes) ✓
