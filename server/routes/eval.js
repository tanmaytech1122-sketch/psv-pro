'use strict';

const express = require('express');
const router  = express.Router();
const {
  loadCases, loadResults, clearResults, runEvaluation, getState,
} = require('../lib/evaluator');

// GET /api/eval/cases — list all test cases
router.get('/cases', (req, res) => {
  try {
    const cases = loadCases();
    res.json({ ok: true, cases, total: cases.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/eval/run — start evaluation (non-blocking)
router.post('/run', (req, res) => {
  const { case_ids } = req.body || {};
  const state = getState();

  if (state.running) {
    return res.status(409).json({ ok: false, error: 'Evaluation already running', state });
  }

  const cases = loadCases();
  const total = case_ids ? cases.filter(c => case_ids.includes(c.id)).length : cases.length;

  runEvaluation(case_ids || null).catch(err => {
    console.error('[eval] Run failed:', err.message);
  });

  res.json({ ok: true, started: true, total, message: 'Evaluation started' });
});

// GET /api/eval/status — current job status
router.get('/status', (req, res) => {
  res.json({ ok: true, ...getState() });
});

// GET /api/eval/results — all stored runs (most recent first)
router.get('/results', (req, res) => {
  try {
    const data  = loadResults();
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({
      ok:   true,
      runs: data.runs.slice(0, limit),
      total:data.runs.length,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/eval/results — clear all stored results
router.delete('/results', (req, res) => {
  try {
    clearResults();
    res.json({ ok: true, message: 'Results cleared' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/eval/summary — summary of most recent run
router.get('/summary', (req, res) => {
  try {
    const data = loadResults();
    if (!data.runs.length) {
      return res.json({ ok: true, summary: null, message: 'No runs yet' });
    }
    const latest = data.runs[0];
    res.json({
      ok:         true,
      run_id:     latest.id,
      started_at: latest.started_at,
      duration_ms:latest.duration_ms,
      summary:    latest.summary,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
