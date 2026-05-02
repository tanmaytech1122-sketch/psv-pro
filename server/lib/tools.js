'use strict';

const PSVApi = require('../engines/psv-engine');

// ── Unit helpers ──────────────────────────────────────────────────
const barg2psig  = b  => b * 14.5038;
const kgh2lbh    = k  => k * 2.20462;
const C2F        = c  => c * 9 / 5 + 32;
const kgm3_lbft3 = d  => d * 0.062428;
const psig2barg  = p  => p / 14.5038;
const lbh2kgh    = l  => l / 2.20462;
const F2C        = f  => (f - 32) * 5 / 9;
const in2_cm2    = a  => a * 6.4516;

// ── Gemini function declarations ──────────────────────────────────
const functionDeclarations = [
  {
    name: 'calculate_hydraulic_power',
    description: 'Calculate hydraulic power for a pump or pipeline flow system using P = ρgQH/1000.',
    parameters: {
      type: 'object',
      properties: {
        flow_m3hr:     { type: 'number', description: 'Volumetric flow rate in m³/h' },
        head_m:        { type: 'number', description: 'Total head in metres' },
        density_kgm3:  { type: 'number', description: 'Fluid density in kg/m³ (default 1000 for water)' },
      },
      required: ['flow_m3hr', 'head_m'],
    },
  },
  {
    name: 'size_psv_gas',
    description: 'Size a PSV for gas or vapour service using API 520 §3.6.',
    parameters: {
      type: 'object',
      properties: {
        P_set_barg:    { type: 'number', description: 'Set pressure in barg' },
        T_rel_C:       { type: 'number', description: 'Relieving temperature in °C' },
        W_kgh:         { type: 'number', description: 'Relief mass flow rate in kg/h' },
        MW:            { type: 'number', description: 'Molecular weight of gas (kg/kmol)' },
        k:             { type: 'number', description: 'Ratio of specific heats Cp/Cv (dimensionless)' },
        Z:             { type: 'number', description: 'Gas compressibility factor Z (default 0.95)' },
        overpressure_pct: { type: 'number', description: 'Overpressure percentage (default 10)' },
        P_back_barg:   { type: 'number', description: 'Back pressure in barg (default 0)' },
        valve_type:    { type: 'string', description: 'conventional, bellows, or pilot (default conventional)' },
      },
      required: ['P_set_barg', 'T_rel_C', 'W_kgh', 'MW', 'k'],
    },
  },
  {
    name: 'size_psv_steam',
    description: 'Size a PSV for steam service using API 520 §3.7 (Napier equation).',
    parameters: {
      type: 'object',
      properties: {
        P_set_barg:    { type: 'number', description: 'Set pressure in barg' },
        T_rel_C:       { type: 'number', description: 'Relieving temperature in °C (use saturation temp for saturated steam)' },
        W_kgh:         { type: 'number', description: 'Relief mass flow rate in kg/h' },
        overpressure_pct: { type: 'number', description: 'Overpressure percentage (default 10)' },
        P_back_barg:   { type: 'number', description: 'Back pressure in barg (default 0)' },
        valve_type:    { type: 'string', description: 'conventional, bellows, or pilot (default conventional)' },
      },
      required: ['P_set_barg', 'T_rel_C', 'W_kgh'],
    },
  },
  {
    name: 'size_psv_liquid',
    description: 'Size a PSV for liquid service using API 520 §3.8.',
    parameters: {
      type: 'object',
      properties: {
        P_set_barg:    { type: 'number', description: 'Set pressure in barg' },
        W_kgh:         { type: 'number', description: 'Relief mass flow rate in kg/h' },
        density_kgm3:  { type: 'number', description: 'Liquid density at relieving conditions in kg/m³' },
        viscosity_cp:  { type: 'number', description: 'Liquid viscosity in cP (default 1.0 for water-like liquids)' },
        overpressure_pct: { type: 'number', description: 'Overpressure percentage (default 10)' },
        P_back_barg:   { type: 'number', description: 'Back pressure in barg (default 0)' },
        valve_type:    { type: 'string', description: 'conventional, bellows, or pilot (default conventional)' },
      },
      required: ['P_set_barg', 'W_kgh', 'density_kgm3'],
    },
  },
  {
    name: 'size_psv_fire',
    description: 'Size a PSV for external fire case using API 521 §5.15.',
    parameters: {
      type: 'object',
      properties: {
        P_set_barg:        { type: 'number', description: 'Set pressure in barg' },
        vessel_diameter_m: { type: 'number', description: 'Vessel outer diameter in metres' },
        vessel_length_m:   { type: 'number', description: 'Vessel tangent-to-tangent length in metres' },
        liquid_level_pct:  { type: 'number', description: 'Liquid fill level as % of vessel height (default 60)' },
        orientation:       { type: 'string', description: 'vertical or horizontal (default vertical)' },
        F_factor:          { type: 'number', description: 'Environmental factor: 1.0 bare vessel, 0.3 insulated (default 1.0)' },
        latent_heat_kJkg:  { type: 'number', description: 'Latent heat of vaporisation in kJ/kg' },
        T_rel_C:           { type: 'number', description: 'Relieving temperature in °C' },
        MW:                { type: 'number', description: 'Molecular weight of vapour' },
        k:                 { type: 'number', description: 'Ratio of specific heats Cp/Cv' },
        Z:                 { type: 'number', description: 'Gas compressibility factor (default 0.95)' },
      },
      required: ['P_set_barg', 'vessel_diameter_m', 'vessel_length_m', 'latent_heat_kJkg', 'T_rel_C', 'MW', 'k'],
    },
  },
];

// ── Tool executors ────────────────────────────────────────────────
function calculate_hydraulic_power({ flow_m3hr, head_m, density_kgm3 = 1000 }) {
  const g       = 9.81;
  const Q_m3s   = flow_m3hr / 3600;
  const power_W = density_kgm3 * g * Q_m3s * head_m;
  const power_kW = power_W / 1000;
  const power_hp = power_kW * 1.341;

  return {
    power_kW:     +power_kW.toFixed(3),
    power_hp:     +power_hp.toFixed(3),
    flow_m3hr,
    head_m,
    density_kgm3,
    formula:      'P = ρ × g × Q × H / 1000',
    units:        { power: 'kW', flow: 'm³/h', head: 'm', density: 'kg/m³' },
  };
}

function size_psv_gas({ P_set_barg, T_rel_C, W_kgh, MW, k, Z = 0.95,
    overpressure_pct = 10, P_back_barg = 0, valve_type = 'conventional' }) {
  const inputs = {
    P_set:        barg2psig(P_set_barg),
    OP:           overpressure_pct,
    P_back_total: barg2psig(P_back_barg),
    T_rel:        C2F(T_rel_C),
    W:            kgh2lbh(W_kgh),
    MW, k, Z,
    Kd:           0.975,
    valve_type,
    Kc:           1.0,
    inlet_dP:     0,
  };
  const r      = PSVApi.sizeGas(inputs);
  const orifice = PSVApi.selectOrifice(r.A_in2);
  return {
    required_area_in2:   +r.A_in2.toFixed(4),
    required_area_cm2:   +(r.A_in2 * 6.4516).toFixed(3),
    relieving_pressure_barg: +psig2barg(r.P1_psia - 14.696).toFixed(2),
    flow_regime:         r.isCrit ? 'Critical (choked flow)' : 'Subcritical',
    Kb:                  +r.Kb.toFixed(3),
    orifice_designation: orifice?.d    || 'N/A',
    orifice_area_in2:    orifice?.a    || null,
    orifice_size:        orifice?.in_sz || null,
    utilisation_pct:     orifice?.cap_pct || null,
    inputs_used: { P_set_barg, T_rel_C, W_kgh, MW, k, Z, overpressure_pct, P_back_barg, valve_type },
  };
}

function size_psv_steam({ P_set_barg, T_rel_C, W_kgh,
    overpressure_pct = 10, P_back_barg = 0, valve_type = 'conventional' }) {
  const inputs = {
    P_set:        barg2psig(P_set_barg),
    OP:           overpressure_pct,
    P_back_total: barg2psig(P_back_barg),
    T_rel:        C2F(T_rel_C),
    W:            kgh2lbh(W_kgh),
    Kd:           0.975,
    valve_type,
    Kc:           1.0,
  };
  const r      = PSVApi.sizeSteam(inputs);
  const orifice = PSVApi.selectOrifice(r.A_in2);
  return {
    required_area_in2:   +r.A_in2.toFixed(4),
    required_area_cm2:   +(r.A_in2 * 6.4516).toFixed(3),
    relieving_pressure_barg: +psig2barg(r.P1_psia - 14.696).toFixed(2),
    Ksh:                 +r.Ksh.toFixed(4),
    orifice_designation: orifice?.d    || 'N/A',
    orifice_area_in2:    orifice?.a    || null,
    orifice_size:        orifice?.in_sz || null,
    utilisation_pct:     orifice?.cap_pct || null,
    inputs_used: { P_set_barg, T_rel_C, W_kgh, overpressure_pct, P_back_barg, valve_type },
  };
}

function size_psv_liquid({ P_set_barg, W_kgh, density_kgm3,
    viscosity_cp = 1.0, overpressure_pct = 10, P_back_barg = 0, valve_type = 'conventional' }) {
  const inputs = {
    P_set:        barg2psig(P_set_barg),
    OP:           overpressure_pct,
    P_back_total: barg2psig(P_back_barg),
    W:            kgh2lbh(W_kgh),
    rho_lbft3:    kgm3_lbft3(density_kgm3),
    visc_cp:      viscosity_cp,
    Kd:           0.65,
    valve_type,
    Kc:           1.0,
  };
  const r      = PSVApi.sizeLiquid(inputs);
  const orifice = PSVApi.selectOrifice(r.A_in2);
  return {
    required_area_in2:   +r.A_in2.toFixed(4),
    required_area_cm2:   +(r.A_in2 * 6.4516).toFixed(3),
    relieving_pressure_barg: +psig2barg(r.P1_psia - 14.696).toFixed(2),
    Kv:                  r.Kv != null ? +r.Kv.toFixed(4) : 1.0,
    orifice_designation: orifice?.d    || 'N/A',
    orifice_area_in2:    orifice?.a    || null,
    orifice_size:        orifice?.in_sz || null,
    utilisation_pct:     orifice?.cap_pct || null,
    inputs_used: { P_set_barg, W_kgh, density_kgm3, viscosity_cp, overpressure_pct, P_back_barg, valve_type },
  };
}

function size_psv_fire({ P_set_barg, vessel_diameter_m, vessel_length_m,
    liquid_level_pct = 60, orientation = 'vertical', F_factor = 1.0,
    latent_heat_kJkg, T_rel_C, MW, k, Z = 0.95 }) {
  const BTUperlb = latent_heat_kJkg * 0.429923;
  const D_ft     = vessel_diameter_m * 3.28084;
  const L_ft     = vessel_length_m   * 3.28084;
  const inputs   = {
    P_set:            barg2psig(P_set_barg),
    D_ft, L_ft,
    liquid_level_pct,
    orientation,
    F_factor,
    lambda_BTUperlb:  BTUperlb,
    T_rel:            C2F(T_rel_C),
    MW, k, Z,
  };
  const r      = PSVApi.sizeFireCase(inputs);
  const orifice = PSVApi.selectOrifice(r.A_in2);
  return {
    required_area_in2:   +r.A_in2.toFixed(4),
    required_area_cm2:   +(r.A_in2 * 6.4516).toFixed(3),
    heat_input_BTUhr:    r.Q_BTUhr != null ? +r.Q_BTUhr.toFixed(0) : null,
    heat_input_kW:       r.Q_BTUhr != null ? +(r.Q_BTUhr * 0.293071 / 1000).toFixed(1) : null,
    wetted_area_ft2:     r.Aw_ft2  != null ? +r.Aw_ft2.toFixed(1)  : null,
    relief_flow_kgh:     r.W_lbh   != null ? +lbh2kgh(r.W_lbh).toFixed(1) : null,
    relieving_pressure_barg: +psig2barg(r.P1_psia - 14.696).toFixed(2),
    orifice_designation: orifice?.d    || 'N/A',
    orifice_area_in2:    orifice?.a    || null,
    orifice_size:        orifice?.in_sz || null,
    utilisation_pct:     orifice?.cap_pct || null,
    inputs_used: { P_set_barg, vessel_diameter_m, vessel_length_m, F_factor, latent_heat_kJkg, T_rel_C, MW, k, Z },
  };
}

// ── Dispatcher ────────────────────────────────────────────────────
const EXECUTORS = {
  calculate_hydraulic_power,
  size_psv_gas,
  size_psv_steam,
  size_psv_liquid,
  size_psv_fire,
};

function executeTool(name, args) {
  const fn = EXECUTORS[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(args);
}

module.exports = { functionDeclarations, executeTool };
