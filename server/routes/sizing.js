'use strict';
const express = require('express');
const router = express.Router();
const PSVApi = require('../engines/psv-engine');
const { validate } = require('../middleware/validation');

// ── OpenRouter API Configuration ───────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';

// ── Local parser: extract flow & head from a natural-language query ─
function parseQueryLocally(query) {
  const isHydraulicQuery = /hydraulic/i.test(query) ||
    (/power/i.test(query) && /flow/i.test(query) && /head/i.test(query));

  if (!isHydraulicQuery) return null;

  const numbers = [];
  for (const m of query.matchAll(/(\d+(?:\.\d+)?)/g)) numbers.push(parseFloat(m[1]));

  if (numbers.length < 2) return null;

  let flow = null, head = null;

  const flowMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:m3\/h|m³\/h|cubic)/i);
  if (flowMatch) flow = parseFloat(flowMatch[1]);

  const headPatterns = [
    /at\s+(\d+(?:\.\d+)?)\s*m\b/i,
    /head\s+(\d+(?:\.\d+)?)\s*m\b/i,
    /(\d+(?:\.\d+)?)\s*m\s+head/i,
    /(\d+(?:\.\d+)?)\s*m(?!3|\/h)/i,
  ];
  for (const p of headPatterns) {
    const m = query.match(p);
    if (m) { head = parseFloat(m[1]); break; }
  }

  if (flow === null && numbers.length >= 1) flow = numbers[0];
  if (head === null && numbers.length >= 2) head = numbers[1];

  if (flow === null || head === null || isNaN(flow) || isNaN(head)) return null;

  return {
    intent: 'hydraulic_power',
    parameters: { flow_m3hr: flow, head_m: head },
    confidence: 0.95,
  };
}

// ── Call OpenRouter / Claude to extract parameters ─────────────────
async function callOpenRouter(userQuery) {
  if (!OPENROUTER_API_KEY) return null;

  const prompt = `Extract flow and head values from this engineering query.
Query: "${userQuery}"
Return ONLY valid JSON: {"flow_m3hr": number, "head_m": number}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'PSV Pro API',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'Extract numbers from engineering queries. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '');

    if (!content) return null;

    const parsed = JSON.parse(content);
    return (parsed.flow_m3hr && parsed.head_m) ? parsed : null;
  } catch {
    return null;
  }
}

// ── POST /api/size/ai-query ───────────────────────────────────────
router.post('/ai-query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing or invalid "query" field' });
    }

    const allNumbers = [];
    for (const m of query.matchAll(/(\d+(?:\.\d+)?)/g)) allNumbers.push(parseFloat(m[1]));

    let intent = parseQueryLocally(query);

    if (!intent && OPENROUTER_API_KEY) {
      const apiResult = await callOpenRouter(query);
      if (apiResult?.flow_m3hr && apiResult?.head_m) {
        intent = {
          intent: 'hydraulic_power',
          parameters: { flow_m3hr: apiResult.flow_m3hr, head_m: apiResult.head_m },
          confidence: 0.90,
        };
      }
    }

    if (!intent && allNumbers.length >= 2) {
      intent = {
        intent: 'hydraulic_power',
        parameters: { flow_m3hr: allNumbers[0], head_m: allNumbers[1] },
        confidence: 0.80,
      };
    }

    if (!intent) {
      return res.status(422).json({
        ok: false,
        error: 'Could not understand query',
        suggestion: 'Try: "hydraulic power 800 m3/h at 30 m head"',
        examples: [
          'power for flow 250 m3/h and head 75 m',
          'hydraulic power 500 m3/h at 30 m head',
        ],
      });
    }

    const { flow_m3hr, head_m } = intent.parameters;
    const power_kW = (flow_m3hr / 3600) * head_m * 9.81;
    const power_hp = power_kW * 1.341;

    res.json({
      ok: true,
      result: {
        query,
        intent: 'hydraulic_power',
        confidence: intent.confidence,
        parameters_used: { flow_m3hr, head_m },
        calculation_result: {
          power_kW,
          power_hp,
          formula: 'P = (Q × ρ × g × H) / 1000',
          flow_m3hr,
          head_m,
        },
        explanation: `Hydraulic Power: ${power_kW.toFixed(2)} kW (${power_hp.toFixed(2)} HP) for flow ${flow_m3hr} m³/h at ${head_m} m head`,
      },
    });

  } catch (err) {
    console.error('AI query error:', err.message);
    res.status(500).json({
      ok: false,
      error: 'Server error processing query',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// ── Helper: wrap engine call with error handling ──────────────────
function calc(fn) {
  return (req, res) => {
    try {
      const result = fn(req.body);
      if (result && result.error) {
        return res.status(422).json({ ok: false, error: result.error });
      }
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  };
}

// ── POST /api/size/gas ────────────────────────────────────────────
router.post('/gas', validate('gas'), calc(body => {
  const { P_set, OP=10, P_back_total=0, T_rel, W, MW, k,
          Z=0.95, Kd=0.975, valve_type='conventional', Kc=1.0, inlet_dP=0 } = body;
  const result = PSVApi.sizeGas({ P_set:+P_set, OP:+OP, P_back_total:+P_back_total,
    T_rel:+T_rel, W:+W, MW:+MW, k:+k, Z:+Z, Kd:+Kd, valve_type, Kc:+Kc, inlet_dP:+inlet_dP });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/steam ──────────────────────────────────────────
router.post('/steam', validate('steam'), calc(body => {
  const { P_set, OP=10, P_back_total=0, T_rel, W, Kd=0.975, valve_type='conventional', Kc=1.0 } = body;
  const result = PSVApi.sizeSteam({ P_set:+P_set, OP:+OP, P_back_total:+P_back_total,
    T_rel:+T_rel, W:+W, Kd:+Kd, valve_type, Kc:+Kc });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/liquid ─────────────────────────────────────────
router.post('/liquid', validate('liquid'), calc(body => {
  const { P_set, OP=10, P_back_total=0, W, rho_lbft3, visc_cp=1.0,
          Kd=0.65, valve_type='conventional', Kc=1.0 } = body;
  const result = PSVApi.sizeLiquid({ P_set:+P_set, OP:+OP, P_back_total:+P_back_total,
    W:+W, rho_lbft3:+rho_lbft3, visc_cp:+visc_cp, Kd:+Kd, valve_type, Kc:+Kc });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/twophase ───────────────────────────────────────
router.post('/twophase', validate('twophase'), calc(body => {
  const { P_set, OP=10, P_back_total=0, W, T_rel, quality_x, rho_g, rho_l,
          lambda_BTUperlb, Cp_liq, Kd=0.975, Kc=1.0 } = body;
  const result = PSVApi.sizeTwoPhase({ P_set:+P_set, OP:+OP, P_back_total:+P_back_total,
    W:+W, T_rel:+T_rel, quality_x:+quality_x, rho_g:+rho_g, rho_l:+rho_l,
    lambda_BTUperlb:+lambda_BTUperlb, Cp_liq:+Cp_liq, Kd:+Kd, Kc:+Kc });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/fire ───────────────────────────────────────────
router.post('/fire', validate('fire'), calc(body => {
  const { P_set, D_ft, L_ft, liquid_level_pct=60, orientation='vertical',
          F_factor=1.0, lambda_BTUperlb, T_rel, MW, k, Z=0.95 } = body;
  const result = PSVApi.sizeFireCase({ P_set:+P_set, D_ft:+D_ft, L_ft:+L_ft,
    liquid_level_pct:+liquid_level_pct, orientation, F_factor:+F_factor,
    lambda_BTUperlb:+lambda_BTUperlb, T_rel:+T_rel, MW:+MW, k:+k, Z:+Z });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/thermal ────────────────────────────────────────
router.post('/thermal', validate('thermal'), calc(body => {
  const { Q_BTUhr, beta, SG, Cp_BTUperlbF, P_set, P_back=0, Kd=0.65, Kc=1.0 } = body;
  const result = PSVApi.sizeThermal({ Q_BTUhr:+Q_BTUhr, beta:+beta, SG:+SG,
    Cp_BTUperlbF:+Cp_BTUperlbF, P_set:+P_set, P_back:+P_back, Kd:+Kd, Kc:+Kc });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/tuberupture ────────────────────────────────────
router.post('/tuberupture', validate('tuberupture'), calc(body => {
  const { OD_in, wall_t_in, n_tubes=1, Kd=0.61,
          P_HP, T_HP, MW_HP, k_HP, P_LP, T_LP, MW_LP, k_LP } = body;
  const result = PSVApi.sizeTubeRupture({ OD_in:+OD_in, wall_t_in:+wall_t_in,
    n_tubes:+n_tubes, Kd:+Kd, P_HP:+P_HP, T_HP:+T_HP, MW_HP:+MW_HP, k_HP:+k_HP,
    P_LP:+P_LP, T_LP:+T_LP, MW_LP:+MW_LP, k_LP:+k_LP });
  return { ...result, orifice: PSVApi.selectOrifice(result.A_in2) };
}));

// ── POST /api/size/blowdown ───────────────────────────────────────
router.post('/blowdown', calc(body => {
  const { V, P0g, Ptg, T0F, MW, k, Z=0.95, mode='o',
          A, Kd=0.61, Cv, vt='globe', Qf=0, td=0, MDMT=-20 } = body;
  return PSVApi.runBlowdown({ V:+V, P0g:+P0g, Ptg:+Ptg, T0F:+T0F, MW:+MW,
    k:+k, Z:+Z, mode, A:A?+A:undefined, Kd:+Kd,
    Cv:Cv?+Cv:undefined, vt, Qf:+Qf, td:+td, MDMT:+MDMT });
}));

// ── POST /api/size/blowdown/autosize ─────────────────────────────
router.post('/blowdown/autosize', calc(body => {
  const { V, P0g, Ptg, T0F, MW, k, Z=0.95, vt='globe', Qf=0 } = body;
  const Cv = PSVApi.sizeBlowdownValve({ V:+V, P0g:+P0g, Ptg:+Ptg, T0F:+T0F,
    MW:+MW, k:+k, Z:+Z, mode:'c', vt, Qf:+Qf });
  return { Cv, passes_15min: true };
}));

// ── POST /api/size/api2000 ────────────────────────────────────────
router.post('/api2000', calc(body => {
  const { capacity_bbl, flash_F=100, fill_gpm=0, pumpout_gpm=0 } = body;
  return PSVApi.calcAPI2000({ capacity_bbl:+capacity_bbl, flash_F:+flash_F,
    fill_gpm:+fill_gpm, pumpout_gpm:+pumpout_gpm });
}));

// ── POST /api/size/reaction ───────────────────────────────────────
router.post('/reaction', calc(body => {
  const { mode='open', W_lbhr, k, P1_psia, T_F, MW, A_in2, DLF=2.0 } = body;
  return PSVApi.calcReactionForce({ mode, W_lbhr:+W_lbhr, k:+k, P1_psia:+P1_psia,
    T_F:+T_F, MW:+MW, A_in2:+A_in2, DLF:+DLF });
}));

// ── GET /api/size/corrections ─────────────────────────────────────
router.get('/corrections', (req, res) => {
  const { P_set, P_back, valve_type='conventional', k=1.3 } = req.query;
  const Kb = PSVApi.getKb(+P_set, +P_back, valve_type, +k);
  const Ksh = req.query.P1 && req.query.T
    ? PSVApi.getKsh(+req.query.P1, +req.query.T) : undefined;
  res.json({ ok: true, result: { Kb, Ksh, Kn: req.query.P1 ? PSVApi.getKn(+req.query.P1) : undefined } });
});

// ── GET /api/size/eos ─────────────────────────────────────────────
router.get('/eos', (req, res) => {
  const { P, T, fluid } = req.query;
  if (!P || !T || !fluid) {
    return res.status(400).json({ ok: false, error: 'P, T, fluid required' });
  }
  const Z = PSVApi.getZ_PR(+P, +T, fluid);
  const near_crit = PSVApi.getZ_PR._near_crit_warn;
  res.json({ ok: true, result: { Z, near_crit_warn: near_crit } });
});

// ── GET /api/size/orifice ─────────────────────────────────────────
router.get('/orifice', (req, res) => {
  const { A } = req.query;
  if (!A) return res.status(400).json({ ok: false, error: 'A required' });
  res.json({ ok: true, result: PSVApi.selectOrifice(+A) });
});

// ── GET /api/size/validate ────────────────────────────────────────
router.get('/validate', (req, res) => {
  const suite = PSVApi.runValidationSuite();
  res.json({ ok: true, result: { pass: suite.pass, total: suite.total, fail: suite.fail } });
});

module.exports = router;
