'use strict';

const fs   = require('fs');
const path = require('path');

const { buildDatasetFromText } = require('./datasetBuilder');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// ── Ensure uploads dir exists ─────────────────────────────────────
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Clean extracted PDF text ──────────────────────────────────────
function cleanText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')                    // form feed → newline
    .replace(/[^\x20-\x7E\n]/g, ' ')         // strip non-printable
    .replace(/[ \t]{2,}/g, ' ')              // collapse whitespace
    .replace(/\n{3,}/g, '\n\n')              // max 2 blank lines
    .trim();
}

// ── Detect topic/domain from text keywords ────────────────────────
function detectTopic(text) {
  const lower = text.toLowerCase();
  if (lower.includes('api 520') || lower.includes('api520'))      return 'API 520 - PSV Sizing';
  if (lower.includes('api 521') || lower.includes('api521'))      return 'API 521 - Relief Systems';
  if (lower.includes('api 526') || lower.includes('api526'))      return 'API 526 - Flanged Valves';
  if (lower.includes('api 2000') || lower.includes('api2000'))    return 'API 2000 - Tank Venting';
  if (lower.includes('pressure relief') || lower.includes('prv')) return 'Pressure Relief General';
  if (lower.includes('chattering'))                                return 'PSV Chattering';
  if (lower.includes('fire case') || lower.includes('external fire')) return 'Fire Case';
  return 'Engineering Reference';
}

// ── Main: process PDF buffer or path → structured dataset ─────────
async function processPdf(filePathOrBuffer, originalName = 'upload.pdf') {
  ensureUploadsDir();

  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    throw new Error('pdf-parse not installed. Run: npm install pdf-parse');
  }

  // Accept either a file path string or a Buffer
  const buffer = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : fs.readFileSync(filePathOrBuffer);

  console.log(`PDF: processing "${originalName}" (${(buffer.length / 1024).toFixed(1)} KB)`);

  // Extract text from PDF
  const pdfData  = await pdfParse(buffer);
  const rawText  = pdfData.text;
  const cleaned  = cleanText(rawText);
  const topic    = detectTopic(cleaned);
  const sourceName = path.basename(originalName, path.extname(originalName)).replace(/[^a-z0-9_-]/gi, '_');

  console.log(`PDF: extracted ${cleaned.split(/\s+/).length} words, topic: "${topic}"`);

  // Save cleaned text alongside uploads for reference
  const textPath = path.join(UPLOADS_DIR, `${sourceName}.txt`);
  fs.writeFileSync(textPath, cleaned);

  // Build dataset from extracted text
  const result = buildDatasetFromText(cleaned, sourceName);

  return {
    ok:           true,
    original_name: originalName,
    source:        sourceName,
    topic,
    pages:         pdfData.numpages,
    words:         cleaned.split(/\s+/).length,
    text_preview:  cleaned.substring(0, 500),
    dataset:       result,
    text_saved_to: textPath,
  };
}

// ── Process raw text (non-PDF) → dataset ─────────────────────────
function processText(text, sourceName = 'manual_input') {
  const cleaned = cleanText(text);
  const result  = buildDatasetFromText(cleaned, sourceName);
  return { ok: true, source: sourceName, words: cleaned.split(/\s+/).length, dataset: result };
}

module.exports = { processPdf, processText };
