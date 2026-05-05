'use strict';

const fs   = require('fs');
const path = require('path');

const DATASET_PATH = path.join(__dirname, '../../dataset/training_data.json');
const CHUNK_WORDS  = 200;

// ── Ensure dataset directory and file exist ───────────────────────
function ensureDatasetFile() {
  const dir = path.dirname(DATASET_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATASET_PATH)) {
    fs.writeFileSync(DATASET_PATH, JSON.stringify({
      samples: [],
      meta: { version: '1.0', created: new Date().toISOString(), description: 'PSV Engineering training dataset' },
    }, null, 2));
  }
}

// ── Estimate token count (rough: 1 token ≈ 4 chars) ──────────────
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ── Chunk plain text into overlapping word windows ────────────────
function chunkText(text, chunkSize = CHUNK_WORDS) {
  const sentences = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);

  const chunks = [];
  let current  = [];
  let wordCount = 0;

  for (const sent of sentences) {
    const words = sent.split(/\s+/).length;
    current.push(sent);
    wordCount += words;
    if (wordCount >= chunkSize) {
      chunks.push(current.join(' '));
      current   = [];
      wordCount = 0;
    }
  }
  if (current.length) chunks.push(current.join(' '));

  return chunks;
}

// ── Infer a Q&A pair from a text chunk ───────────────────────────
function inferQA(chunk, sourceName, index) {
  const lower = chunk.toLowerCase();

  // Generate a meaningful instruction based on content keywords
  let instruction = `Explain the following engineering concept from ${sourceName}`;
  if (lower.includes('api 520') || lower.includes('api520'))
    instruction = 'Explain this API 520 concept in the context of PSV sizing';
  else if (lower.includes('api 521') || lower.includes('api521'))
    instruction = 'Describe this API 521 relief scenario and its engineering significance';
  else if (lower.includes('chattering') || lower.includes('flutter'))
    instruction = 'What causes PSV chattering and how can it be prevented?';
  else if (lower.includes('orifice') || lower.includes('area'))
    instruction = 'Describe the orifice selection method and the relevant formula';
  else if (lower.includes('set pressure') || lower.includes('relieving pressure'))
    instruction = 'Explain the relationship between set pressure and relieving pressure for a PSV';
  else if (lower.includes('fire') || lower.includes('wetted'))
    instruction = 'Describe the fire case scenario and how to calculate the relief requirement';
  else if (lower.includes('liquid') || lower.includes('liquid service'))
    instruction = 'Explain PSV sizing for liquid service per API 520';
  else if (lower.includes('steam'))
    instruction = 'Explain PSV sizing for steam service per API 520';
  else if (lower.includes('back pressure') || lower.includes('backpressure'))
    instruction = 'What is back pressure and how does it affect PSV sizing?';

  return {
    id:          `${sourceName}-${index + 1}`,
    source:      sourceName,
    instruction,
    response:    chunk.trim(),
    input:       instruction,
    output:      chunk.trim(),
    tokens_est:  estimateTokens(chunk),
    created_at:  new Date().toISOString(),
  };
}

// ── Main: build dataset from raw text ─────────────────────────────
function buildDatasetFromText(text, sourceName = 'unknown') {
  ensureDatasetFile();

  const chunks  = chunkText(text);
  const samples = chunks.map((chunk, i) => inferQA(chunk, sourceName, i));

  // Load existing dataset
  const existing    = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const existingIds = new Set(existing.samples.map(s => s.id));

  // Append only new samples (avoid duplicates by id prefix match)
  const newSamples = samples.filter(s => !existingIds.has(s.id));
  existing.samples.push(...newSamples);
  existing.meta.last_updated = new Date().toISOString();
  existing.meta.total         = existing.samples.length;

  fs.writeFileSync(DATASET_PATH, JSON.stringify(existing, null, 2));

  const totalTokens = newSamples.reduce((sum, s) => sum + s.tokens_est, 0);
  console.log(`Dataset: +${newSamples.length} samples from "${sourceName}" (~${totalTokens} tokens)`);

  return {
    ok:           true,
    source:       sourceName,
    new_samples:  newSamples.length,
    total:        existing.samples.length,
    tokens_added: totalTokens,
    samples:      newSamples,
  };
}

// ── Get current dataset stats ──────────────────────────────────────
function getDatasetStats() {
  ensureDatasetFile();
  const data = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const totalTokens = data.samples.reduce((sum, s) => sum + (s.tokens_est || 0), 0);
  return {
    total:         data.samples.length,
    tokens_total:  totalTokens,
    sources:       [...new Set(data.samples.map(s => s.source))],
    meta:          data.meta,
    preview:       data.samples.slice(0, 3),
  };
}

// ── Get full dataset (for download / training export) ─────────────
function getDataset() {
  ensureDatasetFile();
  return JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
}

module.exports = { buildDatasetFromText, getDatasetStats, getDataset };
