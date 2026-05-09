'use strict';

const express = require('express');
const router  = express.Router();
const {
  loadCases, loadResults, clearResults, runEvaluation, getState,
  ALLOWED_MODELS, DEFAULT_MODEL,
} = require('../lib/evaluator');

// GET /api/eval/cases
router.get('/cases', (req, res) => {
  try {
    const cases = loadCases();
    res.json({ ok: true, cases, total: cases.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/eval/models — list available models
router.get('/models', (req, res) => {
  res.json({
    ok:      true,
    models:  ALLOWED_MODELS,
    default: DEFAULT_MODEL,
  });
});

// POST /api/eval/run — start evaluation (non-blocking)
router.post('/run', (req, res) => {
  const { case_ids, model, batch_size } = req.body || {};
  const state = getState();

  if (state.running) {
    return res.status(409).json({ ok: false, error: 'Evaluation already running', state });
  }

  const allCases  = loadCases();
  const casesToRun = case_ids ? allCases.filter(c => case_ids.includes(c.id)) : allCases;
  const batchSize  = Math.min(Math.max(parseInt(batch_size, 10) || 4, 1), 13);
  const batchTotal = Math.ceil(casesToRun.length / batchSize);
  const safeModel  = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

  runEvaluation({ caseIds: case_ids || null, model: safeModel, batchSize }).catch(err => {
    console.error('[eval] Run failed:', err.message);
  });

  res.json({
    ok:          true,
    started:     true,
    total:       casesToRun.length,
    batch_size:  batchSize,
    batch_total: batchTotal,
    model:       safeModel,
    message:     `Evaluation started — ${casesToRun.length} cases in ${batchTotal} batch(es) using ${safeModel}`,
  });
});

// GET /api/eval/status
router.get('/status', (req, res) => {
  res.json({ ok: true, ...getState() });
});

// GET /api/eval/results
router.get('/results', (req, res) => {
  try {
    const data  = loadResults();
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({ ok: true, runs: data.runs.slice(0, limit), total: data.runs.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/eval/results
router.delete('/results', (req, res) => {
  try {
    clearResults();
    res.json({ ok: true, message: 'Results cleared' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/eval/summary — most recent run summary
router.get('/summary', (req, res) => {
  try {
    const data = loadResults();
    if (!data.runs.length) return res.json({ ok: true, summary: null, message: 'No runs yet' });
    const latest = data.runs[0];
    res.json({
      ok:          true,
      run_id:      latest.id,
      started_at:  latest.started_at,
      duration_ms: latest.duration_ms,
      model:       latest.model,
      summary:     latest.summary,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
