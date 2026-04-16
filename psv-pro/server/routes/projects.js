'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ── Projects ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await db.initPromise;
    const list = db.projects.list().map(p => ({
      ...p, case_count: db.cases.count(p.id)
    }));
    res.json({ ok: true, result: list });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    await db.initPromise;
    const { name, plant='', unit='', engineer='', description='' } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    const p = db.projects.create({ id: db.newId(), name, plant, unit, engineer, description });
    res.status(201).json({ ok: true, result: p });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    await db.initPromise;
    const p = db.projects.get(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'Not found' });
    const caseList = db.cases.list(p.id);
    res.json({ ok: true, result: { ...p, cases: caseList } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    await db.initPromise;
    const p = db.projects.get(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'Not found' });
    const updated = db.projects.update(req.params.id, req.body);
    res.json({ ok: true, result: updated });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.initPromise;
    db.projects.delete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Cases ─────────────────────────────────────────────────────────
router.get('/:pid/cases', async (req, res) => {
  try {
    await db.initPromise;
    res.json({ ok: true, result: db.cases.list(req.params.pid) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/:pid/cases', async (req, res) => {
  try {
    await db.initPromise;
    const { tag='', service='', phase, scenario='', inputs, notes='' } = req.body;
    if (!phase || !inputs) return res.status(400).json({ ok: false, error: 'phase and inputs required' });
    const c = db.cases.create({
      id: db.newId(), project_id: req.params.pid,
      tag, service, phase, scenario, status: 'calculated',
      inputs: JSON.stringify(inputs), notes
    });
    res.status(201).json({ ok: true, result: { ...c, inputs: JSON.parse(c.inputs) } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:pid/cases/:cid', async (req, res) => {
  try {
    await db.initPromise;
    const c = db.cases.get(req.params.cid);
    if (!c) return res.status(404).json({ ok: false, error: 'Not found' });
    const revList = db.revisions.list(c.id);
    res.json({ ok: true, result: {
      ...c,
      inputs:    c.inputs  ? JSON.parse(c.inputs)  : null,
      results:   c.results ? JSON.parse(c.results) : null,
      revisions: revList.map(r => ({
        ...r,
        inputs:  r.inputs  ? JSON.parse(r.inputs)  : null,
        results: r.results ? JSON.parse(r.results) : null,
      }))
    }});
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/:pid/cases/:cid', async (req, res) => {
  try {
    await db.initPromise;
    const c = db.cases.get(req.params.cid);
    if (!c) return res.status(404).json({ ok: false, error: 'Not found' });
    const { inputs, results, changed_by='system', change_note='Update', ...rest } = req.body;
    // Auto-save revision when inputs change
    if (inputs && JSON.stringify(inputs) !== c.inputs) {
      const maxRev = db.revisions.maxRev(c.id);
      db.revisions.create({
        id: db.newId(), case_id: c.id, rev: maxRev + 1,
        inputs: c.inputs, results: c.results,
        changed_by, change_note,
      });
    }
    const updated = db.cases.update(req.params.cid, {
      ...rest,
      inputs:  inputs  ? JSON.stringify(inputs)  : c.inputs,
      results: results ? JSON.stringify(results) : c.results,
    });
    res.json({ ok: true, result: {
      ...updated,
      inputs:  updated.inputs  ? JSON.parse(updated.inputs)  : null,
      results: updated.results ? JSON.parse(updated.results) : null,
    }});
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/:pid/cases/:cid', async (req, res) => {
  try {
    await db.initPromise;
    db.cases.delete(req.params.cid);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
