'use strict';

const express = require('express');
const router  = express.Router();
const PSVApi  = require('../engines/psv-engine');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = 'gemini-2.5-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── System prompt with STRICT calculation trigger rules ─────────────────
const SYSTEM_PROMPT = `You are a senior chemical/process engineer and AI assistant for PSV Pro.

CRITICAL RULE - YOU MUST FOLLOW THIS EXACTLY:
When the user asks for a PSV SIZING calculation (asks for "size", "design", "calculate" a PSV/PRV), you MUST:
1. First provide a complete Markdown answer with all steps
2. THEN append EXACTLY this format on a new line (no extra spaces):
%%CALC:{"type":"calculation","action":"gas","params":{"P_set":10,"T_rel":150,"W":5000,"MW":44,"k":1.14,"Z":0.95},"service":"propane gas","scenario":"blocked outlet"}%%

For LIQUID services use action:"liquid"
For STEAM services use action:"steam"
For FIRE case use action:"fire"

EXAMPLE for propane gas with 10 barg, 5000 kg/h:
%%CALC:{"type":"calculation","action":"gas","params":{"P_set":10,"T_rel":150,"W":5000,"MW":44,"k":1.14},"service":"propane relief","scenario":"blocked outlet"}%%

NEVER skip the %%CALC%% trigger when user asks for sizing!

FLUID PROPERTIES (estimate automatically):
- Propane: MW=44, k=1.14
- Butane: MW=58, k=1.10
- Hexane: MW=86, k=1.06
- Heptane: MW=100, k=1.05
- Methane: MW=16, k=1.31
- Ethane: MW=30, k=1.19
- Steam: MW=18, k=1.31
- Air: MW=29, k=1.40

Always estimate missing data. Never ask for MW, k, Z, density.

For hydraulic power questions: Just answer directly without calculation trigger.`;

// ── Run PSV engine calculation ────────────────────────────────────
function runCalculation(action, params) {
  console.log('Running calculation:', action, params);
  
  const barg2psig = (b) => b * 14.5038;
  const kgh2lbh   = (k) => k * 2.20462;
  const C2F       = (c) => c * 9/5 + 32;

  try {
    switch (action) {
      case 'gas': {
        const p = {
          P_set:        barg2psig(params.P_set),
          OP:           params.OP    ?? 10,
          P_back_total: params.P_back_total ?? 0,
          T_rel:        params.T_rel ? C2F(params.T_rel) : 150,
          W:            kgh2lbh(params.W || 5000),
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
          T_rel:        params.T_rel ? C2F(params.T_rel) : 200,
          W:            kgh2lbh(params.W || 5000),
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
          W:            kgh2lbh(params.W || 5000),
          rho_lbft3:    params.rho_lbft3 ?? 43.7,
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
          D_ft:            params.D_ft ?? 10,
          L_ft:            params.L_ft ?? 20,
          liquid_level_pct: params.liquid_level_pct ?? 60,
          orientation:     params.orientation ?? 'vertical',
          F_factor:        params.F_factor ?? 1.0,
          lambda_BTUperlb: params.lambda_BTUperlb ?? 150,
          T_rel:           params.T_rel ? C2F(params.T_rel) : 250,
          MW:              params.MW ?? 44,
          k:               params.k  ?? 1.14,
          Z:               params.Z  ?? 0.95,
        };
        const result = PSVApi.sizeFireCase(p);
        return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('Engine error:', err);
    throw err;
  }
}

// ── Format engine result ───────────────────────────────────
function buildVerifiedResultSection(action, params, result) {
  const psig2barg = (p) => (p / 14.5038).toFixed(2);
  const orifice   = result.orifice;
  const flowLabel = result.isCrit ? 'Critical (choked)' : 'Subcritical';
  
  return `

---

**✅ PSV Sizing Result (Engine Calculated)**

| Parameter | Value |
|-----------|-------|
| Required Area | **${result.A_in2?.toFixed(4) || 'N/A'} in²** |
| Selected Orifice | **${orifice?.d || 'N/A'}** (${orifice?.a?.toFixed(3) || '?'} in²) |
| Orifice Size | ${orifice?.in_sz || 'N/A'} (API 526) |
| Relief Pressure P1 | ${result.P1_psia?.toFixed(1) || 'N/A'} psia (${P1_barg} barg) |
| Flow Regime | ${flowLabel} |

> ✅ Calculated by PSV Pro engine using API 520/521 standards`;
}

// ── Extract %%CALC:{}%% trigger ───────────────────────────────
function extractCalcTrigger(text) {
  // Match the exact pattern with JSON
  const match = text.match(/%%CALC:(\{[^}]*\})%%/);
  if (!match) {
    console.log('No calc trigger found in response');
    return { cleanText: text, calcObj: null };
  }

  try {
    const calcObj = JSON.parse(match[1]);
    console.log('Found calc trigger:', calcObj);
    
    if (calcObj.type === 'calculation' && calcObj.action && calcObj.params) {
      const cleanText = text.replace(/%%CALC:\{[^}]*\}%%/, '').trim();
      return { cleanText, calcObj };
    }
  } catch (err) {
    console.error('Failed to parse calc trigger:', err.message);
  }
  
  const cleanText = text.replace(/%%CALC:\{[^}]*\}%%/, '').trim();
  return { cleanText, calcObj: null };
}

// ── Call Gemini API ──────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured in .env');
  }

  // Build conversation with system prompt
  const contents = [];
  
  // Add system instruction
  contents.push({
    role: 'user',
    parts: [{ text: `System instruction: ${SYSTEM_PROMPT}\n\nPlease respond professionally.` }]
  });
  
  // Add conversation history (skip first if we added system)
  for (const msg of messages) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  const body = {
    contents: contents,
    generationConfig: {
      temperature: 0.3,  // Lower temperature for more consistent output
      maxOutputTokens: 2000,
      topP: 0.9,
    }
  };

  const url = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;
  console.log('Calling Gemini API...');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Gemini response length:', text.length);
  
  return { rawText: text };
}

// ── POST /api/ai-chat ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !messages.length) {
      return res.status(400).json({ ok: false, error: 'Messages required' });
    }

    console.log('\n=== New Chat Request ===');
    console.log('User query:', messages[messages.length - 1]?.content?.substring(0, 100));

    // Get AI response
    const { rawText } = await callGemini(messages);
    
    // Check for calculation trigger
    const { cleanText, calcObj } = extractCalcTrigger(rawText);
    
    // If we have a calculation, run the engine
    if (calcObj) {
      console.log('Executing PSV calculation...');
      
      try {
        const result = runCalculation(calcObj.action, calcObj.params);
        const verifiedSection = buildVerifiedResultSection(calcObj.action, calcObj.params, result);
        const finalReply = cleanText + verifiedSection;
        
        // Build sizing card
        const sizingCard = {
          service: calcObj.service || `${calcObj.action} sizing`,
          phase: calcObj.action,
          scenario: calcObj.scenario || 'blocked outlet',
          set_pressure_barg: calcObj.params.P_set,
          flow_kgh: calcObj.params.W,
          MW: calcObj.params.MW,
          k: calcObj.params.k,
          A_in2: result.A_in2,
          orifice: result.orifice?.d,
          selected_orifice_size: result.orifice?.in_sz,
          utilisation_pct: result.orifice?.cap_pct
        };
        
        console.log('✅ Calculation complete! Orifice:', result.orifice?.d);
        
        return res.json({
          ok: true,
          reply: finalReply,
          sizingCard: sizingCard,
          engineResult: {
            area_in2: result.A_in2,
            orifice: result.orifice?.d,
            orifice_size: result.orifice?.in_sz,
            is_choked: result.isCrit
          }
        });
        
      } catch (engineErr) {
        console.error('Engine error:', engineErr);
        return res.json({
          ok: true,
          reply: cleanText + `\n\n⚠️ Engine calculation error: ${engineErr.message}. Please check input parameters.`,
          sizingCard: null
        });
      }
    }
    
    // No calculation trigger - just return the AI response
    console.log('No calculation needed, returning chat response');
    return res.json({
      ok: true,
      reply: rawText,
      sizingCard: null
    });
    
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;