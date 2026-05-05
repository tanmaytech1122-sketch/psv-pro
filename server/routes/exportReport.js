'use strict';

const express = require('express');
const router  = express.Router();

const { generateReport } = require('../lib/reportGenerator');

// POST /api/export-report  →  download PSV datasheet as .docx
router.post('/', async (req, res) => {
  try {
    const buf = await generateReport(req.body || {});
    const ts  = new Date().toISOString().slice(0, 10);
    const svc = (req.body?.service || 'PSV_Report').replace(/[^a-z0-9_-]/gi, '_');
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition',
      `attachment; filename="PSV_${svc}_${ts}.docx"`);
    return res.send(buf);
  } catch (err) {
    console.error('Export-report error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
