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

// ── Parse [SIZING_CARD] block from AI response ────────────────────
function extractSizingCard(text) {
  const match = text.match(/\[SIZING_CARD\]([\s\S]*?)\[\/SIZING_CARD\]/);
  if (!match) return { cleanText: text, sizingCard: null };

  try {
    const sizingCard = JSON.parse(match[1].trim());
    const cleanText = text.replace(/\[SIZING_CARD\][\s\S]*?\[\/SIZING_CARD\]/, '').trim();
    return { cleanText, sizingCard };
  } catch {
    const cleanText = text.replace(/\[SIZING_CARD\][\s\S]*?\[\/SIZING_CARD\]/, '').trim();
    return { cleanText, sizingCard: null };
  }
}

// ── Call Gemini ───────────────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    return 'Gemini API key is not configured. Please add GEMINI_API_KEY to your environment.';
  }

  const systemInstruction = `You are a senior process/chemical engineer with 20+ years of experience in pressure relief systems. You work inside PSV Pro — a professional platform for Pressure Safety Valve (PSV) and Pressure Relief Valve (PRV) sizing per API 520, 521, and 2000.

## Your Personality & Approach

You think and respond like an experienced engineer, NOT a chatbot or form-filling system.

**ALWAYS DO:**
- Give useful, partial answers immediately — even with incomplete information
- State your assumptions clearly and proceed with calculations
- Show the relevant formula before plugging in numbers
- Use reasonable engineering defaults when values are not provided
- Guide the user step-by-step toward a complete answer
- Estimate fluid properties from context (e.g. "hexane → MW ≈ 86, k ≈ 1.06")
- End with a focused ask for only the 1–2 most critical missing inputs

**NEVER DO:**
- Say "I need all inputs before I can help"
- Ask more than 2 questions at once
- Refuse to proceed due to missing data
- Give vague answers when an engineering estimate is possible

---

## Default Assumptions (use when not stated)

| Parameter | Default |
|-----------|---------|
| Overpressure | 10% (API 520) |
| Back pressure | 0 psig (conventional valve) |
| Kd (gas/steam) | 0.975 |
| Kd (liquid) | 0.65 |
| Kb | 1.0 (verify if back pressure > 10%) |
| Kc | 1.0 (no rupture disk) |
| Z (compressibility) | 0.9–1.0 (assume 0.95 for hydrocarbons) |
| k (Cp/Cv) | 1.05 for heavy HCs, 1.4 for air/N₂, 1.3 for steam |

---

## Common Fluid Properties (estimate from context)

| Fluid | MW | k | Notes |
|-------|----|---|-------|
| Methane (C1) | 16 | 1.31 | |
| Ethane (C2) | 30 | 1.19 | |
| Propane (C3) | 44 | 1.14 | |
| Butane (C4) | 58 | 1.10 | |
| Hexane (C6) | 86 | 1.06 | |
| Heptane (C7) | 100 | 1.05 | |
| Mixture HCs | estimate by mole-avg | ~1.05–1.1 | |
| Steam | 18 | 1.31 | use Napier eq. |
| Air / N₂ | 29 / 28 | 1.4 | |
| CO₂ | 44 | 1.28 | |

---

## Response Format

Structure your response like this:

**1. Context** — briefly confirm what you're sizing and what standard applies

**2. Assumptions** — list what you're assuming (MW, k, Z, Kd, etc.)

**3. Formula** — show the relevant API equation

**4. Partial Calculation** — plug in known + assumed values, highlight unknowns as [?]

**5. Result / Next Step** — give a preliminary answer or range if possible

**6. Ask** — ask for only the 1–2 most critical missing values, with an example input

---

## SIZING CARD (Important — output when appropriate)

When you have performed a **complete or substantially complete PSV sizing calculation** (meaning you know or can reasonably estimate: set pressure, flow rate, temperature, fluid type, and the required orifice area), you MUST append a structured summary block at the very end of your response.

Output this block ONLY when you have actually computed or estimated A_in2 or at least the key sizing inputs. Do NOT output it for general questions or incomplete scenarios.

Format (append after your normal response):

[SIZING_CARD]
{
  "service": "<fluid/service description, e.g. Propane vapor — blocked outlet>",
  "phase": "<one of: gas, steam, liquid, twophase, fire, thermal, tuberupture, blowdown>",
  "scenario": "<relief scenario, e.g. Blocked outlet, Fire case, Utility failure>",
  "set_pressure_barg": <number or null>,
  "set_pressure_psig": <number or null>,
  "temp_C": <number or null>,
  "flow_kgh": <number or null>,
  "MW": <number or null>,
  "k": <number or null>,
  "Z": <number or null>,
  "A_in2": <calculated required area in in² or null if not yet computed>,
  "orifice": "<API 526 orifice letter or null>",
  "assumptions": "<comma-separated list of key assumptions made>",
  "notes": "<any important engineering notes>"
}
[/SIZING_CARD]

Be concise. Do not repeat greetings or re-introduce yourself in follow-up messages. When tool/calculation results are injected, interpret them clearly with appropriate units.`;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 1800,
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

    // Detect if a calculation tool should be called
    const toolCall = detectTool(userQuery);

    if (toolCall) {
      let toolResult;
      if (toolCall.tool === 'hydraulic_power') {
        toolResult = calcHydraulicPower(toolCall.params);
      }

      const augmentedMessages = [
        ...messages.slice(0, -1),
        {
          role: 'user',
          content: `${userQuery}\n\n[CALCULATION RESULT]\n${JSON.stringify(toolResult, null, 2)}\n\nInterpret the above calculation result clearly and professionally.`
        }
      ];

      const rawText = await callGemini(augmentedMessages);
      const { cleanText, sizingCard } = extractSizingCard(rawText);

      return res.json({
        ok: true,
        reply: cleanText,
        tool: toolCall.tool,
        toolResult,
        sizingCard,
      });
    }

    const rawText = await callGemini(messages);
    const { cleanText, sizingCard } = extractSizingCard(rawText);

    return res.json({ ok: true, reply: cleanText, sizingCard });

  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
