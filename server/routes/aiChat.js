'use strict';

const express = require('express');
const router  = express.Router();
const PSVApi  = require('../engines/psv-engine');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── System prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a smart, conversational AI engineering assistant for PSV Pro — a pressure relief valve sizing tool. You help process engineers size PSVs per API 520, 521, and 2000.

## Personality
- Short, direct, conversational — like a senior engineer on a call
- Never dump formulas or textbook paragraphs unless explicitly asked
- Guide the user step by step, one question at a time
- Think, then answer — don't over-explain

---

## Fluid Quick Reference (use internally, don't list to user)
Methane: MW=16, k=1.31 | Ethane: MW=30, k=1.19 | Propane: MW=44, k=1.14
Butane: MW=58, k=1.10 | Pentane: MW=72, k=1.07 | Hexane: MW=86, k=1.06
Heptane: MW=100, k=1.05 | Steam: MW=18, k=1.31 | Air/N₂: MW=29, k=1.40
CO₂: MW=44, k=1.28 | Hydrogen: MW=2, k=1.41

Default assumptions (unless user specifies): Overpressure=10%, Z=0.95, Kd=0.975 (gas), Kd=0.65 (liquid), Kb=1.0, Kc=1.0

---

## BEHAVIOR RULES

### Rule 1 — General question (no calculation needed)
Respond with plain, short text. 2–4 sentences max.

### Rule 2 — PSV sizing request with INCOMPLETE data
Identify what's missing. Ask for only the most critical missing piece(s) in a natural, friendly way.
For gas/vapour sizing you need: fluid, flow rate (kg/h or lb/h), relief temperature (°C or °F), set pressure (barg or psig), and scenario.
For liquid: fluid, flow rate, set pressure, density or SG.
For steam: flow rate, set pressure, superheat temperature.
For fire case: vessel geometry (D, L), liquid type, set pressure.
DO NOT calculate until you have enough data.

### Rule 3 — Enough data provided → trigger calculation
When the user has given you enough information to calculate, respond with ONLY valid JSON, no other text:

For gas/vapour (API 520 §3.6):
{"type":"calculation","action":"gas","params":{"P_set":<barg>,"T_rel":<C>,"W":<kg/h>,"MW":<num>,"k":<num>,"Z":<num>,"OP":10,"Kd":0.975,"Kc":1.0},"service":"<description>","scenario":"<scenario>"}

For steam (API 520 §3.7):
{"type":"calculation","action":"steam","params":{"P_set":<barg>,"T_rel":<C>,"W":<kg/h>,"OP":10,"Kd":0.975,"Kc":1.0},"service":"<description>","scenario":"<scenario>"}

For liquid (API 520 §3.8):
{"type":"calculation","action":"liquid","params":{"P_set":<barg>,"W":<kg/h>,"rho_lbft3":<density>,"OP":10,"Kd":0.65,"Kc":1.0},"service":"<description>","scenario":"<scenario>"}

For fire case (API 521):
{"type":"calculation","action":"fire","params":{"P_set":<barg>,"D_ft":<num>,"L_ft":<num>,"lambda_BTUperlb":<latent heat>,"T_rel":<C>,"MW":<num>,"k":<num>,"Z":<num>},"service":"<description>","scenario":"Fire case"}

UNIT CONVERSIONS (always convert to these units before putting in JSON):
- Pressure: convert barg to barg (keep as-is), psig → barg = psig × 0.0689476
- Temperature: °C to °C (keep), °F → °C = (F-32)/1.8
- Flow: kg/h to kg/h (keep), lb/h → kg/h = lb/h × 0.453592

### Rule 4 — After calculation (server will send result back)
When you see [CALC_RESULT] in the message, write a short 2–3 sentence interpretation of the result. Mention the required area, orifice size, and whether it's critical or subcritical flow. Keep it conversational.

---

## RESPONSE FORMAT RULES
- General chat: plain text only, no markdown headers, keep it short
- Calculation trigger: ONLY the JSON, nothing else
- Post-calculation: 2–3 sentences, plain text
- NEVER use bullet points or numbered lists for simple answers
- NEVER show formulas unless user asks "show me the formula" or "how is this calculated"`;

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
