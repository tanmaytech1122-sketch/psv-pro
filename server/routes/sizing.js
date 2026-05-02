'use strict';
const express = require('express');
const router = express.Router();
const PSVApi = require('../engines/psv-engine');
const { validate } = require('../middleware/validation');

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
