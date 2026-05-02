'use strict';

const fs   = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(__dirname, '../../knowledge');
const CHUNK_WORDS   = 350;
const OVERLAP_WORDS = 50;

let _chunks = null;

// ── Tokenise text into lowercase words ───────────────────────────
function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ── Build a word-frequency map ────────────────────────────────────
function termFreq(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

// ── Chunk a document into overlapping windows ─────────────────────
function chunkText(text, source) {
  const words   = text.split(/\s+/);
  const chunks  = [];
  const step    = CHUNK_WORDS - OVERLAP_WORDS;
  for (let i = 0; i < words.length; i += step) {
    const slice   = words.slice(i, i + CHUNK_WORDS).join(' ');
    const tokens  = tokenise(slice);
    chunks.push({ text: slice, source, tokens, tf: termFreq(tokens) });
    if (i + CHUNK_WORDS >= words.length) break;
  }
  return chunks;
}

// ── Load and chunk all knowledge documents ────────────────────────
function loadDocuments() {
  if (_chunks) return _chunks;
  _chunks = [];

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.warn('RAG: knowledge/ directory not found');
    return _chunks;
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
    const fileChunks = chunkText(content, file.replace('.md', ''));
    _chunks.push(...fileChunks);
  }

  console.log(`RAG: loaded ${_chunks.length} chunks from ${files.length} documents`);
  return _chunks;
}

// ── Compute IDF across all chunks ─────────────────────────────────
function buildIdf(chunks) {
  const df = {};
  for (const c of chunks) {
    for (const term of Object.keys(c.tf)) {
      df[term] = (df[term] || 0) + 1;
    }
  }
  const N   = chunks.length;
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log((N + 1) / (count + 1)) + 1;
  }
  return idf;
}

// ── Cosine similarity between two TF-IDF vectors ─────────────────
function cosineSim(qTokens, chunkTf, idf) {
  const qTf  = termFreq(qTokens);
  let dot = 0, qNorm = 0, cNorm = 0;

  const allTerms = new Set([...Object.keys(qTf), ...Object.keys(chunkTf)]);
  for (const term of allTerms) {
    const w_idf = idf[term] || 0;
    const qW    = (qTf[term]    || 0) * w_idf;
    const cW    = (chunkTf[term] || 0) * w_idf;
    dot   += qW * cW;
    qNorm += qW * qW;
    cNorm += cW * cW;
  }

  if (qNorm === 0 || cNorm === 0) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(cNorm));
}

// ── Public: retrieve top-k relevant chunks for a query ────────────
function retrieveRelevantChunks(query, topK = 3) {
  const chunks = loadDocuments();
  if (!chunks.length) return [];

  const idf     = buildIdf(chunks);
  const qTokens = tokenise(query);

  const scored = chunks.map(c => ({
    ...c,
    score: cosineSim(qTokens, c.tf, idf),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, topK)
    .filter(c => c.score > 0)
    .map(c => ({ source: c.source, text: c.text, score: c.score }));
}

module.exports = { loadDocuments, retrieveRelevantChunks };
