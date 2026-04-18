'use strict';

const express = require('express');
const router = express.Router();
const PSVApi = require('../engines/psv-engine');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── Tool: hydraulic power calculation ────────────────────────────
function calcHydraulicPower({ flow_m3hr, head_m, density_kgm3 = 1000 }) {
  const power_kW = (flow_m3hr / 3600) * head_m * density_kgm3 * 9.81 / 1000;
  const power_hp = power_kW * 1.341;
  return {
    type: 'hydraulic_power',
    flow_m3hr,
    head_m,
    density_kgm3,
    power_kW: +power_kW.toFixed(4),
    power_hp: +power_hp.toFixed(4),
    formula: 'P = (Q × ρ × g × H) / 1000',
  };
}

// ── Tool: PSV gas sizing ──────────────────────────────────────────
function calcGasSizing(params) {
  try {
    const result = PSVApi.sizeGas(params);
    return { type: 'gas_sizing', ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
  } catch (e) {
    return { type: 'gas_sizing', error: e.message };
  }
}

// ── Extract numbers from text ─────────────────────────────────────
function extractNumbers(text) {
  const nums = [];
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)/g)) nums.push(+m[1]);
  return nums;
}

// ── Simple keyword-based tool detection ──────────────────────────
function detectTool(query) {
  const q = query.toLowerCase();

  if (/hydraulic\s*power|pump\s*power|fluid\s*power/.test(q) ||
      (/power/i.test(q) && /flow/i.test(q) && /head/i.test(q))) {

    let flow = null, head = null;
    const flowM = query.match(/(\d+(?:\.\d+)?)\s*(?:m3\/h|m³\/h)/i);
    if (flowM) flow = +flowM[1];
    const headPatterns = [
      /at\s+(\d+(?:\.\d+)?)\s*m\b/i,
      /head\s+(\d+(?:\.\d+)?)\s*m\b/i,
      /(\d+(?:\.\d+)?)\s*m\s+head/i,
    ];
    for (const p of headPatterns) {
      const m = query.match(p);
      if (m) { head = +m[1]; break; }
    }
    if (flow === null || head === null) {
      const nums = extractNumbers(query);
      if (flow === null && nums.length >= 1) flow = nums[0];
      if (head === null && nums.length >= 2) head = nums[1];
    }
    if (flow !== null && head !== null) {
      return { tool: 'hydraulic_power', params: { flow_m3hr: flow, head_m: head } };
    }
  }
  return null;
}

// ── Call Gemini ───────────────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    return 'Gemini API key is not configured. Please add GEMINI_API_KEY to your environment.';
  }

  const systemInstruction = `You are an expert AI assistant for PSV Pro — a professional platform for Pressure Safety Valve (PSV) and Pressure Relief Valve (PRV) engineering.

You help engineers with:
- PSV/PRV sizing (API 520, 521, 2000 standards)
- Fluid mechanics, hydraulics, thermodynamics
- Relief system design and engineering calculations
- Equipment selection and engineering best practices

When a user asks for a calculation that you cannot do precisely (e.g., PSV sizing needs specific input data), ask them for the required parameters in a clear, structured way.

When tool results are provided in the conversation, interpret them clearly and professionally.

Be concise, technically accurate, and conversational. Do NOT repeat greetings or introductions in follow-up messages.`;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini error:', res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
}

// ── POST /api/ai-chat ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: 'messages array required' });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ ok: false, error: 'Last message must be from user' });
    }

    const userQuery = lastMessage.content;

    // Detect if a tool should be called
    const toolCall = detectTool(userQuery);

    if (toolCall) {
      // Run the calculation
      let toolResult;
      if (toolCall.tool === 'hydraulic_power') {
        toolResult = calcHydraulicPower(toolCall.params);
      }

      // Build a message for Gemini that includes the calculation result
      const augmentedMessages = [
        ...messages.slice(0, -1),
        {
          role: 'user',
          content: `${userQuery}\n\n[CALCULATION RESULT]\n${JSON.stringify(toolResult, null, 2)}\n\nPlease interpret the above calculation result in a clear, professional way for the user.`
        }
      ];

      const aiText = await callGemini(augmentedMessages);

      return res.json({
        ok: true,
        reply: aiText,
        tool: toolCall.tool,
        toolResult,
      });
    }

    // No tool needed — send directly to Gemini
    const aiText = await callGemini(messages);

    return res.json({ ok: true, reply: aiText });

  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
