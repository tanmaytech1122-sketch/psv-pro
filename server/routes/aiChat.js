'use strict';

const express = require('express');
const router  = express.Router();
const PSVApi  = require('../engines/psv-engine');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── System prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a smart, conversational AI assistant like ChatGPT, built into PSV Pro — a pressure relief valve sizing platform.

GOAL: Answer ANY user query in a natural, helpful, human-like way. Never fail. Never return errors or say "I don't understand".

========================
CORE PERSONALITY
========================
- Friendly, confident, slightly casual but professional
- Helpful first, technical second
- Keep answers concise unless user asks for detail
- Use emojis sparingly (👍, 🔧, ✅)
- Short paragraphs or brief bullet points — never walls of text
- NEVER act like a textbook. NEVER dump formulas.

========================
FLUID PROPERTIES — USE INTERNALLY, NEVER ASK USER
========================
Estimate these automatically from fluid name. Never ask the user for MW, k, Z, or Kd.
Methane: MW=16, k=1.31 | Ethane: MW=30, k=1.19 | Propane: MW=44, k=1.14
Butane: MW=58, k=1.10 | Pentane: MW=72, k=1.07 | Hexane: MW=86, k=1.06
Heptane: MW=100, k=1.05 | Steam: MW=18, k=1.31 | Air/N₂: MW=29/28, k=1.40
CO₂: MW=44, k=1.28 | Hydrogen: MW=2, k=1.41 | Unknown HC mixture: MW=72, k=1.08
Default: Overpressure=10%, Z=0.95, Kd=0.975 (gas/steam), Kd=0.65 (liquid), Kb=1.0, Kc=1.0

========================
BEHAVIOR RULES
========================

RULE 1 — General engineering question:
Answer simply and conversationally. 2–4 sentences. Use examples if helpful.

RULE 2 — PSV/relief valve sizing request with MISSING data:
DO NOT calculate yet. Ask ONLY for practical inputs the user would know:
  • Flow rate (kg/h, m³/h, or lb/h)
  • Temperature (°C or °F)  
  • Set pressure (barg or psig)
  • Scenario (blocked outlet, fire case, utility failure, etc.)
NEVER ask for MW, k, Z, density, or other technical properties — estimate them from the fluid name.
Keep it natural and friendly. Give an example of what the inputs look like.

RULE 3 — User has provided enough data (fluid + flow + temperature + pressure):
Respond with ONLY valid JSON — no other text before or after:

Gas/vapour (API 520 §3.6):
{"type":"calculation","action":"gas","params":{"P_set":<barg>,"T_rel":<°C>,"W":<kg/h>,"MW":<estimated>,"k":<estimated>,"Z":0.95,"OP":10,"Kd":0.975,"Kc":1.0},"service":"<fluid + service>","scenario":"<scenario>"}

Steam (API 520 §3.7):
{"type":"calculation","action":"steam","params":{"P_set":<barg>,"T_rel":<°C>,"W":<kg/h>,"OP":10,"Kd":0.975,"Kc":1.0},"service":"Steam","scenario":"<scenario>"}

Liquid (API 520 §3.8):
{"type":"calculation","action":"liquid","params":{"P_set":<barg>,"W":<kg/h>,"rho_lbft3":<SG×62.4>,"OP":10,"Kd":0.65,"Kc":1.0},"service":"<fluid>","scenario":"<scenario>"}

Fire case (API 521):
{"type":"calculation","action":"fire","params":{"P_set":<barg>,"D_ft":<num>,"L_ft":<num>,"lambda_BTUperlb":150,"T_rel":<°C>,"MW":<estimated>,"k":<estimated>,"Z":0.95},"service":"<fluid>","scenario":"Fire case"}

Unit handling: keep barg as barg, keep °C as °C, keep kg/h as kg/h. Convert psig→barg (×0.0689), °F→°C ((F-32)/1.8), lb/h→kg/h (×0.4536) before putting in JSON.

RULE 4 — After calculation (when you see [CALC_RESULT] in the message):
Write a friendly 2–3 sentence summary. Mention the orifice letter, required area, and flow regime. Be conversational — like telling a colleague the result.

========================
STRICT RULES
========================
- NEVER return JSON to the user as visible text — it is for backend use only
- NEVER say "cannot process", "error", or "I need more information" coldly
- NEVER ask for thermodynamic properties (MW, k, Z, Kd, Cp, viscosity)
- NEVER show calculation formulas unless user explicitly asks
- Always respond — if unsure, give a helpful best-effort answer`;

// ── Run PSV engine calculation ────────────────────────────────────
function runCalculation(action, params) {
  // Convert units: barg → psi gauge (engine uses psig internally via P_set in barg)
  // The engine accepts P_set in barg for most routes — verify with engine signature
  // Engine actually works with psig for P_set — convert barg to psig
  const barg2psig = (b) => b * 14.5038;
  const kgh2lbh   = (k) => k * 2.20462;
  const C2F       = (c) => c * 9/5 + 32;

  switch (action) {
    case 'gas': {
      const p = {
        P_set:        barg2psig(params.P_set),
        OP:           params.OP    ?? 10,
        P_back_total: params.P_back_total ?? 0,
        T_rel:        C2F(params.T_rel),
        W:            kgh2lbh(params.W),
        MW:           params.MW,
        k:            params.k,
        Z:            params.Z    ?? 0.95,
        Kd:           params.Kd   ?? 0.975,
        valve_type:   params.valve_type ?? 'conventional',
        Kc:           params.Kc   ?? 1.0,
        inlet_dP:     params.inlet_dP ?? 0,
      };
      const result = PSVApi.sizeGas(p);
      return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
    }
    case 'steam': {
      const p = {
        P_set:        barg2psig(params.P_set),
        OP:           params.OP    ?? 10,
        P_back_total: params.P_back_total ?? 0,
        T_rel:        C2F(params.T_rel),
        W:            kgh2lbh(params.W),
        Kd:           params.Kd   ?? 0.975,
        valve_type:   params.valve_type ?? 'conventional',
        Kc:           params.Kc   ?? 1.0,
      };
      const result = PSVApi.sizeSteam(p);
      return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
    }
    case 'liquid': {
      const p = {
        P_set:        barg2psig(params.P_set),
        OP:           params.OP    ?? 10,
        P_back_total: params.P_back_total ?? 0,
        W:            kgh2lbh(params.W),
        rho_lbft3:    params.rho_lbft3 ?? (params.SG ? params.SG * 62.4 : 43.7),
        visc_cp:      params.visc_cp ?? 1.0,
        Kd:           params.Kd   ?? 0.65,
        valve_type:   params.valve_type ?? 'conventional',
        Kc:           params.Kc   ?? 1.0,
      };
      const result = PSVApi.sizeLiquid(p);
      return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
    }
    case 'fire': {
      const p = {
        P_set:           barg2psig(params.P_set),
        D_ft:            params.D_ft,
        L_ft:            params.L_ft,
        liquid_level_pct: params.liquid_level_pct ?? 60,
        orientation:     params.orientation ?? 'vertical',
        F_factor:        params.F_factor ?? 1.0,
        lambda_BTUperlb: params.lambda_BTUperlb ?? 150,
        T_rel:           C2F(params.T_rel ?? 250),
        MW:              params.MW ?? 44,
        k:               params.k  ?? 1.14,
        Z:               params.Z  ?? 0.95,
      };
      const result = PSVApi.sizeFireCase(p);
      return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
    }
    default:
      throw new Error(`Unknown calculation action: ${action}`);
  }
}

// ── Format a friendly calc result message for Gemini to interpret ─
function buildCalcContext(action, params, result) {
  return `[CALC_RESULT]
Action: ${action} sizing (API 520)
Required area: ${result.A_in2.toFixed(4)} in²
Selected orifice: ${result.orifice?.d || 'N/A'} (${result.orifice?.a?.toFixed(3) || '?'} in², ${result.orifice?.in_sz || '?'} flange)
Flow regime: ${result.isCrit ? 'critical' : 'subcritical'}
Relief pressure P1: ${result.P1_psia?.toFixed(1) || '?'} psia
Kb: ${result.Kb?.toFixed(3) || 1.0} | Kd: ${params.Kd ?? 0.975}
[/CALC_RESULT]
Now write a short 2–3 sentence interpretation for the engineer. Be conversational, mention orifice size and whether it's critical flow.`;
}

// ── Try to parse Gemini response as JSON ──────────────────────────
function tryParseCalcJSON(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj.type === 'calculation' && obj.action && obj.params) return obj;
  } catch { /* not JSON */ }
  return null;
}

// ── Call Gemini ───────────────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    return { rawText: 'Gemini API key is not configured.', parsed: null };
  }

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 1200 },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini error:', res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
  const parsed  = tryParseCalcJSON(rawText);
  return { rawText, parsed };
}

// ── Build sizing card from engine result + AI metadata ────────────
function buildSizingCard(action, aiObj, result, params) {
  const psig2barg = (p) => p / 14.5038;
  return {
    service:           aiObj.service || `${action} sizing`,
    phase:             action,
    scenario:          aiObj.scenario || '',
    set_pressure_barg: +psig2barg(params.P_set).toFixed(2),
    temp_C:            params.T_rel != null ? +((params.T_rel - 32) * 5/9).toFixed(1) : null,
    flow_kgh:          params.W     != null ? +(params.W / 2.20462).toFixed(1) : null,
    MW:                params.MW    ?? null,
    k:                 params.k     ?? null,
    Z:                 params.Z     ?? null,
    A_in2:             +result.A_in2.toFixed(4),
    orifice:           result.orifice?.d || null,
    assumptions:       `Overpressure 10%, Kd=${params.Kd}, Kc=${params.Kc}, Z=${params.Z ?? 0.95}`,
    notes:             result.isCrit ? 'Critical (choked) flow.' : 'Subcritical flow.',
  };
}

// ── POST /api/ai-chat ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ ok: false, error: 'messages array required' });
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') {
      return res.status(400).json({ ok: false, error: 'Last message must be from user' });
    }

    // Step 1: Ask Gemini
    const { rawText, parsed } = await callGemini(messages);

    // Step 2: If Gemini returned a calculation trigger → run engine
    if (parsed) {
      let engineResult, engineError;
      try {
        engineResult = runCalculation(parsed.action, parsed.params);
      } catch (e) {
        engineError = e.message;
      }

      if (engineError) {
        return res.json({
          ok: true,
          reply: `I tried to calculate that but hit an issue: ${engineError}. Can you double-check the inputs?`,
          sizingCard: null,
        });
      }

      // Step 3: Send result back to Gemini for a friendly interpretation
      const calcContext = buildCalcContext(parsed.action, parsed.params, engineResult);
      const interpMessages = [
        ...messages,
        { role: 'assistant', content: rawText },
        { role: 'user',      content: calcContext },
      ];

      const { rawText: interpretation } = await callGemini(interpMessages);
      const sizingCard = buildSizingCard(parsed.action, parsed, engineResult, parsed.params);

      return res.json({
        ok: true,
        reply: interpretation,
        sizingCard,
        engineResult,
      });
    }

    // Step 4: Plain chat response
    return res.json({ ok: true, reply: rawText, sizingCard: null });

  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
