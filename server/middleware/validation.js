'use strict';

/**
 * Validates incoming PSV sizing requests.
 * Returns 400 with structured error if validation fails.
 */

const REQUIRED = {
  gas:         ['P_set','T_rel','W','MW','k'],
  steam:       ['P_set','T_rel','W'],
  liquid:      ['P_set','W','rho_lbft3'],
  twophase:    ['P_set','W','T_rel','quality_x','rho_g','rho_l','lambda_BTUperlb','Cp_liq'],
  fire:        ['P_set','D_ft','L_ft','liquid_level_pct','lambda_BTUperlb','T_rel','MW','k'],
  blowdown:    ['V','P0g','Ptg','T0F','MW','k'],
  thermal:     ['Q_BTUhr','beta','SG','Cp_BTUperlbF','P_set'],
  tuberupture: ['OD_in','wall_t_in','n_tubes','P_HP','T_HP','MW_HP','k_HP','P_LP','T_LP','MW_LP','k_LP'],
};

const BOUNDS = {
  P_set:    [0,    25000,  'psia'],
  T_rel:    [-459, 3000,   '°F'],
  W:        [0,    1e9,    'lb/hr'],
  MW:       [1,    1000,   'lb/lb-mol'],
  k:        [1.0,  2.5,    'dimensionless'],
  Z:        [0.01, 3.0,    'dimensionless'],
  Kd:       [0.1,  1.0,    'dimensionless'],
  quality_x:[0,    1.0,    'dimensionless'],
  rho_g:    [0.001,500,    'lb/ft³'],
  rho_l:    [1,    1000,   'lb/ft³'],
  rho_lbft3:[1,    1000,   'lb/ft³'],
  lambda_BTUperlb:[1, 5000,'BTU/lb'],
  D_ft:     [0.1,  500,    'ft'],
  liquid_level_pct:[0, 100,'%'],
  V:        [0.1,  1e6,    'ft³'],
  P0g:      [0,    25000,  'psig'],
  Ptg:      [0,    25000,  'psig'],
};

function validate(phase) {
  return (req, res, next) => {
    const body = req.body;
    const errors = [];
    const required = REQUIRED[phase] || [];

    // Required fields
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        errors.push({ field: f, message: `${f} is required` });
      }
    }

    // Bounds checking
    for (const [field, [min, max, unit]] of Object.entries(BOUNDS)) {
      if (body[field] !== undefined && body[field] !== null) {
        const v = Number(body[field]);
        if (isNaN(v)) {
          errors.push({ field, message: `${field} must be a number` });
        } else if (v < min || v > max) {
          errors.push({ field, message: `${field} must be between ${min} and ${max} ${unit}` });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
}

module.exports = { validate };
