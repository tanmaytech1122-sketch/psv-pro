'use strict';

const express = require('express');
const router  = express.Router();
const PSVApi  = require('../engines/psv-engine');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── System prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior chemical/process engineer and AI assistant like ChatGPT, built into PSV Pro — a professional pressure relief valve sizing platform.

Your job: give complete, human-like, helpful answers — always in clean Markdown, always useful, never robotic.

========================
PERSONALITY & STYLE
========================
- Talk like a real senior engineer: clear, confident, practical
- Always respond in clean, readable Markdown
- Structure answers: Context → Assumptions → Calculation/Explanation → Result
- Keep it concise unless user asks for detail
- NEVER act like a textbook — be practical, not theoretical
- NEVER output raw JSON in your response

========================
FLUID PROPERTIES — ESTIMATE INTERNALLY, NEVER ASK USER
========================
Estimate automatically from fluid name. NEVER ask user for MW, k, Z, Kd, or density.

| Fluid | MW | k | Latent Heat (BTU/lb) |
|-------|-----|------|----------------------|
| Methane | 16 | 1.31 | 220 |
| Ethane | 30 | 1.19 | 210 |
| Propane | 44 | 1.14 | 184 |
| Butane | 58 | 1.10 | 165 |
| Pentane | 72 | 1.07 | 154 |
| Hexane | 86 | 1.06 | 144 |
| Heptane | 100 | 1.05 | 136 |
| Steam | 18 | 1.31 | 970 |
| Air/N₂ | 29 | 1.40 | — |
| CO₂ | 44 | 1.28 | — |
| Hydrogen | 2 | 1.41 | — |
| Unknown HC | 72 | 1.08 | 150 |

Defaults: Overpressure=10% (blocked outlet) or 21% (fire), Z=0.95, Kd=0.975 (gas), Kd=0.65 (liquid), Kb=1.0, Kc=1.0, Back pressure=0

========================
BEHAVIOR RULES
========================

RULE 1 — General engineering question:
Answer simply, clearly, with Markdown formatting. Use bullet points or short paragraphs.

RULE 2 — PSV sizing request, MISSING critical data:
Make reasonable assumptions for anything not given. State what you assumed. Then proceed.
Only ask for the truly unknown things a user would know (not technical properties):
- Flow rate (if not mentioned and cannot be estimated)
- Set pressure (if not mentioned)
If you have fluid + pressure + some flow context → proceed with assumptions.
NEVER ask for MW, k, Z, density, viscosity.

RULE 3 — User provides enough data (fluid + flow + pressure ± temperature):
FIRST write a complete, formatted Markdown answer with all steps shown.
THEN, at the very end, append a hidden calculation trigger on its own line:
%%CALC:{"type":"calculation","action":"<gas|steam|liquid|fire>","params":{"P_set":<barg>,"T_rel":<°C>,"W":<kg/h>,"MW":<est>,"k":<est>,"Z":0.95,"OP":10,"Kd":0.975,"Kc":1.0},"service":"<desc>","scenario":"<scenario>"}%%

Unit conversions before JSON: psig→barg (×0.0689), °F→°C ((F-32)/1.8), lb/h→kg/h (×0.4536)

RULE 4 — After calculation (when you see [CALC_RESULT] in the message):
Update your answer with the verified engine results. Format as:

**Result:**
- Required Area: X in²
- Selected Orifice: **Y** (API 526, X.XX in², DN flange)
- Flow regime: critical/subcritical

Keep it professional but friendly.

========================
MARKDOWN FORMAT TEMPLATE (for PSV sizing)
========================

**PSV Design — [Fluid] System**

**Given:**
- Set Pressure: X barg
- Relief Flow: X kg/h
- Temperature: X°C
- Scenario: [scenario]

**Assumptions:**
- MW = X, k = X (estimated for [fluid])
- Z = 0.95, Kd = 0.975, Kc = 1.0
- Overpressure = 10%

**Calculation:**
(show key steps clearly — P1, C factor, required area formula with numbers)

**Result:**
- Required Area: X in²
- Selected Orifice: **Y**

========================
STRICT RULES
========================
- NEVER output raw JSON as visible text to the user
- NEVER ask for thermodynamic data (MW, k, Z, Kd, Cp, density)
- ALWAYS make assumptions and proceed — never refuse to calculate
- ALWAYS use Markdown formatting in your response
- If user asks a non-engineering question → answer helpfully like ChatGPT would`;

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

// ── Format calc result for Gemini to rewrite as Markdown ─────────
function buildCalcContext(action, aiMarkdown, params, result) {
  const psig2barg = (p) => (p / 14.5038).toFixed(2);
  return `[CALC_RESULT — verified by PSV engine]
Action: ${action} sizing (API 520/521)
Required area: ${result.A_in2.toFixed(4)} in²
Selected orifice: ${result.orifice?.d || 'N/A'} (${result.orifice?.a?.toFixed(3) || '?'} in², ${result.orifice?.in_sz || '?'} flange)
Orifice utilisation: ${result.orifice?.cap_pct?.toFixed(1) || '?'}%
Flow regime: ${result.isCrit ? 'critical (choked)' : 'subcritical'}
Relief pressure P1: ${result.P1_psia?.toFixed(1) || '?'} psia (${psig2barg(result.P1_psia)} barg)
Kb: ${result.Kb?.toFixed(3) || '1.000'} | Kd: ${params.Kd ?? 0.975} | Kc: ${params.Kc ?? 1.0}
[/CALC_RESULT]

The user's answer below was written BEFORE the engine ran. Rewrite it, keeping all the context and steps, but replace the estimated result with the VERIFIED engine result above. Keep it in clean Markdown. Keep the same structure (Given / Assumptions / Calculation / Result).

Original answer:
${aiMarkdown}`;
}

// ── Extract %%CALC:{...}%% trigger from AI response ───────────────
function extractCalcTrigger(text) {
  const match = text.match(/%%CALC:([\s\S]*?)%%/);
  if (!match) return { cleanText: text, calcObj: null };

  try {
    const calcObj = JSON.parse(match[1].trim());
    if (calcObj.type === 'calculation' && calcObj.action && calcObj.params) {
      const cleanText = text.replace(/%%CALC:[\s\S]*?%%/, '').trim();
      return { cleanText, calcObj };
    }
  } catch { /* malformed JSON — ignore */ }

  // Strip the trigger even if JSON failed, so user never sees it
  const cleanText = text.replace(/%%CALC:[\s\S]*?%%/, '').trim();
  return { cleanText, calcObj: null };
}

// ── Call Gemini ───────────────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    return { rawText: 'Gemini API key is not configured.' };
  }

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 1500 },
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
  return { rawText };
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
    const { rawText } = await callGemini(messages);

    // Step 2: Extract %%CALC:%% trigger if present
    const { cleanText, calcObj } = extractCalcTrigger(rawText);

    // Step 3: If calc trigger found → run PSV engine
    if (calcObj) {
      let engineResult, engineError;
      try {
        engineResult = runCalculation(calcObj.action, calcObj.params);
      } catch (e) {
        engineError = e.message;
      }

      if (engineError) {
        return res.json({
          ok: true,
          reply: `${cleanText}\n\n> ⚠️ Engine note: ${engineError} — result above is an estimate only.`,
          sizingCard: null,
        });
      }

      // Step 4: Ask Gemini to rewrite the answer with the verified engine result
      const calcContext = buildCalcContext(calcObj.action, cleanText, calcObj.params, engineResult);
      const interpMessages = [
        ...messages,
        { role: 'assistant', content: cleanText },
        { role: 'user',      content: calcContext },
      ];

      const { rawText: finalMarkdown } = await callGemini(interpMessages);
      const { cleanText: finalReply } = extractCalcTrigger(finalMarkdown); // strip any stray trigger
      const sizingCard = buildSizingCard(calcObj.action, calcObj, engineResult, calcObj.params);

      return res.json({
        ok: true,
        reply: finalReply,
        sizingCard,
        engineResult,
      });
    }

    // Step 5: Plain chat / general question response
    return res.json({ ok: true, reply: rawText, sizingCard: null });

  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
