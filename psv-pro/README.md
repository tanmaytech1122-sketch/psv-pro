# PSV Pro v4.0

**Professional Pressure Safety Valve Sizing Platform**

Full-stack engineering tool for PSV/PRV relief valve sizing per API 520/521/2000.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18+ · Express 4 · lowdb (JSON store) |
| Frontend | React 18 · Vite 5 · TailwindCSS 3 · Recharts |
| Engine | 14 modular calculation sub-engines (44 built-in regression tests) |
| API | RESTful JSON, rate-limited, validated |

---

## Quick Start

```bash
# 1. Install backend dependencies
npm install

# 2. Install frontend dependencies
cd client && npm install && cd ..

# 3. Build the frontend (production)
cd client && npm run build && cd ..

# 4. Start the server
node server/index.js
# → http://localhost:3001
```

**Development mode (hot-reload on both sides):**
```bash
# Terminal 1 — backend
npx nodemon server/index.js

# Terminal 2 — frontend
cd client && npm run dev
# → http://localhost:5173  (proxied to API on :3001)
```

---

## Calculation Modules

| Module | Standard | Method |
|--------|----------|--------|
| Gas / Vapour | API 520 §3.6 | Critical (Eq.3) + subcritical (Eq.4) |
| Steam | API 520 §3.7 | Napier equation + Ksh + Kn |
| Liquid | API 520 §3.8 | Kw back-pressure (not Kb), Kv viscosity |
| Two-Phase | API 520 App C | Leung (1986) omega method |
| External Fire | API 521 §5.15 | Wetted area + Q = 21,000·F·Aw^0.82 |
| Depressurisation | API 521 §5.6 | Isentropic ideal-gas ODE |
| Thermal Relief | API 521 §5.20 | Q = β·Q_heat/(500·SG·Cp) |
| Tube Rupture | API 521 §5.19 | Two-thirds pressure credibility rule |
| Tank Breathing | API 2000 §4 | Table 2 + movement rates |
| Reaction Force | API 520 Part II §4 | Momentum + pressure thrust |
| Piping ΔP | Crane TP-410M | Darcy-Weisbach + Colebrook-White |

---

## API Reference

### Sizing Endpoints

All sizing endpoints: `POST /api/size/<module>`

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
GET  /api/size/orifice?A=<area>
GET  /api/size/corrections?P_set=&P_back=&valve_type=&k=
GET  /api/size/eos?P=&T=&fluid=
GET  /api/size/validate
```

All responses: `{ ok: true, result: { ... } }` or `{ ok: false, error: "..." }`

### Project Management

```
GET    /api/projects               List all projects
POST   /api/projects               Create project
GET    /api/projects/:id           Get project with cases
PUT    /api/projects/:id           Update project
DELETE /api/projects/:id           Delete project + cases

GET    /api/projects/:pid/cases         List cases
POST   /api/projects/:pid/cases         Create case
GET    /api/projects/:pid/cases/:id     Get case with revisions
PUT    /api/projects/:pid/cases/:id     Update (auto-saves revision)
DELETE /api/projects/:pid/cases/:id     Delete case
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
    "P_back_total": 0,
    "T_rel": 400,
    "W": 25000,
    "MW": 44.1,
    "k": 1.14,
    "Z": 0.97,
    "Kd": 0.975,
    "valve_type": "conventional",
    "Kc": 1.0
  }'
```

Response:
```json
{
  "ok": true,
  "result": {
    "A_in2": 1.8743,
    "isCrit": true,
    "C": 331.04,
    "Kb": 1.0,
    "P1_psia": 179.696,
    "orifice": { "d": "L", "a": 2.853, "in_sz": "3×4", "cap_pct": 65.7 }
  }
}
```

---

## Engine Architecture

The calculation engine (`server/engines/psv-engine.js`) is organised as 14 independent IIFE sub-engines:

```
SteamTablesEngine     → T_sat, getKsh, getKn      (IAPWS-IF97)
CorrectionsEngine     → getKb, getKv               (API 520 §3.3)
EOSEngine             → prEOS_Z, getZ_PR, PR_FLUIDS (Peng-Robinson)
OrificeEngine         → selectOrifice, C_gas        (API 526)
API520GasEngine       → sizeGas
API520SteamEngine     → sizeSteam
API520LiquidEngine    → sizeLiquid
API520TwoPhaseEngine  → sizeTwoPhase
API521FireEngine      → calcWettedArea, sizeFireCase
API521BlowdownEngine  → runBlowdown, sizeBlowdownValve
API521ScenariosEngine → sizeTubeRupture, sizeThermal
TankBreathingEngine   → calcAPI2000
UtilitiesEngine       → calcPipeLoss, calcReactionForce, calcNoise
ValidationEngine      → runValidationSuite (44 tests)
```

Each sub-engine can be used independently:
```javascript
const PSVApi = require('./server/engines/psv-engine')

// Via aggregate namespace (backward-compatible)
const result = PSVApi.sizeGas({ ... })

// Via named sub-engine
const result = PSVApi.engines.GasSizing.sizeGas({ ... })
```

---

## Data Storage

Project data is stored in `data/psv_pro.json` (created automatically). No database setup required.

To change location:
```bash
DATA_DIR=/path/to/data node server/index.js
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `NODE_ENV` | `development` | Set to `production` to serve built frontend |
| `DATA_DIR` | `./data` | JSON data store directory |

---

## Production Deployment

```bash
# Build frontend
cd client && npm run build && cd ..

# Start in production mode (serves built React from Express)
NODE_ENV=production node server/index.js
# → Full app at http://localhost:3001
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
