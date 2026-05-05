'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const { processPdf, processText }            = require('../lib/pdfProcessor');
const { getDatasetStats, getDataset }        = require('../lib/datasetBuilder');
const { prepareForTraining }                 = require('../lib/mockTraining');
const { generateReport }                     = require('../lib/reportGenerator');

// ── Multer: store uploads in /uploads/ dir ────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ts   = Date.now();
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_');
    cb(null, `${ts}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') return cb(null, true);
    cb(new Error('Only PDF files are accepted'));
  },
});

// ── POST /api/upload/pdf ──────────────────────────────────────────
// Upload a PDF → extract text → build dataset samples
router.post('/pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded. Field name must be "file".' });
  }

  console.log(`\n=== PDF Upload: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) ===`);

  try {
    const result = await processPdf(req.file.path, req.file.originalname);
    return res.json(result);
  } catch (err) {
    console.error('PDF processing error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/upload/text ─────────────────────────────────────────
// Submit raw text → build dataset samples
router.post('/text', express.json(), async (req, res) => {
  const { text, source } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.status(400).json({ ok: false, error: 'text field required (min 20 chars)' });
  }

  try {
    const result = processText(text, source || 'manual_input');
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/upload/dataset ───────────────────────────────────────
// Return dataset stats + preview
router.get('/dataset', (_req, res) => {
  try {
    const stats = getDatasetStats();
    return res.json({ ok: true, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/upload/dataset/download ─────────────────────────────
// Download full dataset as JSON
router.get('/dataset/download', (_req, res) => {
  try {
    const data = getDataset();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="psv_training_dataset.json"');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/upload/dataset/training-check ────────────────────────
// Run mock training readiness check
router.get('/dataset/training-check', (_req, res) => {
  try {
    const data   = getDataset();
    const result = prepareForTraining(data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/export-report ───────────────────────────────────────
// Alias: generate PSV datasheet as DOCX (same as /api/report)
router.post('/export-report', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const buf = await generateReport(req.body || {});
    const ts  = new Date().toISOString().slice(0, 10);
    const svc = (req.body?.service || 'PSV_Report').replace(/[^a-z0-9_-]/gi, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="PSV_${svc}_${ts}.docx"`);
    return res.send(buf);
  } catch (err) {
    console.error('Report export error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
