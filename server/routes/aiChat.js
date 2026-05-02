'use strict';

const express  = require('express');
const router   = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { functionDeclarations, executeTool } = require('../lib/tools');
const { retrieveRelevantChunks, loadDocuments }  = require('../lib/rag');

// Pre-load knowledge base on startup
loadDocuments();

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are a senior process engineer specialised in Pressure Safety Valve (PSV) and Pressure Relief Valve (PRV) design per API 520, API 521, and API 526.

STRICT RULES — follow exactly:
1. NEVER perform numerical calculations yourself. ALWAYS call the appropriate tool for any calculation.
2. For knowledge questions (standards, theory, definitions, procedures), answer using the CONTEXT provided. If the answer is not in the context, reply: "Not found in provided data."
3. If a calculation is requested but required inputs are missing, ask ONLY for the specific missing values. Do not ask for values you can estimate (e.g. Z-factor, k for common fluids).
4. Always state units explicitly in every answer.
5. Keep answers short, structured, and professional.
6. Never make up numerical results — all numbers must come from tool responses.`;

const CLASSIFY_PROMPT = `Classify the following engineering query into exactly one of two intents:
- "calculation": user wants a numerical result (sizing, power, area, flow rate, etc.)
- "knowledge": user wants explanation, definition, theory, standards information, troubleshooting, or comparison

Query: "{QUERY}"

Respond with ONLY one word: calculation OR knowledge`;

// ── Classify intent ───────────────────────────────────────────────
async function classifyIntent(query, genAI) {
  try {
    const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = CLASSIFY_PROMPT.replace('{QUERY}', query);
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim().toLowerCase();
    return text.includes('calculation') ? 'calculation' : 'knowledge';
  } catch {
    return 'knowledge';
  }
}

// ── Convert chat history to Gemini format ─────────────────────────
function toGeminiHistory(messages) {
  const history = [];
  for (const m of messages.slice(0, -1)) {
    history.push({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  return history;
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
    service:           inp.fluid || `${phase} service`,
    phase,
    scenario:          args.scenario || 'blocked outlet',
    set_pressure_barg: inp.P_set_barg,
    flow_kgh:          inp.W_kgh,
    temp_C:            inp.T_rel_C,
    MW:                inp.MW,
    k:                 inp.k,
    Z:                 inp.Z,
    A_in2:             result.required_area_in2,
    orifice:           result.orifice_designation,
    orifice_area_in2:  result.orifice_area_in2,
    selected_orifice_size: result.orifice_size,
    utilisation_pct:   result.utilisation_pct,
    toolResult:        result,
  };
}

// ── POST /api/ai-chat ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { messages } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ ok: false, error: 'messages array required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not configured' });
  }

  const genAI      = new GoogleGenerativeAI(apiKey);
  const userQuery  = messages[messages.length - 1]?.content || '';

  console.log(`\n=== Agent Request ===`);
  console.log(`Query: ${userQuery.substring(0, 120)}`);

  try {
    // ── STEP 1: Classify intent ──────────────────────────────────
    const intent = await classifyIntent(userQuery, genAI);
    console.log(`Intent: ${intent}`);

    // ── STEP 2A: Knowledge query → RAG + Gemini ──────────────────
    if (intent === 'knowledge') {
      const chunks = retrieveRelevantChunks(userQuery, 3);
      const contextUsed = chunks.length > 0;

      const contextBlock = contextUsed
        ? `\n\nCONTEXT (from engineering knowledge base):\n${chunks.map((c, i) => `[${i+1}] ${c.source}:\n${c.text}`).join('\n\n')}`
        : '';

      const systemWithContext = SYSTEM_PROMPT + contextBlock;
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: systemWithContext,
      });

      const history = toGeminiHistory(messages);
      const chat    = model.startChat({ history });
      const result  = await chat.sendMessage(userQuery);
      const reply   = result.response.text();

      console.log(`Knowledge reply (RAG: ${contextUsed}, chunks: ${chunks.length})`);

      return res.json({
        ok:           true,
        reply,
        intent:       'knowledge',
        tool_called:  null,
        context_used: contextUsed,
        rag_sources:  chunks.map(c => c.source),
        sizingCard:   null,
        toolResult:   null,
      });
    }

    // ── STEP 2B: Calculation query → tool calling ─────────────────
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      tools: [{ functionDeclarations }],
      systemInstruction: SYSTEM_PROMPT,
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    });

    const history = toGeminiHistory(messages);
    const chat    = model.startChat({ history });

    let result       = await chat.sendMessage(userQuery);
    let toolCalled   = null;
    let toolArgs     = null;
    let toolOutput   = null;
    let sizingCard   = null;

    // ── Agent loop: handle tool calls ─────────────────────────────
    const MAX_TURNS = 3;
    let turns = 0;

    while (turns < MAX_TURNS) {
      const calls = result.response.functionCalls();
      if (!calls?.length) break;

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
          functionResponse: {
            name:     call.name,
            response: toolOutput,
          },
        });
      }

      result = await chat.sendMessage(functionResponses);
    }

    const reply = result.response.text();
    console.log(`Calculation reply (tool: ${toolCalled})`);

    return res.json({
      ok:           true,
      reply,
      intent:       'calculation',
      tool_called:  toolCalled,
      context_used: false,
      sizingCard,
      toolResult:   toolCalled === 'calculate_hydraulic_power' ? toolOutput : null,
    });

  } catch (err) {
    console.error('Agent error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
