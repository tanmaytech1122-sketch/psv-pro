'use strict';

const express  = require('express');
const router   = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { functionDeclarations, executeTool } = require('../lib/tools');
const { retrieveRelevantChunks, loadDocuments } = require('../lib/rag');

// Pre-load knowledge base on startup
loadDocuments();

const GEMINI_MODEL    = 'gemini-2.5-flash';
const ALLOWED_MODELS  = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'];

// ── Training-aware system prompt ─────────────────────────────────
const SYSTEM_PROMPT = `You are a senior process engineer specialised in Pressure Safety Valve (PSV) and Pressure Relief Valve (PRV) design per API 520, API 521, and API 526.

STRICT RULES — follow exactly:
1. NEVER perform numerical calculations yourself. ALWAYS call the appropriate tool for any calculation. This includes sizing, power, area, flow rate, or any numeric engineering result.
2. For knowledge questions (standards, theory, definitions, procedures), answer using the CONTEXT section below if provided. If the answer is not in the context, reply: "Not found in provided knowledge base. Consider uploading relevant documentation."
3. If a calculation is requested but required inputs are missing, ask ONLY for the specific missing values — list them by name and unit.
4. Always state units explicitly in every answer (barg, °C, kg/h, in², etc.).
5. Keep answers short, structured, and professional. Use bullet points or numbered steps where appropriate.
6. Never invent numerical results — all numbers must come from tool responses.

TRAINING AWARENESS (for dataset consistency):
- Structure responses clearly: context → reasoning → conclusion.
- Prefer grounded answers over guessing. If unsure, say so explicitly.
- Avoid hallucination: do not cite page numbers, clause numbers, or specific values unless they appear in the CONTEXT section.
- Responses should be self-contained: a reader without the original query should understand the answer.
- Use consistent terminology: PSV (Pressure Safety Valve), PRV (Pressure Relief Valve), API 520/521/526.`;

// ── Convert chat history to Gemini format ─────────────────────────
// Gemini requires: alternating user/model turns, must start with user
function toGeminiHistory(messages) {
  const history = [];
  const prior   = messages.slice(0, -1);
  let started   = false;

  for (const m of prior) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (!started && role === 'model') continue;
    started = true;
    history.push({ role, parts: [{ text: m.content || '' }] });
  }

  // Deduplicate consecutive same-role turns by merging them
  const clean = [];
  for (const turn of history) {
    if (clean.length && clean[clean.length - 1].role === turn.role) {
      clean[clean.length - 1].parts[0].text += '\n' + turn.parts[0].text;
    } else {
      clean.push(turn);
    }
  }
  return clean;
}

// ── Build a SizingCard from tool result ───────────────────────────
function buildSizingCard(toolName, args, result) {
  if (toolName === 'calculate_hydraulic_power') return null;

  const phase = {
    size_psv_gas:    'gas',
    size_psv_steam:  'steam',
    size_psv_liquid: 'liquid',
    size_psv_fire:   'fire',
  }[toolName] || 'gas';

  const inp = result.inputs_used || args;
  return {
    service:              inp.fluid || `${phase} service`,
    phase,
    scenario:             args.scenario || 'blocked outlet',
    set_pressure_barg:    inp.P_set_barg,
    flow_kgh:             inp.W_kgh,
    temp_C:               inp.T_rel_C,
    MW:                   inp.MW,
    k:                    inp.k,
    Z:                    inp.Z,
    A_in2:                result.required_area_in2,
    orifice:              result.orifice_designation,
    orifice_area_in2:     result.orifice_area_in2,
    selected_orifice_size: result.orifice_size,
    utilisation_pct:      result.utilisation_pct,
    toolResult:           result,
  };
}

// ── POST /api/ai-chat ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { messages, model: modelOverride } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ ok: false, error: 'messages array required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not configured' });
  }

  // Allow eval system to override the model (validated against allowlist)
  const activeModel = ALLOWED_MODELS.includes(modelOverride) ? modelOverride : GEMINI_MODEL;

  const genAI     = new GoogleGenerativeAI(apiKey);
  const userQuery = messages[messages.length - 1]?.content || '';

  console.log(`\n=== Agent Request ===`);
  console.log(`Query: ${userQuery.substring(0, 120)}`);
  if (modelOverride && modelOverride !== GEMINI_MODEL) {
    console.log(`Model override: ${activeModel}`);
  }

  try {
    // ── RAG retrieval (local TF-IDF, zero API cost) ───────────────
    const chunks      = retrieveRelevantChunks(userQuery, 3);
    const contextUsed = chunks.length > 0 && chunks[0].score > 0.05;
    const ragSources  = contextUsed ? chunks.map(c => ({
      source:  c.source,
      topic:   c.topic,
      section: c.section,
      score:   Number(c.score.toFixed(3)),
    })) : [];

    const contextBlock = contextUsed
      ? `\n\nCONTEXT (engineering knowledge base — use for knowledge questions only):\n${
          chunks.map((c, i) =>
            `[${i + 1}] Topic: ${c.topic}\n    Section: ${c.section}\n    Source: ${c.source}\n\n${c.text}`
          ).join('\n\n---\n\n')
        }`
      : '';

    const systemWithContext = SYSTEM_PROMPT + contextBlock;

    // ── Single Gemini call: tools + context injected together ─────
    const model = genAI.getGenerativeModel({
      model: activeModel,
      tools: [{ functionDeclarations }],
      systemInstruction: systemWithContext,
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    });

    const history = toGeminiHistory(messages);
    const chat    = model.startChat({ history });

    let result     = await chat.sendMessage(userQuery);
    let toolCalled = null;
    let toolArgs   = null;
    let toolOutput = null;
    let sizingCard = null;
    let intent     = 'knowledge';

    // ── Agent loop: execute tool calls until Gemini stops ─────────
    const MAX_TURNS = 3;
    let turns = 0;

    while (turns < MAX_TURNS) {
      const calls = result.response.functionCalls();
      if (!calls?.length) break;

      intent = 'calculation';
      turns++;
      const functionResponses = [];

      for (const call of calls) {
        console.log(`Tool call: ${call.name}`, JSON.stringify(call.args).substring(0, 200));
        toolCalled = call.name;
        toolArgs   = call.args;

        try {
          toolOutput = executeTool(call.name, call.args);
          console.log(`Tool result:`, JSON.stringify(toolOutput).substring(0, 200));
          sizingCard = buildSizingCard(call.name, call.args, toolOutput);
        } catch (err) {
          console.error(`Tool error: ${err.message}`);
          toolOutput = { error: err.message };
        }

        functionResponses.push({
          functionResponse: { name: call.name, response: toolOutput },
        });
      }

      result = await chat.sendMessage(functionResponses);
    }

    const reply = result.response.text();
    console.log(`Reply (intent:${intent} | tool:${toolCalled || 'none'} | rag:${contextUsed})`);

    return res.json({
      ok:           true,
      reply,
      intent,
      tool_called:  toolCalled,
      context_used: contextUsed && intent === 'knowledge',
      rag_sources:  intent === 'knowledge' ? ragSources : [],
      sizingCard,
      toolResult:   toolCalled === 'calculate_hydraulic_power' ? toolOutput : null,
    });

  } catch (err) {
    // ── Detect Gemini 429 / quota errors and surface them cleanly ──
    const errMsg  = String(err.message || '');
    const is429   = err.status === 429
      || errMsg.includes('[429]')
      || errMsg.includes('429')
      || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(errMsg);

    if (is429) {
      // Try to parse retryDelay from Gemini error details (e.g. "30s")
      let retryAfterS = 60;
      if (Array.isArray(err.errorDetails)) {
        for (const d of err.errorDetails) {
          const raw = d?.retryDelay || d?.['@retryDelay'];
          if (raw) {
            const m = String(raw).match(/(\d+)/);
            if (m) { retryAfterS = parseInt(m[1], 10); break; }
          }
        }
      }
      console.warn(`[ai-chat] Rate limit hit (429) — Retry-After: ${retryAfterS}s`);
      res.setHeader('Retry-After', String(retryAfterS));
      return res.status(429).json({
        ok:             false,
        error:          'Rate limit exceeded (429)',
        retry_after_s:  retryAfterS,
      });
    }

    console.error('Agent error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
