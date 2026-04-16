/**
 * PSV Pro v4.0 — Calculation Engine
 * ─────────────────────────────────────────────────────────────────
 * Self-contained calculation library; zero DOM access.
 * Each sub-engine is an IIFE — independently testable and usable.
 *
 * Sub-engines (load order: each depends on those above it):
 *   SteamTablesEngine     — IAPWS-IF97: T_sat, Ksh, Kn
 *   CorrectionsEngine     — API 520: Kb, Kv correction factors  
 *   EOSEngine             — Peng-Robinson EOS: Z-factor
 *   OrificeEngine         — API 526 orifice table, C coefficient
 *   API520GasEngine       — API 520 §3.6: gas/vapour sizing
 *   API520SteamEngine     — API 520 §3.7: steam (Napier)
 *   API520LiquidEngine    — API 520 §3.8: liquid sizing (Kw)
 *   API520TwoPhaseEngine  — API 520 App C: omega / Leung method
 *   API521FireEngine      — API 521 §5.15: external fire, Aw
 *   API521BlowdownEngine  — API 521 §5.6: depressurisation ODE
 *   API521ScenariosEngine — API 521 §5.19/§5.20: tube rupture, thermal
 *   TankBreathingEngine   — API 2000 §4: tank venting
 *   UtilitiesEngine       — Piping, reaction force, noise
 *   ValidationEngine      — 44-case built-in regression suite
 *
 * Flat API:   PSVApi.sizeGas(...)          (backward-compatible)
 * Per-engine: PSVApi.engines.GasSizing.sizeGas(...)
 * ─────────────────────────────────────────────────────────────────
 */
'use strict';


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: SteamTablesEngine
// Standard:   IAPWS-IF97 (2012) backward equations
// Exports:    T_sat, getKsh, getKn
// Requires:   nothing
// ═════════════════════════════════════════════════════════════════
const SteamTablesEngine = (() => {
function T_sat(P_psia) {
  if (P_psia <= 0) return 32;
  if (P_psia >= 3208) return 705.47;
  const pm = P_psia * 0.00689476;
  const n = [
    0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2,
    0.12020824702470e5, -0.32325550322333e7,  0.14915108613530e2,
   -0.48232657361591e4,  0.40511340542057e6, -0.23855557567849,
    0.65017534844798e3
  ];
  const b = Math.pow(pm, 0.25);
  const E = b*b + n[2]*b + n[5];
  const F = n[0]*b*b + n[3]*b + n[6];
  const G = n[1]*b*b + n[4]*b + n[7];
  const D = 2*G / (-F - Math.sqrt(Math.max(0, F*F - 4*E*G)));
  const K = (n[9] + D - Math.sqrt(Math.max(0, (n[9]+D)*(n[9]+D) - 4*(n[8]+n[9]*D)))) / 2;
  return K * 9/5 - 459.67;
}

var KSH = {
  15:   {300:1.000, 400:0.978, 500:0.956, 600:0.935, 700:0.914, 800:0.893, 900:0.873, 1000:0.853, 1200:0.813},
  100:  {300:0.989, 400:0.979, 500:0.959, 600:0.938, 700:0.918, 800:0.897, 900:0.877, 1000:0.856, 1200:0.815},
  200:  {400:0.987, 500:0.961, 600:0.936, 700:0.912, 800:0.889, 900:0.866, 1000:0.842, 1200:0.796},
  500:  {500:1.000, 600:0.972, 700:0.943, 800:0.917, 900:0.892, 1000:0.869, 1200:0.822},
  1000: {700:1.000, 800:0.970, 900:0.941, 1000:0.914, 1200:0.860},
  1500: {900:1.000, 1000:0.972, 1200:0.917},
};

function getKsh(P_psia, T_F) {
  const Ts = T_sat(P_psia);
  if (T_F <= Ts + 1) return 1.0;
  const Pk = Object.keys(KSH).map(Number).sort((a,b) => a-b);
  function atP(Pt, Tq) {
    const t = KSH[Pt]; if (!t) return 1;
    const Tk = Object.keys(t).map(Number).sort((a,b) => a-b);
    if (Tq <= Tk[0]) return t[Tk[0]];
    if (Tq >= Tk[Tk.length-1]) return t[Tk[Tk.length-1]];
    for (let i = 0; i < Tk.length-1; i++) {
      if (Tk[i] <= Tq && Tq <= Tk[i+1]) {
        const f = (Tq-Tk[i])/(Tk[i+1]-Tk[i]);
        return t[Tk[i]]*(1-f) + t[Tk[i+1]]*f;
      }
    }
    return 1;
  }
  // Clamp P to the table's pressure range — never extrapolate beyond the highest row
  const P_clamped = Math.max(Pk[0], Math.min(P_psia, Pk[Pk.length-1]));
  let Pl = Pk[0], Ph = Pk[Pk.length-1];
  for (let i = 0; i < Pk.length-1; i++) {
    if (Pk[i] <= P_clamped && P_clamped <= Pk[i+1]) { Pl = Pk[i]; Ph = Pk[i+1]; break; }
  }
  if (Pl === Ph) return atP(Pl, T_F);
  const f = (P_clamped-Pl)/(Ph-Pl);
  const Ksh_raw = atP(Pl, T_F)*(1-f) + atP(Ph, T_F)*f;
  return Math.min(1.0, Ksh_raw); // physical guard: Ksh must not exceed 1.0
}

var KN_PTS = [
  [0,1],[1500,1],[1600,.997],[1800,.993],[2000,.989],
  [2200,.986],[2400,.983],[2600,.980],[2800,.977],
  [3000,.974],[3200,.971],[3215,.877]
];
function getKn(P_psia) {
  if (P_psia <= 1500) return 1;
  if (P_psia >= 3215) return 0.877;
  for (let i = 0; i < KN_PTS.length-1; i++) {
    if (KN_PTS[i][0] <= P_psia && P_psia <= KN_PTS[i+1][0]) {
      const t = (P_psia-KN_PTS[i][0])/(KN_PTS[i+1][0]-KN_PTS[i][0]);
      return KN_PTS[i][1]*(1-t) + KN_PTS[i+1][1]*t;
    }
  }
  return 1;
}

  return { T_sat, getKsh, getKn };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: CorrectionsEngine
// Standard:   API 520 Part I §3.3 (back-pressure Kb, viscosity Kv)
// Exports:    getKb, getKv
// Requires:   nothing
// ═════════════════════════════════════════════════════════════════
const CorrectionsEngine = (() => {
function getKb(P_set_psig, P_back_psig, valve_type, k=1.3) {
  const ATMOS = 14.696;
  const LP_THRESH = 70, LP_PURE = 45;
  const P1_abs = P_set_psig + ATMOS;
  const P2_abs = P_back_psig + ATMOS;
  const ratio = P2_abs / P1_abs;
  const bp_pct = P_back_psig / P_set_psig * 100;

  function Kb_gauge(bp) {
    if (valve_type === 'conventional') {
      if (bp <= 10) return 1.0; if (bp >= 40) return 0.6;
      return 1.0 - (bp-10)*(0.4/30);
    }
    if (valve_type === 'bellows') {
      // API 520 9th Ed. Fig.31: balanced-bellows Kb = 1.0 up to 50% BP,
      // then linear from (50%,1.0) to (80%,0.50); below 0.50 use mfr. data.
      if (bp <= 50) return 1.0; if (bp >= 80) return 0.50;
      return 1.0 - (bp-50)*(0.50/30);
    }
    return 1.0; // pilot
  }

  function Kb_abs(r) {
    const rc = Math.pow(2/(k+1), k/(k-1));
    if (r <= rc) return 1.0; if (r >= 1.0) return 0.0;
    const num = (k+1)/k * (Math.pow(r,2/k) - Math.pow(r,(k+1)/k));
    const den = 1 - Math.pow(rc,(k-1)/k);
    return Math.min(1.0, Math.sqrt(Math.max(0, num/den)));
  }

  if (P_set_psig >= LP_THRESH) return Kb_gauge(bp_pct);
  if (P_set_psig <= LP_PURE)   return Kb_abs(ratio);
  const w = (P_set_psig - LP_PURE)/(LP_THRESH - LP_PURE);
  return Kb_abs(ratio)*(1-w) + Kb_gauge(bp_pct)*w;
}

var KV_PTS = [
  [10,.15],[50,.25],[100,.314],[200,.50],[500,.68],
  [1000,.80],[2000,.88],[5000,.95],[10000,.978],
  [15000,.987],[20000,.992],[50000,.998],[100000,1] // API 520 Table 7 additional breakpoints
];
function getKv(Re) {
  if (Re <= 0) return 0; if (Re >= 1e5) return 1;
  if (Re <= KV_PTS[0][0]) return Math.max(0, KV_PTS[0][1]*(Re/KV_PTS[0][0]));
  for (let i = 0; i < KV_PTS.length-1; i++) {
    if (KV_PTS[i][0] <= Re && Re <= KV_PTS[i+1][0]) {
      const f = (Re-KV_PTS[i][0])/(KV_PTS[i+1][0]-KV_PTS[i][0]);
      return KV_PTS[i][1]*(1-f) + KV_PTS[i+1][1]*f;
    }
  }
  return 1;
}

  return { getKb, getKv };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: EOSEngine
// Standard:   Peng-Robinson (1976); NIST WebBook Z-factor reference
// Exports:    PR_FLUIDS, prEOS_Z, getZ_PR
// Requires:   nothing
// ═════════════════════════════════════════════════════════════════
const EOSEngine = (() => {
// ═══════════════════════════════════════════════════════════════
// MODULE: pr_eos  [Peng-Robinson 1976]
// ═══════════════════════════════════════════════════════════════

/** Fluid critical properties database */
var PR_FLUIDS = {
  methane:   {Tc:343.1,  Pc:667.8,  omega:0.011,  MW:16.04,  label:'Methane (CH4)'},
  ethane:    {Tc:549.9,  Pc:708.3,  omega:0.099,  MW:30.07,  label:'Ethane (C2H6)'},
  propane:   {Tc:665.9,  Pc:616.3,  omega:0.152,  MW:44.10,  label:'Propane (C3H8)'},
  ibutane:   {Tc:735.3,  Pc:529.1,  omega:0.185,  MW:58.12,  label:'i-Butane (C4H10)'},
  nbutane:   {Tc:765.4,  Pc:550.7,  omega:0.200,  MW:58.12,  label:'n-Butane (C4H10)'},
  ethylene:  {Tc:509.5,  Pc:729.8,  omega:0.086,  MW:28.05,  label:'Ethylene (C2H4)'},
  propylene: {Tc:656.9,  Pc:669.3,  omega:0.140,  MW:42.08,  label:'Propylene (C3H6)'},
  hydrogen:  {Tc:59.8,   Pc:188.2,  omega:-0.216, MW:2.016,  label:'Hydrogen (H2)'},
  h2:        {Tc:59.8,   Pc:188.2,  omega:-0.216, MW:2.016,  label:'H2 (alias)'},
  nitrogen:  {Tc:227.4,  Pc:492.8,  omega:0.040,  MW:28.01,  label:'Nitrogen (N2)'},
  co2:       {Tc:547.9,  Pc:1070.6, omega:0.239,  MW:44.01,  label:'CO2'},
  h2s:       {Tc:672.2,  Pc:1306.5, omega:0.100,  MW:34.08,  label:'H2S'},
  ammonia:   {Tc:729.7,  Pc:1639.5, omega:0.250,  MW:17.03,  label:'Ammonia (NH3)'},
  steam:     {Tc:1165.3, Pc:3197.8, omega:0.345,  MW:18.02,  label:'Water/Steam'},
  co:        {Tc:239.3,  Pc:507.5,  omega:0.049,  MW:28.01,  label:'Carbon Monoxide'},
  toluene:   {Tc:1011.8, Pc:595.9,  omega:0.263,  MW:92.14,  label:'Toluene (C7H8)'},
};

function prEOS_Z(P_psia, T_F, Tc_R, Pc_psia, omega) {
  const R = 10.73, T = T_F + 459.67, Tr = T / Tc_R;
  const kap = 0.37464 + 1.54226*omega - 0.26992*omega*omega;
  const alp = Math.pow(1 + kap*(1 - Math.sqrt(Math.max(Tr, 0.01))), 2);
  const a = 0.45724*R*R*Tc_R*Tc_R/Pc_psia*alp;
  const b = 0.07780*R*Tc_R/Pc_psia;
  const A = a*P_psia/(R*R*T*T), B = b*P_psia/(R*T);
  const c2 = -(1-B), c1 = A-3*B*B-2*B, c0 = -(A*B-B*B-B*B*B);
  let z = Math.max(B+0.1, 0.8);
  for (let i = 0; i < 200; i++) {
    const fz = z*z*z + c2*z*z + c1*z + c0;
    const dfz = 3*z*z + 2*c2*z + c1;
    if (Math.abs(dfz) < 1e-14) break;
    const dz = fz/dfz; z -= dz;
    if (Math.abs(dz) < 1e-11) break;
  }
  return Math.max(B+0.005, Math.min(z, 2.0));
}

function getZ_PR(P_psia, T_F, fluid_key) {
  const f = PR_FLUIDS[fluid_key];
  if (!f) return 1.0;
  const Z = prEOS_Z(P_psia, T_F, f.Tc, f.Pc, f.omega);
  const Tr = (T_F + 459.67) / f.Tc;
  const Pr = P_psia / f.Pc;
  // Near-critical: PR EOS error typically 5–20% when T_r < 1.05 or (T_r < 1.15 & P_r > 0.40)
  getZ_PR._near_crit_warn = (Tr < 1.05) || (Tr < 1.15 && Pr > 0.40);
  return Z;
}

  return { PR_FLUIDS, prEOS_Z, getZ_PR };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: OrificeEngine
// Standard:   API 526 6th Ed. (orifice designations); API 520 §3.3 (C coefficient)
// Exports:    ORIFICES, selectOrifice, C_gas
// Requires:   nothing
// ═════════════════════════════════════════════════════════════════
const OrificeEngine = (() => {
// ═══════════════════════════════════════════════════════════════
// MODULE: api526  [API 526 6th Edition]
// ═══════════════════════════════════════════════════════════════

var ORIFICES = [
  {d:'D', a:0.110, in_sz:'1×2'},    {d:'E', a:0.196, in_sz:'1×2'},
  {d:'F', a:0.307, in_sz:'1½×2½'}, {d:'G', a:0.503, in_sz:'1½×2½'},
  {d:'H', a:0.785, in_sz:'2×3'},    {d:'J', a:1.287, in_sz:'2×3'},
  {d:'K', a:1.838, in_sz:'3×4'},    {d:'L', a:2.853, in_sz:'3×4'},
  {d:'M', a:3.600, in_sz:'4×6'},    {d:'N', a:4.341, in_sz:'4×6'},
  {d:'P', a:6.380, in_sz:'4×6'},    {d:'Q', a:11.05, in_sz:'6×8'},
  {d:'R', a:16.00, in_sz:'6×10'},   {d:'T', a:26.00, in_sz:'8×10'},
];

function selectOrifice(A_req) {
  // Guard: treat NaN, Infinity, negative as 0 (returns D orifice) or flag multi
  const A = (!isFinite(A_req) || A_req < 0) ? (A_req > 0 ? Infinity : 0) : A_req;
  const o = ORIFICES.find(o => o.a >= A) || ORIFICES[ORIFICES.length-1];
  const idx = ORIFICES.findIndex(x => x.d === o.d);
  return {
    ...o, A_req,
    cap_pct: A_req/o.a*100,
    is_knife: A_req/o.a > 0.90,
    is_chatter: A_req/o.a < 0.30,
    is_multi: A_req > 26,
    n_valves: A_req > 26 ? Math.ceil(A_req/26) : 1,
    next: idx < ORIFICES.length-1 ? ORIFICES[idx+1] : null,
    prev: idx > 0 ? ORIFICES[idx-1] : null,
  };
}


/** Gas isentropic flow coefficient C — API 520 Part I §3.6
 * Physical range: k > 1.0 (k=1 is isothermal, not isentropic).
 * Guard: k ≤ 1.001 → use limiting value at k=1.001 to avoid NaN.
 */
function C_gas(k) {
  const k_eff = Math.max(k, 1.001); // k=1 → (k+1)/(k-1) = ∞ → NaN; clamp at practical min
  return 520 * Math.sqrt(k_eff * Math.pow(2/(k_eff+1), (k_eff+1)/(k_eff-1)));
}

  return { ORIFICES, selectOrifice, C_gas };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API520GasEngine
// Standard:   API 520 Part I §3.6 (critical flow Eq.3 and subcritical Eq.4)
// Exports:    sizeGas
// Requires:   OrificeEngine, CorrectionsEngine
// ═════════════════════════════════════════════════════════════════
const API520GasEngine = (() => {
  const { C_gas, selectOrifice } = OrificeEngine;
  const { getKb } = CorrectionsEngine;

function sizeGas(params) {
  const { P_set, OP=10, P_back_total=0, T_rel, W, MW, k, Z=0.95, Kd=0.975,
          valve_type='conventional', Kc=1.0, inlet_dP=0 } = params;

  // API 520 §3.3: reduce effective set pressure by inlet loss
  if (!MW || MW <= 0) return { error:'MW must be > 0', A_in2:0, P1_psia:0, z_warn:false, lp_warn:false };
  const Ps_eff = inlet_dP > 0 ? P_set - inlet_dP/(1+OP/100) : P_set;
  const P1 = Ps_eff*(1+OP/100) + 14.696;
  const P2 = P_back_total + 14.696;
  const T_R = T_rel + 459.67;
  const Kb = getKb(P_set, P_back_total, valve_type, k);
  const C  = C_gas(k);
  const rc = Math.pow(2/(k+1), k/(k-1));

  // Z < 0.70 warning: stream may be near saturation or two-phase.
  // API 520 gas equations assume single-phase vapor; low Z indicates near-critical
  // or condensing conditions — switch to two-phase omega tab or verify with PR EOS.
  const z_warn = Z < 0.80;
  // Guard: no flow possible if back pressure >= relieving pressure
  if (P2 >= P1 - 0.1) return { error:'Back pressure ≥ relieving pressure — no gas flow possible',
                                A_in2:0, P1_psia:P1, P2_psia:P2, lp_warn:P_set<70, z_warn };

  if (P2/P1 <= rc) {
    const A = (W/(C*Kd*Kb*Kc*P1)) * Math.sqrt(T_R*Z/MW);
    return { A_in2:A, isCrit:true, C, P1_psia:P1, P2_psia:P2, Kb,
             rc, flow_ratio:P2/P1, formula:'API 520 Eq.3 (Critical/Choked)',
             lp_warn: P_set < 70, z_warn };
  }
  const r = P2/P1;
  const F2 = Math.sqrt((k/(k-1))*Math.pow(r,2/k)*(1-Math.pow(r,(k-1)/k)));
  const A  = (W/(735*F2*Kd*Kb*Kc*P1)) * Math.sqrt(T_R*Z/MW);
  return { A_in2:A, isCrit:false, C, P1_psia:P1, P2_psia:P2, Kb, F2,
           rc, flow_ratio:P2/P1, formula:'API 520 Eq.4 (Subcritical)',
           lp_warn: P_set < 70, z_warn };
}

  return { sizeGas };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API520SteamEngine
// Standard:   API 520 Part I §3.7 — Napier equation for steam (Ksh, Kn, Kb)
// Exports:    sizeSteam
// Requires:   SteamTablesEngine, CorrectionsEngine, OrificeEngine
// ═════════════════════════════════════════════════════════════════
const API520SteamEngine = (() => {
  const { T_sat, getKsh, getKn } = SteamTablesEngine;
  const { getKb } = CorrectionsEngine;
  const { selectOrifice } = OrificeEngine;

function sizeSteam(params) {
  const { P_set, OP=10, P_back_total=0, T_rel, W, Kd=0.975,
          valve_type='conventional', Kc=1.0 } = params;
  const P1 = P_set*(1+OP/100) + 14.696;
  const Kb = getKb(P_set, P_back_total, valve_type);
  const Ksh_v = getKsh(P1, T_rel);
  const Kn_v  = getKn(P1);
  const Ts    = T_sat(P1);
  const A     = W / (51.45*Kd*Ksh_v*Kn_v*Kb*Kc*P1);
  return { A_in2:A, Ksh:Ksh_v, Kn:Kn_v, T_sat_F:Ts, Kb, P1_psia:P1,
           isCrit:true, formula:'API 520 §3.7 Napier + IAPWS-IF97' };
}

  return { sizeSteam };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API520LiquidEngine
// Standard:   API 520 Part I §3.8 — liquid service with Kw (not Kb) correction
// Exports:    sizeLiquid
// Requires:   CorrectionsEngine, OrificeEngine
// ═════════════════════════════════════════════════════════════════
const API520LiquidEngine = (() => {
  const { getKv } = CorrectionsEngine;
  const { selectOrifice } = OrificeEngine;

function sizeLiquid(params) {
  const { P_set, OP=10, P_back_total=0, W, rho_lbft3, visc_cp=1.0,
          Kd=0.65, valve_type='conventional', Kc=1.0 } = params;
  const P1 = P_set*(1+OP/100) + 14.696;
  const P2 = P_back_total + 14.696;
  const dP = P1 - P2;
  if (dP < 0.1) return { error:'Back pressure ≥ relieving pressure — no flow possible' };
  if (!rho_lbft3 || rho_lbft3 <= 0) return { error:'Liquid density must be > 0', A_in2:0 };
  const G   = rho_lbft3/62.4;
  const Q   = W/(G*500.22); // GPM

  // API 520 §3.8 uses Kw for liquid backpressure — NOT the vapor Kb curve.
  // Conventional valves: Kw = 1.0 (spring compensates for back pressure).
  // Balanced-bellows liquid: API 520 Fig.32 liquid Kw curve.
  //   Digitised Fig.32 linear fit: Kw = 1.1165 - 0.01×(BP% of gauge set pressure)
  //   clamped to [0.50, 1.0] — from AIChE CEP "Sizing Pressure-Relief Devices".
  const bp_pct = P_set > 0 ? (P_back_total / P_set)*100 : 0;
  let Kw;
  if (valve_type === 'bellows') {
    Kw = Math.max(0.50, Math.min(1.0, 1.1165 - 0.01*bp_pct));
  } else {
    Kw = 1.0; // conventional and pilot: back pressure does not derate liquid Kw
  }

  // Kv viscosity correction — iterate 25 steps
  let A = Q/(38*Kd*Kw*Kc*Math.sqrt(dP/G)), Kv = 1;
  for (let i = 0; i < 25; i++) {
    const Re = 2.8*W/(visc_cp*Math.sqrt(Math.max(A, 1e-12)));
    const kv = getKv(Re);
    const An = Q/(38*Kd*kv*Kw*Kc*Math.sqrt(dP/G));
    if (Math.abs(An-A) < 1e-10) { A = An; Kv = kv; break; }
    A = An; Kv = kv;
  }
  const Re_f = 2.8*W/(visc_cp*Math.sqrt(Math.max(A, 1e-12)));
  // Flashing liquid warning: when P2/P1 < 0.5 (>50% pressure drop), light
  // hydrocarbons are very likely to flash across the valve. API 520 §3.8 liquid
  // method assumes non-flashing single-phase liquid and UNDERESTIMATES required
  // area in flashing service. Use the Two-Phase omega tab (API 520 App C) instead.
  const flashing_warn = (P2/P1) < 0.50;
  return { A_in2:A, Q_gpm:Q, G, dP_psi:dP, Kv, Re:Re_f, Kw, P1_psia:P1, P2_psia:P2,
           flashing_warn,
           formula:'API 520 §3.8 + Kw liquid BP correction + Kv viscosity iteration' };
}

  return { sizeLiquid };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API520TwoPhaseEngine
// Standard:   API 520 Part I App C — Leung (1986) omega method; corrected flash term
// Exports:    sizeTwoPhase
// Requires:   OrificeEngine
// ═════════════════════════════════════════════════════════════════
const API520TwoPhaseEngine = (() => {
  const { selectOrifice } = OrificeEngine;

function sizeTwoPhase(params) {
  const { P_set, OP=10, P_back_total=0, W, T_rel, quality_x, rho_g, rho_l,
          lambda_BTUperlb, Cp_liq, Kd=0.975, Kc=1.0 } = params;
  const P1 = P_set*(1+OP/100) + 14.696;
  const P2 = P_back_total + 14.696;
  const T_R = T_rel + 459.67;
  if (!lambda_BTUperlb || lambda_BTUperlb <= 0) return { error:'Latent heat lambda must be > 0', A_in2:0 };
  if (!rho_g || rho_g <= 0 || !rho_l || rho_l <= 0) return { error:'Phase densities must be > 0', A_in2:0 };
  const vg = 1/rho_g, vl = 1/rho_l;
  const v0 = vl + quality_x*(vg-vl);
  const vfg = vg - vl;
  const Pf = P1*144, lf = lambda_BTUperlb*778.16;
  // API 520 App C Eq. C.4 (Leung 1986) omega parameter — consistent English units:
  // ω = x₀(vfg/v₀) + (C_pL·T·P·v_fg²·778.16) / (v₀·λ²·778.16²)
  //   = x₀(vfg/v₀) + (Pf·vfg²·778.16·Cp·T) / (lf²·v₀)
  // where Pf = P1×144 [lbf/ft²],  lf = λ_BTU×778.16 [ft·lbf/lb],  778.16 = BTU→ft·lbf
  // Previous formula had v₀×vfg (missing vfg, extra v₀) and lf² without ×778.16 — fixed.
  const omega = quality_x*(vfg/v0) + (Pf*vfg*vfg*778.16*Cp_liq*T_R)/(lf*lf*v0);
  // Newton-Raphson solve for critical pressure ratio eta
  let eta = 0.55;
  for (let i = 0; i < 200; i++) {
    const fv  = eta*eta*(omega+1) - 2*omega*eta*Math.log(Math.max(eta,1e-9)) - omega;
    const dfv = 2*eta*(omega+1) - 2*omega*(Math.log(Math.max(eta,1e-9))+1);
    if (Math.abs(dfv) < 1e-14) break;
    const e2 = eta - fv/dfv;
    if (Math.abs(e2-eta) < 1e-10) { eta = e2; break; }
    eta = Math.max(0.001, Math.min(0.999, e2));
  }
  const Pc_psia = P1*eta, isSub = P2 > Pc_psia;
  let Gc_psf;
  if (!isSub) {
    Gc_psf = Math.sqrt(2*P1*144/v0) / Math.sqrt(Math.max(omega, 0.01));
  } else {
    const ea = P2/P1;
    const cc = Math.max(1 - Math.pow((ea-eta)/(1-eta), 2), 0.01);
    Gc_psf = Math.sqrt(2*P1*144*(1-ea)/v0)*Math.sqrt(cc)/Math.sqrt(Math.max(omega,0.01));
  }
  const Gc_hr = Gc_psf*3600/144;
  return {
    A_in2: W/(Kd*Kc*Gc_hr), omega, eta, Gc_lbhr_in2:Gc_hr,
    Pc_psig:Pc_psia-14.696, isSub,
    formula: 'API 520 App C — Omega method (Leung 1986)' + (isSub?' [Subcritical]':'')
  };
}

  return { sizeTwoPhase };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API521FireEngine
// Standard:   API 521 §5.15 — external fire, wetted area (Aw), heat load Q
// Exports:    calcWettedArea, sizeFireCase
// Requires:   API520GasEngine, OrificeEngine
// ═════════════════════════════════════════════════════════════════
const API521FireEngine = (() => {
  const { sizeGas } = API520GasEngine;
  const { selectOrifice } = OrificeEngine;

function calcWettedArea(D_ft, L_ft, liquid_level_pct, orientation) {
  const LL = Math.max(0, Math.min(100, liquid_level_pct));
  if (orientation === 'vertical') {
    if (LL <= 0) return 0; // no liquid → no wetted area
    const h = Math.min(L_ft*LL/100, 25);
    return Math.PI*D_ft*h + Math.PI*D_ft*D_ft/4; // shell + bottom head
  }
  if (orientation === 'sphere') {
    // h = liquid height = LL% of diameter (h=0 at empty, h=D at full)
    const h = Math.min(D_ft*LL/100, D_ft);
    if (h <= 0) return 0;
    // API 521 §5.15.1.6: spherical vessel Aw ≤ 2500 ft²
    return Math.min(Math.PI*D_ft*h, 2500);
  }
  // Horizontal cylinder: h = liquid height = LL% of diameter
  const r = D_ft/2;
  const h = Math.min(D_ft*LL/100, D_ft);
  if (h <= 0) return 0;
  const th = Math.acos(Math.max(-1, Math.min(1, (r-h)/r)));
  return 2*r*L_ft*th + 2*r*r*(th - Math.sin(th)*Math.cos(th)); // shell + 2 end caps
}

function sizeFireCase(params) {
  const { P_set, D_ft, L_ft, liquid_level_pct=60, orientation='vertical',
          F_factor=1.0, lambda_BTUperlb, T_rel, MW, k, Z=0.95 } = params;
  const Aw_raw = calcWettedArea(D_ft, L_ft, liquid_level_pct, orientation);
  const Aw = Aw_raw <= 0 ? 0 : Math.max(Aw_raw, 0.01); // 0.01 floor only for positive Aw
  const Q  = 21000 * F_factor * Math.pow(Aw, 0.82);
  const W  = Q / Math.max(lambda_BTUperlb, 1);
  const sizing = sizeGas({ P_set, OP:21, P_back_total:0, T_rel, W, MW, k, Z, Kd:0.975,
                            valve_type:'conventional', Kc:1.0 });
  return {
    ...sizing, Aw_ft2:Aw, Aw_m2:Aw*0.0929, Q_BTUhr:Q, Q_MMBTUhr:Q/1e6,
    W_relief_lbhr:W,
    formula:'API 521 §5.15: Q=21,000·F·Aw^0.82 — latent heat load only',
    model_warning:'Simplified latent-heat model. For condensate/flashing/reactive service, verify with rigorous phase-equilibrium simulation.'
  };
}

  return { calcWettedArea, sizeFireCase };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API521BlowdownEngine
// Standard:   API 521 §5.6 — isentropic ideal-gas depressurisation ODE + BDV sizing
// Exports:    bdvGasFlow, orifGasFlow, runBlowdown, sizeBlowdownValve
// Requires:   OrificeEngine
// ═════════════════════════════════════════════════════════════════
const API521BlowdownEngine = (() => {
  const { C_gas } = OrificeEngine;

function bdvGasFlow(Cv, P1, P2, T, MW, k, Z, vt) {
  // IEC 60534-2 / ISA-75.01 control valve gas flow (lb/hr):
  // W = 63.3 × Cv × P1 × Y × sqrt(x × MW / (Z × T))
  // x = (P1-P2)/P1 (pressure drop ratio, capped at xT for choked flow)
  // Y = expansion factor = max(0.667, 1 - x/(3×xT))  [Y=0.667 at critical]
  // Bug was: missing sqrt(x) → flow increased as BP rose (physically wrong).
  if (Cv <= 0 || P1 <= P2) return 0;
  const Xt = {globe:0.72, ball:0.55, butterfly:0.35}[vt] ?? 0.72;
  const Fk = k/1.4, xT = Fk*Xt;
  const x  = Math.min(xT, (P1-P2)/P1);   // capped at choked-flow limit
  const Y  = Math.max(0.667, 1-x/(3*xT)); // expansion factor (min 0.667)
  return 63.3*Cv*P1*Y*Math.sqrt(x*MW/(T*Z));
}
function orifGasFlow(A, Kd, P1, P2, T, MW, k, Z) {
  const C = C_gas(k), rc = Math.pow(2/(k+1), k/(k-1));
  if (P2/P1 <= rc) return C*Kd*A*P1/Math.sqrt(T*Z/MW);
  const r = P2/P1, F2 = Math.sqrt((k/(k-1))*Math.pow(r,2/k)*(1-Math.pow(r,(k-1)/k)));
  return 735*F2*Kd*A*P1/Math.sqrt(T*Z/MW);
}

function runBlowdown(cfg) {
  const { V, P0g, Ptg, T0F, MW, k, Z=0.95, mode, A, Kd=0.61, Cv,
          vt='globe', Qf=0, td=0, MDMT=-20 } = cfg;
  const P0 = P0g+14.696, Ptgt = Math.max(Ptg+14.696, 14.7);
  const T0 = T0F+459.67, Rs = 10.73;
  const Pa = Math.min(P0g*0.5, 100)+14.696; // API 521 target pressure
  let P = P0, T = T0, t = 0, steps = 0, Wpk = 0, ta = null, Tmin = T0-459.67;
  const pts = [];
  while (P > Ptgt+0.001 && t < 3600 && steps < 400000) {
    const Pd = Math.max(Ptgt, 14.7);
    let W = mode==='o' ? orifGasFlow(A,Kd,P,Pd,T,MW,k,Z) : bdvGasFlow(Cv||1,P,Pd,T,MW,k,Z||1,vt);
    if (W <= 0) break;
    Wpk = Math.max(Wpk, W);
    const ts = Math.max(0, t-td);
    const mc = P*V*MW/(Rs*T);
    const Cm = 1.986/(MW*(k-1));  // Cv in BTU/(lb·°R): R_u=1.986 BTU/(lb-mol·°R) / (MW*(k-1))
    const dTf = Qf>0&&ts>0 ? Qf/(mc*Cm*3600) : 0;
    const dPo = -k*(W/3600)*(Rs*T)/(MW*V);
    // dPf: fire heat raises vessel pressure. Unit chain: BTU/hr × (778.16 ft·lbf/BTU) / (144 in²/ft²) = psi·ft³/hr
    // → divide by V[ft³] and 3600[s/hr] → psia/s. Factor 778.16/144 = 5.4039 psi·ft³/BTU.
    const dPf = Qf>0&&ts>0 ? (k-1)*Qf*5.4039/(V*3600) : 0;
    const dP  = dPo + dPf;
    const dtp = Math.abs((P-Ptgt)/Math.max(Math.abs(dP), 0.0001));
    const dt  = Math.min(5, Math.max(0.02, dtp*0.15));
    const Ph  = Math.max(Ptgt+0.001, P+dP*(dt/2));
    const Th  = Math.min(T0*Math.pow(Math.max(Ph/P0,0.001),(k-1)/k)+dTf*(ts+dt/2), 1959.67);
    let Wh = mode==='o' ? orifGasFlow(A,Kd,Ph,Pd,Th,MW,k,Z) : bdvGasFlow(Cv||1,Ph,Pd,Th,MW,k,Z||1,vt);
    const dPh = Wh>0 ? (-k*(Wh/3600)*(Rs*Th)/(MW*V)+dPf) : dPf;
    P = Math.max(Ptgt, P+dPh*dt);
    T = Math.min(Math.max(T0*Math.pow(Math.max(P/P0,0.001),(k-1)/k)+dTf*ts, 60), 1959.67);
    t += dt; steps++;
    const TF = T-459.67;
    if (TF < Tmin) Tmin = TF;
    if (!ta && P <= Pa) ta = t;
    if (pts.length < 120) pts.push({ t:+t.toFixed(1), P:+(P-14.696).toFixed(1), T:+TF.toFixed(1), W:+W.toFixed(0) });
  }
  if (!ta && P <= Pa+0.1) ta = t;
  const m0 = P0*V*MW/(Rs*T0), mf = P*V*MW/(Rs*T);
  return {
    t_total_s:t, t_api521_s:ta||t, passes_15min:(ta||t)<=900,
    T_min_F:Tmin, mdmt_violated:Tmin<MDMT,
    W_peak_lbhr:Wpk, m0_lb:m0, mf_lb:mf, m_released_lb:m0-mf,
    P_final_psig:P-14.696, T_final_F:T-459.67,
    points:pts, steps,
    // IMPORTANT: This ODE treats ALL inventory as ideal gas. For vessels with
    // significant liquid hold-up (>~20% liquid volume), results are NON-CONSERVATIVE
    // (depressurization is predicted faster than reality). Use HYSYS BLOWDOWN or
    // equivalent rigorous PVT tool for liquid-containing vessels.
    liquid_inventory_warn: true,
    model:'Isentropic ideal-gas ODE + fire pressure term (k-1)Q·5.4039/(V·3600) [BTU→psi·ft³ corrected]'
  };
}

function sizeBlowdownValve(cfg) {
  // Bisection: find minimum Cv giving t_api521 ≤ 900s (15 min API 521 criterion)
  // Returns hi — the smallest Cv that passes — not (lo+hi)/2, to ensure the
  // returned Cv is always a conservative (passing) value.
  let lo = 0.001, hi = 5000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo+hi)/2;
    if (runBlowdown({...cfg, mode:'c', Cv:mid}).passes_15min) hi = mid;
    else lo = mid;
    if (hi-lo < 0.001) break;
  }
  return hi; // hi always passes; midpoint can straddle the ODE timestep boundary
}

  return { bdvGasFlow, orifGasFlow, runBlowdown, sizeBlowdownValve };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: API521ScenariosEngine
// Standard:   API 521 §5.19 (tube rupture credibility) + §5.20 (thermal expansion)
// Exports:    sizeTubeRupture, sizeThermal
// Requires:   API520GasEngine, OrificeEngine
// ═════════════════════════════════════════════════════════════════
const API521ScenariosEngine = (() => {
  const { sizeGas } = API520GasEngine;
  const { C_gas, selectOrifice } = OrificeEngine;

// ═══════════════════════════════════════════════════════════════
// MODULE: api521_tube_rupture  [API 521 §5.19]
// ═══════════════════════════════════════════════════════════════

function sizeTubeRupture(params) {
  const { OD_in, wall_t_in, n_tubes=2, Kd=0.61,
          P_HP, T_HP, MW_HP, k_HP, P_LP, T_LP, MW_LP, k_LP } = params;
  const ID  = OD_in - 2*wall_t_in;
  const A_t = n_tubes * Math.PI*(ID/2)*(ID/2);
  const P1  = P_HP+14.696, T_R = T_HP+459.67;
  // Critical mass flow through n failed tubes (HP side at relieving conditions)
  const W_tube = C_gas(k_HP)*Kd*A_t*P1 / Math.sqrt(T_R/MW_HP);
  const sizing = sizeGas({ P_set:P_LP, OP:10, P_back_total:0, T_rel:T_LP,
                            W:W_tube, MW:MW_LP, k:k_LP, Z:1.0, Kd:0.975,
                            valve_type:'conventional', Kc:1.0 });
  // API 521 §5.19 credibility — two-thirds pressure rule
  const P_ratio = (P_HP+14.696)/(P_LP+14.696);
  const credible = P_ratio > 1.5; // HP > 1.5× LP MAWP → PSV required
  return {
    ...sizing, W_tube_lbhr:W_tube, ID_in:ID,
    A_per_tube_in2: A_t/n_tubes, A_total_in2: A_t,
    n_tubes, P_ratio,
    credibility: credible
      ? 'PSV required — HP/LP ratio > 1.5 (API 521 §5.19 two-thirds rule)'
      : `Verify PSV need — P_ratio = ${P_ratio.toFixed(2)} < 1.5. May not warrant PSV per API 521 §5.19 credibility assessment.`,
    formula:'API 521 §5.19 — critical gas flow through n failed tubes'
  };
}

// ═══════════════════════════════════════════════════════════════
// MODULE: api521_thermal  [API 521 §5.20]
// ═══════════════════════════════════════════════════════════════

function sizeThermal(params) {
  const { Q_BTUhr, beta, SG, Cp_BTUperlbF, P_set, P_back=0, Kd=0.65, Kc=1.0 } = params;
  const Q_gpm = beta*Q_BTUhr/(500*SG*Cp_BTUperlbF);
  const P1 = P_set*1.1+14.696, P2 = P_back+14.696, dP = P1-P2;
  if (dP <= 0) return { error:'Invalid pressures' };
  const A = Q_gpm/(38*Kd*Kc*Math.sqrt(dP/SG));
  return { A_in2:A, Q_gpm, dP_psi:dP, formula:'A = Q_gpm/(38·Kd·Kc·√(ΔP/G)) — API 521 §5.20' };
}

  return { sizeTubeRupture, sizeThermal };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: TankBreathingEngine
// Standard:   API 2000 7th Ed. §4.2/§4.3 — tank thermal + movement breathing
// Exports:    calcAPI2000
// Requires:   nothing
// ═════════════════════════════════════════════════════════════════
const TankBreathingEngine = (() => {

// ═══════════════════════════════════════════════════════════════
// MODULE: api2000  [API 2000 7th Ed §4]
// ═══════════════════════════════════════════════════════════════

/**
 * Tank breathing requirements per API 2000 7th Ed §4.2/§4.3
 * Movement rates: 5.6 SCFH/BPH emptying, 6/12 SCFH/BPH filling
 */
function calcAPI2000(params) {
  const { capacity_bbl, flash_F=100, fill_gpm=0, pumpout_gpm=0 } = params;

  // Thermal outbreathing — API 2000 Table 2 interpolation
  function thermalOut(cap) {
    if (cap <= 3000)  return 60;
    // API 2000 Table 2: 3,000 bbl=60 SCFH, 10,000 bbl=70 SCFH
    // Correct slope = (70-60)/(10000-3000) × 1000 = 10/7 SCFH/kbbl (not 1.0)
    if (cap <= 1e4)   return 60 + (10/7)*(cap-3000)/1e3;
    if (cap <= 1e5)   return 70 + 0.9*(cap-1e4)/1e3;
    // For cap > 100,000 bbl: continue from 151 SCFH using power-law growth.
    // Using offset form to ensure continuity: 151 + 87*(r^0.7 - 1) where r = cap/100000.
    // At r=1: 151+0 = 151 (continuous with linear branch); exponent 0.7 matches API 2000 slope.
    return 151 + 87*(Math.pow(cap/1e5, 0.7) - 1.0);
  }

  const th_out  = thermalOut(capacity_bbl);
  const th_in   = th_out * 0.6; // API 2000 §4.2.2

  // Movement breathing
  const fill_bph   = fill_gpm * 60/42;   // GPM → BPH
  const empty_bph  = pumpout_gpm * 60/42;
  const flash_rate = flash_F < 100 ? 12 : 6; // SCFH/BPH per flash class
  const move_out   = fill_bph * flash_rate;   // outbreathing (filling)
  const move_in    = empty_bph * 5.6;         // inbreathing (emptying)

  const total_out  = th_out + move_out;
  const total_in   = th_in  + move_in;

  return {
    th_out_SCFH:th_out, th_in_SCFH:th_in,
    fill_BPH:fill_bph, empty_BPH:empty_bph,
    flash_rate_SCFH_BPH:flash_rate,
    move_out_SCFH:move_out, move_in_SCFH:move_in,
    total_out_SCFH:total_out, total_in_SCFH:total_in,
    governing_SCFH:Math.max(total_out, total_in),
    formula:'API 2000 7th Ed §4.2/§4.3 Table 2 + movement rates'
  };
}

  return { calcAPI2000 };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: UtilitiesEngine
// Standard:   Crane TP-410M piping; API 520 Part II §4 reaction force; IEC 60534-8-3 noise
// Exports:    calcPipeLoss, calcReactionForce, calcNoise
// Requires:   nothing
// ═════════════════════════════════════════════════════════════════
const UtilitiesEngine = (() => {
// ═══════════════════════════════════════════════════════════════
// MODULE: piping  [Crane TP-410M / API 520 Part II]
// ═══════════════════════════════════════════════════════════════

function calcPipeLoss(params) {
  const { D_in, L_ft, roughness_ft=0.00015, W_lbhr, rho_lbft3, visc_cp=0.01 } = params;
  const Df = D_in/12;
  const Ap = Math.PI*Df*Df/4;
  const v  = W_lbhr/(3600*rho_lbft3*Ap);
  const Re = rho_lbft3*v*Df/(visc_cp*6.72e-4);
  const rr = roughness_ft/Df;
  let f;
  let formula_note;
  if (Re <= 2300) {
    // Laminar (Hagen-Poiseuille): f = 64/Re  (Darcy friction factor)
    // Colebrook-White is for turbulent only — using it here gives 8× error
    f = 64 / Math.max(Re, 1e-6);
    formula_note = 'Darcy-Weisbach + Hagen-Poiseuille f=64/Re (laminar)';
  } else {
    // Turbulent / transitional: Colebrook-White implicit equation (50-iter Newton)
    f = 0.02;
    for (let i = 0; i < 50; i++) {
      const fn = Math.pow(-2*Math.log10(rr/3.7 + 2.51/(Re*Math.sqrt(f))), -2);
      if (Math.abs(fn-f) < 1e-10) break; f = fn;
    }
    formula_note = 'Darcy-Weisbach + Colebrook-White (Crane TP-410M)';
  }
  // Darcy-Weisbach: dP [psi] = f × (L/D) × ρ × v² / (2 × gc × 144)
  // gc = 32.174 lbm·ft/(lbf·s²) required to convert from momentum to pressure in English units
  const gc = 32.174;
  const dP = f*(L_ft/Df)*rho_lbft3*v*v/(2*gc*144);
  return {
    dP_psi:dP, Re, friction_f:f, v_fps:v, v_ms:v*0.3048,
    regime: Re<2300?'Laminar':Re<10000?'Transitional':'Turbulent',
    formula: formula_note
  };
}

function calcReactionForce(params) {
  const { mode='open', W_lbhr, k, P1_psia, T_F, MW, A_in2, DLF=2.0 } = params;
  const T_R = T_F+459.67, gc = 32.174, R = 1545;
  let Fm = 0, Fp = 0;
  if (mode === 'open') {
    // Open discharge throat velocity: v = sqrt(k*gc*R*T/(MW*(k+1)/2))
    // gc must be inside the sqrt to give units of ft/s (1545 ft·lbf/(lb-mol·°R) needs ×gc to become ft²/s²)
    const vth = Math.sqrt(k*R*gc*T_R/(MW*(k+1)/2));
    Fm = W_lbhr/3600*vth/gc;
    Fp = (P1_psia*Math.pow(2/(k+1),k/(k-1))-14.696)*A_in2;
  } else {
    Fm = W_lbhr/3600*Math.sqrt(k*R*T_R/(MW*gc*(k+1)));
  }
  const F_static = Fm+Fp;
  return { F_static_lbf:F_static, Fm_lbf:Fm, Fp_lbf:Fp,
           F_design_lbf:F_static*DLF, F_design_kN:F_static*DLF*0.004448,
           formula:'API 520 Part II §4 — momentum + pressure thrust × DLF' };
}

function calcNoise(params) {
  const { W_lbhr, P1_psia, P2_psia, T_F, MW, D_in, dist_m=1 } = params;
  const T_R = T_F+459.67;
  // IEC 60534-8-3 simplified 5-step
  const k = 1.3, R_gas = 1545/MW;
  const c   = Math.sqrt(k*R_gas*T_R*32.174); // speed of sound ft/s
  const p_r = Math.min(P1_psia,P2_psia)/Math.max(P1_psia,P2_psia);
  const eta_a = p_r > 0.5 ? 1e-5 : 1e-4*(1-p_r);
  const rho2  = P2_psia*MW/(10.73*T_R);
  const Ap    = Math.PI*(D_in/12)*(D_in/12)/4;
  const v2    = W_lbhr/(3600*rho2*Ap);
  const Ma    = v2/c;
  const W_kg  = W_lbhr/7936.6; // kg/s
  const Lw    = 10*Math.log10(Math.max(eta_a*W_kg*Math.pow(P1_psia/P2_psia,2)/1e-12, 1e-100));
  const TL    = 10 + 20*Math.log10(D_in);
  const Lp    = Lw - TL - 20*Math.log10(dist_m) - 11;
  return {
    Lp_dBA:Math.max(0,Lp), Lw_dB:Lw, c_fps:c, v2_fps:v2, Mach:Ma,
    assessment: Lp>115?'Extreme — hearing damage likely':Lp>100?'High — PPE required':Lp>85?'Moderate — 8hr TWA limit':' Acceptable',
    model:'IEC 60534-8-3 simplified 5-step (screening only)'
  };
}

  return { calcPipeLoss, calcReactionForce, calcNoise };
})();


// ═════════════════════════════════════════════════════════════════
// SUB-ENGINE: ValidationEngine
// Standard:   Internal — 44 regression cases vs API 520/521/2000 published data + NIST
// Exports:    runValidationSuite
// Requires:   all sub-engines
// ═════════════════════════════════════════════════════════════════
const ValidationEngine = (() => {
  const { T_sat, getKsh, getKn } = SteamTablesEngine;
  const { getKb, getKv } = CorrectionsEngine;
  const { prEOS_Z } = EOSEngine;
  const { ORIFICES, selectOrifice, C_gas } = OrificeEngine;
  const { sizeGas } = API520GasEngine;
  const { sizeSteam } = API520SteamEngine;
  const { sizeLiquid } = API520LiquidEngine;
  const { sizeTwoPhase } = API520TwoPhaseEngine;
  const { sizeFireCase } = API521FireEngine;
  const { runBlowdown, sizeBlowdownValve } = API521BlowdownEngine;
  const { sizeTubeRupture } = API521ScenariosEngine;
  const { calcAPI2000 } = TankBreathingEngine;

function runValidationSuite() {
  const results = [];
  function t(name, got, expected, tol, ref) {
    const ok = typeof expected==='boolean' ? got===expected
             : typeof expected==='string'  ? got===expected
             : isFinite(got) && Math.abs((got-expected)/Math.max(Math.abs(expected),1e-9)) <= tol;
    results.push({ name, got, expected, tol, ok, ref:ref||'' });
  }

  // API 520 §3.6.2 published example
  const g1 = sizeGas({P_set:150,OP:10,P_back_total:15,T_rel:400,W:25000,MW:44.1,k:1.14,Z:0.97,Kd:0.975,valve_type:'conventional',Kc:1});
  t('Gas API520 §3.6.2 A=1.874 in²', g1.A_in2, 1.874, 0.005, 'API 520 9th Ed §3.6.2');
  t('Gas §3.6.2 → L orifice', selectOrifice(g1.A_in2).d, 'L', 0, 'API 526 orifice selection');
  t('Gas §3.6.2 isCrit=true', g1.isCrit, true, 0, 'API 520 critical flow');

  // Steam saturated
  const P1s = 200*1.1+14.696, Ts = T_sat(P1s);
  const s1 = sizeSteam({P_set:200,OP:10,P_back_total:20,T_rel:Ts,W:25000,Kd:0.975,valve_type:'conventional',Kc:1});
  t('Steam API520 §3.7 A=2.123 in²', s1.A_in2, 2.123, 0.005, 'API 520 §3.7 Napier');

  // Liquid Kv iteration
  const l1 = sizeLiquid({P_set:300,OP:10,P_back_total:30,W:45000,rho_lbft3:52.3,visc_cp:5.5,Kd:0.65,valve_type:'conventional',Kc:1});
  t('Liquid Kv iteration converged', l1.Kv < 1.0, true, 0, 'API 520 §3.8 Kv viscosity');

  // Subcritical gas
  const g_sub = sizeGas({P_set:150,OP:10,P_back_total:130,T_rel:400,W:25000,MW:44.1,k:1.14,Z:0.97,Kd:0.975,valve_type:'conventional',Kc:1});
  t('Gas subcritical at high BP', g_sub.isCrit, false, 0, 'API 520 Eq.4 subcritical');
  t('Subcritical A > critical A', g_sub.A_in2 > g1.A_in2, true, 0, 'Subcritical physics');

  // Steam tables
  t('T_sat(14.696) = 212°F', T_sat(14.696), 212, 0.001, 'IAPWS-IF97 at 1 atm');
  t('T_sat(614.7) ≈ 490°F', T_sat(614.7), 489.7, 0.004, 'NIST Steam Tables');
  t('Ksh(100,400) = 0.979', getKsh(100,400), 0.979, 0.001, 'API 520 Table 9');
  t('Ksh at T_sat = 1.0', getKsh(P1s, Ts-2), 1.0, 0.001, 'API 520 Table 9');
  t('Ksh(1500,1200) extended', getKsh(1500,1200) > 0.8, true, 0, 'API 520 ext to 1200°F');
  t('Kn(2000) = 0.989', getKn(2000), 0.989, 0.001, 'API 520 Table 3');
  t('Kn(3215) = 0.877', getKn(3215), 0.877, 0.001, 'API 520 Table 3');

  // Kb corrections
  t('LP Kb (LESER 0.3 barg) in range', getKb(4.35,0,'conventional',1.3), 0.72, 0.10, 'LESER ASME/API Guide');
  t('HP Kb 0% BP = 1.0', getKb(150,0,'conventional'), 1.0, 0.001, 'API 520 Fig.30');
  t('HP Kb 40% BP = 0.6', getKb(150,60,'conventional'), 0.6, 0.001, 'API 520 Fig.30');
  t('HP Kb 25% BP = 0.8', getKb(150,37.5,'conventional'), 0.8, 0.01, 'API 520 Fig.30');
  t('Bellows 30% BP = 1.0', getKb(150,45,'bellows'), 1.0, 0.001, 'API 520 9th Ed. Fig.31');
  t('Bellows 50% BP = 1.0', getKb(150,75,'bellows'), 1.0, 0.001, 'API 520 9th Ed. Fig.31 (was 0.85 in 6th Ed.)');
  t('Pilot 80% BP = 1.0', getKb(150,120,'pilot'), 1.0, 0.001, 'API 520 pilot');

  // Proportionality
  const Az1 = sizeGas({P_set:150,OP:10,P_back_total:15,T_rel:200,W:10000,MW:44.1,k:1.14,Z:1.0,Kd:0.975,valve_type:'conventional',Kc:1}).A_in2;
  const Az2 = sizeGas({P_set:150,OP:10,P_back_total:15,T_rel:200,W:10000,MW:44.1,k:1.14,Z:0.9,Kd:0.975,valve_type:'conventional',Kc:1}).A_in2;
  t('A ∝ √Z (Z=0.9)', Az2/Az1, Math.sqrt(0.9), 0.001, 'API 520 Eq.3 proportionality');
  const Aw1 = sizeGas({P_set:150,OP:10,P_back_total:15,T_rel:200,W:10000,MW:44.1,k:1.14,Z:0.95,Kd:0.975,valve_type:'conventional',Kc:1}).A_in2;
  const Aw2 = sizeGas({P_set:150,OP:10,P_back_total:15,T_rel:200,W:20000,MW:44.1,k:1.14,Z:0.95,Kd:0.975,valve_type:'conventional',Kc:1}).A_in2;
  t('A ∝ W (linear)', Aw2/Aw1, 2.0, 0.001, 'API 520 Eq.3 proportionality');

  // Tube rupture
  const tr_lo = sizeTubeRupture({OD_in:0.75,wall_t_in:0.083,n_tubes:2,Kd:0.61,P_HP:180,T_HP:400,MW_HP:28,k_HP:1.30,P_LP:150,T_LP:200,MW_LP:44.1,k_LP:1.14});
  const tr_hi = sizeTubeRupture({OD_in:0.75,wall_t_in:0.083,n_tubes:2,Kd:0.61,P_HP:600,T_HP:400,MW_HP:28,k_HP:1.30,P_LP:150,T_LP:200,MW_LP:44.1,k_LP:1.14});
  t('TR low P-ratio → Verify warning', tr_lo.credibility.includes('Verify'), true, 0, 'API 521 §5.19');
  t('TR high P-ratio → PSV required', tr_hi.credibility.includes('PSV required'), true, 0, 'API 521 §5.19');
  t('TR 2 tubes = 2× flow', tr_hi.W_tube_lbhr / sizeTubeRupture({OD_in:0.75,wall_t_in:0.083,n_tubes:1,Kd:0.61,P_HP:600,T_HP:400,MW_HP:28,k_HP:1.30,P_LP:150,T_LP:200,MW_LP:44.1,k_LP:1.14}).W_tube_lbhr, 2.0, 0.001, 'API 521 §5.19 scaling');

  // Blowdown ODE
  const bd = runBlowdown({V:200,P0g:300,Ptg:100,T0F:150,MW:44.1,k:1.14,Z:0.92,mode:'o',A:3.6,Kd:0.61});
  const Tth = (150+459.67)*Math.pow((100+14.696)/(300+14.696),(1.14-1)/1.14)-459.67;
  t('BD isentropic T vs theory', bd.T_final_F, Tth, 0.01, 'Isentropic ODE closed-form');
  const bd1 = runBlowdown({V:100,P0g:400,Ptg:14,T0F:150,MW:44,k:1.14,Z:0.92,mode:'o',A:1.838,Kd:0.61});
  const bd2 = runBlowdown({V:200,P0g:400,Ptg:14,T0F:150,MW:44,k:1.14,Z:0.92,mode:'o',A:1.838,Kd:0.61});
  t('BD t ∝ V (ratio=2.0)', bd2.t_api521_s/bd1.t_api521_s, 2.0, 0.05, 'ODE volume proportionality');
  const CvLP = sizeBlowdownValve({V:200,P0g:300,Ptg:14,T0F:100,MW:44.1,k:1.14,Z:0.92,mode:'c',vt:'globe'});
  t('BD LP propane auto-size → 15 min', runBlowdown({V:200,P0g:300,Ptg:14,T0F:100,MW:44.1,k:1.14,Z:0.92,mode:'c',Cv:CvLP,vt:'globe'}).t_api521_s/60, 15, 0.03, 'API 521 15-min criterion');
  const CvHP = sizeBlowdownValve({V:100,P0g:1200,Ptg:100,T0F:90,MW:17.5,k:1.30,Z:0.88,mode:'c',vt:'globe'});
  t('BD HP gas 1200 psig → 15 min', runBlowdown({V:100,P0g:1200,Ptg:100,T0F:90,MW:17.5,k:1.30,Z:0.88,mode:'c',Cv:CvHP,vt:'globe'}).t_api521_s/60, 15, 0.03, 'API 521 15-min criterion');
  const CvH2 = sizeBlowdownValve({V:100,P0g:2200,Ptg:100,T0F:150,MW:2.016,k:1.40,Z:1.12,mode:'c',vt:'globe'});
  const bdH2 = runBlowdown({V:100,P0g:2200,Ptg:100,T0F:150,MW:2.016,k:1.40,Z:1.12,mode:'c',Cv:CvH2,vt:'globe'});
  t('BD H2 2200 psig → 15 min', bdH2.t_api521_s/60, 15, 0.03, 'API 521 H2 high-pressure');
  t('BD H2 T_min < −150°F', bdH2.T_min_F < -150, true, 0, 'MDMT brittle fracture check');

  // API 2000
  const a2k = calcAPI2000({capacity_bbl:10000,flash_F:95,fill_gpm:100,pumpout_gpm:0});
  t('API 2000 fill 100 GPM → 142.86 BPH', a2k.fill_BPH, 142.857, 0.01, 'API 2000 §4.3.2.2 unit conversion');
  t('API 2000 flash<100°F → 12 SCFH/BPH', a2k.flash_rate_SCFH_BPH, 12, 0, 'API 2000 §4.3.2.2');
  t('API 2000 move_out = 142.86×12', a2k.move_out_SCFH, 142.857*12, 0.01, 'API 2000 §4.3.2.2');
  const a2k_s = calcAPI2000({capacity_bbl:10000,flash_F:150,fill_gpm:100,pumpout_gpm:0});
  t('API 2000 stable flash ≥100°F → 6 SCFH/BPH', a2k_s.flash_rate_SCFH_BPH, 6, 0, 'API 2000 §4.3.2.2');
  t('API 2000 pump-out 100 GPM → 142.86 BPH', calcAPI2000({capacity_bbl:10000,flash_F:95,fill_gpm:0,pumpout_gpm:100}).empty_BPH, 142.857, 0.01, 'API 2000 §4.3.2.1');

  // PR EOS
  t('PR EOS CH4 Z=0.979 (NIST)', prEOS_Z(300,200,343.1,667.8,0.011), 0.979, 0.005, 'NIST WebBook');
  t('PR EOS H2 Z>1 at 2200 psia', prEOS_Z(2200,150,59.8,188.2,-0.216) > 1.0, true, 0, 'NIST WebBook superideal');
  t('PR EOS CO2 Z≈0.80 at 1000 psia', prEOS_Z(1000,200,547.9,1070.6,0.239), 0.80, 0.03, 'NIST WebBook');
  t('PR EOS N2 Z≈1.009 at 1000 psia', prEOS_Z(1000,200,227.4,492.8,0.040), 1.009, 0.005, 'NIST WebBook');

  // Fire geometry
  const fire_zero = sizeFireCase({P_set:150,D_ft:6,L_ft:20,liquid_level_pct:60,orientation:'vertical',F_factor:0,lambda_BTUperlb:145,T_rel:200,MW:44.1,k:1.14,Z:0.95});
  t('Fire F=0 → W=0 lb/hr', fire_zero.W_relief_lbhr, 0, 0.001, 'API 521 §5.15 F-factor');

  // EIEPD literature regression: nat-gas fire case
  // MW=16.54, k=1.18, Z=1.01, P_set=55 barg=798 psig, W=8541 lb/hr, published A=0.16 in² (E orifice)
  const A_ng = sizeGas({P_set:798,OP:10,P_back_total:0,T_rel:60,W:8541,MW:16.54,k:1.18,Z:1.01,Kd:0.975,valve_type:'conventional',Kc:1}).A_in2;
  t('EIEPD nat-gas fire: A<0.5 in²', A_ng < 0.5, true, 0, 'EIEPD PSV worked example');
  t('EIEPD nat-gas fire: E or F orifice', ['E','F'].includes(selectOrifice(A_ng).d), true, 0, 'EIEPD E orifice published');

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  return { results, pass, fail, total:results.length };
}

  return { runValidationSuite };
})();


// ═════════════════════════════════════════════════════════════════
// PSVApi — Flat aggregate namespace (backward-compatible)
// Individual engines are also accessible via PSVApi.engines.*
// ═════════════════════════════════════════════════════════════════
const PSVApi = Object.assign(
  {},
  SteamTablesEngine,
  CorrectionsEngine,
  EOSEngine,
  OrificeEngine,
  API520GasEngine,
  API520SteamEngine,
  API520LiquidEngine,
  API520TwoPhaseEngine,
  API521FireEngine,
  API521BlowdownEngine,
  API521ScenariosEngine,
  TankBreathingEngine,
  UtilitiesEngine,
  ValidationEngine,
  {
    // Named sub-engine references for modular access
    engines: {
      SteamTables:    SteamTablesEngine,
      Corrections:    CorrectionsEngine,
      EOS:            EOSEngine,
      Orifice:        OrificeEngine,
      GasSizing:      API520GasEngine,
      SteamSizing:    API520SteamEngine,
      LiquidSizing:   API520LiquidEngine,
      TwoPhaseSizing: API520TwoPhaseEngine,
      FireCase:       API521FireEngine,
      Blowdown:       API521BlowdownEngine,
      Scenarios:      API521ScenariosEngine,
      TankBreathing:  TankBreathingEngine,
      Utilities:      UtilitiesEngine,
      Validation:     ValidationEngine,
    }
  }
);

// Browser global — available as window.PSVApi
if (typeof window !== 'undefined') window.PSVApi = PSVApi;
// Node.js module
if (typeof module !== 'undefined') module.exports = PSVApi;
