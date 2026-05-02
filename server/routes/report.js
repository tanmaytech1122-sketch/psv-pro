'use strict';

const express = require('express');
const router  = express.Router();
const { generateReport } = require('../lib/reportGenerator');

// ── POST /api/report ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Report data required' });
    }

    const buffer   = await generateReport(data);
    const filename = `PSV_Report_${(data.service || 'sizing').replace(/\s+/g, '_')}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('Report error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to generate report: ' + err.message });
  }
});

module.exports = router;
