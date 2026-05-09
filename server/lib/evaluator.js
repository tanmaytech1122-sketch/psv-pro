'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ─────────────────────────────────────────────────────────
const CASES_PATH   = path.join(__dirname, '../../data/eval_cases.json');
const RESULTS_PATH = path.join(__dirname, '../../data/eval_results.json');
const AI_CHAT_URL  = 'http://localhost:3001/api/ai-chat';

const CASE_TIMEOUT_MS      = 35_000;                                            // per-request HTTP timeout
const RATE_LIMIT_DELAY_MS  = parseInt(process.env.RATE_LIMIT_DELAY  || '13000'); // between cases
const BATCH_COOLDOWN_MS    = parseInt(process.env.BATCH_COOLDOWN    || '30000'); // between batches
const DEFAULT_BATCH_SIZE   = parseInt(process.env.EVAL_BATCH_SIZE   || '4');    // cases per batch
const MAX_RETRIES          = 3;

const ALLOWED_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];
const DEFAULT_MODEL = 'gemini-2.5-flash';

// ── In-memory job state ────────────────────────────────────────────
let evalState = {
  running:               false,
  progress:              0,
  total:                 0,
  currentCase:           '',
  startedAt:             null,
  error:                 null,
  phase:                 'idle',       // 'running' | 'cooldown' | 'retry' | 'idle'
  phase_detail:          '',
  batch_current:         0,
  batch_total:           0,
  batch_size:            DEFAULT_BATCH_SIZE,
  retry_attempt:         0,
  request_count:         0,
  cooldown_until:        null,         // ISO timestamp
  estimated_remaining_ms:0,
  model:                 DEFAULT_MODEL,
};

function getState() { return { ...evalState }; }

// ── Helpers ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) { console.log(`[eval] ${msg}`); }

function errorResult(testCase, latencyMs, errMsg) {
  return {
    case_id:    testCase.id,
    category:   testCase.category,
    question:   testCase.question,
    answer:     '',
    latency_ms: latencyMs,
    error:      errMsg,
    intent_correct:  false, tool_correct: false, key_term_score: 0,
    context_used:    false, hallucination_flag: false, hallucination_reason: null,
    numeric_checks_passed: 0, numeric_checks_total: 0,
    confidence:      0,     passed: false,
    key_terms_found: [],
    key_terms_missed: testCase.expected?.key_terms || [],
    rag_sources:     [],    toolResult: null,
    intent_actual:   null,  intent_expected: testCase.expected?.intent || null,
    tool_called:     null,  tool_expected:   testCase.expected?.tool   || null,
    key_terms_expected: testCase.expected?.key_terms || [],
  };
}

// ── Load / save ────────────────────────────────────────────────────
function loadCases() {
  return JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
}

function loadResults() {
  if (!fs.existsSync(RESULTS_PATH)) return { runs: [] };
  try { return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')); }
  catch { return { runs: [] }; }
}

function saveResults(data) {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(data, null, 2));
}

function clearResults() {
  if (fs.existsSync(RESULTS_PATH)) fs.unlinkSync(RESULTS_PATH);
}

// ── Grade a single test case result ───────────────────────────────
function gradeResult(testCase, aiResponse, latencyMs) {
  const { expected } = testCase;
  const { intent, tool_called, context_used, rag_sources, toolResult, reply } = aiResponse;

  let score = 0, maxScore = 0;

  // 1. Intent (20 pts)
  const intentCorrect = intent === expected.intent;
  score += intentCorrect ? 20 : 0;
  maxScore += 20;

  // 2. Tool usage — calculation cases only (30 pts)
  let toolCorrect = true;
  if (testCase.category === 'calculation') {
    toolCorrect = tool_called === expected.tool;
    score   += toolCorrect ? 30 : 0;
    maxScore += 30;
  }

  // 3. Key terms in response (30 pts)
  const replyLower  = (reply || '').toLowerCase();
  const termsFound  = (expected.key_terms || []).filter(t => replyLower.includes(t.toLowerCase()));
  const termRatio   = expected.key_terms?.length > 0 ? termsFound.length / expected.key_terms.length : 1;
  const termScore   = termRatio * 30;
  score   += termScore;
  maxScore += 30;

  // 4. RAG context used — knowledge + reasoning (20 pts)
  let ragCorrect = true;
  if (testCase.category !== 'calculation') {
    ragCorrect = context_used === true;
    score   += ragCorrect ? 20 : 0;
    maxScore += 20;
  }

  // 5. Numeric accuracy (20 pts when checks present)
  let numericPassed = 0;
  const numericTotal = (expected.numeric_checks || []).length;
  if (numericTotal > 0 && toolResult) {
    (expected.numeric_checks || []).forEach(chk => {
      const actual = toolResult[chk.field];
      if (actual == null) return;
      if (chk.exact) {
        if (String(actual) === String(chk.value)) numericPassed++;
      } else {
        const tol = chk.tolerance_pct || 5;
        if (Math.abs(actual - chk.value) / Math.abs(chk.value) * 100 <= tol) numericPassed++;
      }
    });
    score   += 20 * (numericTotal > 0 ? numericPassed / numericTotal : 1);
    maxScore += 20;
  }

  const finalScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const confidence = Math.round(finalScore * 10) / 10;

  // Hallucination detection
  let hallucinationFlag = false, hallucinationReason = null;
  if (testCase.category !== 'calculation' && !context_used && (reply || '').length > 200) {
    hallucinationFlag   = true;
    hallucinationReason = 'Answer not grounded in RAG context (context_used=false)';
  }
  if (testCase.category === 'calculation' && tool_called && !toolCorrect) {
    hallucinationFlag   = true;
    hallucinationReason = `Wrong tool used: "${tool_called}" (expected "${expected.tool}")`;
  }

  return {
    case_id:              testCase.id,
    category:             testCase.category,
    question:             testCase.question,
    answer:               reply || '',
    latency_ms:           latencyMs,
    intent_actual:        intent || null,
    intent_expected:      expected.intent,
    intent_correct:       intentCorrect,
    tool_called:          tool_called || null,
    tool_expected:        expected.tool || null,
    tool_correct:         toolCorrect,
    key_terms_expected:   expected.key_terms || [],
    key_terms_found:      termsFound,
    key_terms_missed:     (expected.key_terms || []).filter(t => !termsFound.includes(t)),
    key_term_score:       Math.round(termScore),
    context_used:         context_used || false,
    rag_sources:          rag_sources  || [],
    hallucination_flag:   hallucinationFlag,
    hallucination_reason: hallucinationReason,
    numeric_checks_passed:numericPassed,
    numeric_checks_total: numericTotal,
    confidence,
    passed: finalScore >= 60,
    toolResult: toolResult || null,
  };
}

// ── Compute summary metrics ────────────────────────────────────────
function computeSummary(results) {
  const total     = results.length;
  const passed    = results.filter(r => r.passed).length;
  const avgLatency = total > 0
    ? Math.round(results.reduce((s, r) => s + (r.latency_ms || 0), 0) / total) : 0;
  const avgScore  = total > 0
    ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / total * 10) / 10 : 0;

  const calcCases = results.filter(r => r.category === 'calculation');
  const toolAccPct = calcCases.length > 0
    ? Math.round(calcCases.filter(r => r.tool_correct).length / calcCases.length * 100) : null;

  const ragCases  = results.filter(r => r.category !== 'calculation');
  const ragHitPct = ragCases.length > 0
    ? Math.round(ragCases.filter(r => r.context_used).length / ragCases.length * 100) : null;

  const byCategory = ['knowledge','calculation','reasoning'].map(cat => {
    const sub = results.filter(r => r.category === cat);
    return {
      category:  cat,
      total:     sub.length,
      passed:    sub.filter(r => r.passed).length,
      avg_score: sub.length > 0
        ? Math.round(sub.reduce((s, r) => s + r.confidence, 0) / sub.length * 10) / 10 : 0,
    };
  });

  return {
    total_cases:         total,
    passed,
    failed:              total - passed,
    pass_rate_pct:       total > 0 ? Math.round(passed / total * 100) : 0,
    avg_latency_ms:      avgLatency,
    avg_score:           avgScore,
    tool_accuracy_pct:   toolAccPct,
    rag_hit_rate_pct:    ragHitPct,
    hallucination_flags: results.filter(r => r.hallucination_flag).length,
    by_category:         byCategory,
  };
}

// ── Run one case with automatic 429 retry ─────────────────────────
async function runCaseWithRetry(testCase, model, attempt = 1) {
  const start      = Date.now();
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), CASE_TIMEOUT_MS);

  try {
    const res = await fetch(AI_CHAT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messages: [{ role: 'user', content: testCase.question }],
        model,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    // ── 429 Rate limit hit ──────────────────────────────────────────
    if (res.status === 429) {
      const retryAfterS = parseInt(res.headers.get('Retry-After') || '60', 10);
      const waitMs      = retryAfterS * 1000;

      if (attempt > MAX_RETRIES) {
        log(`${testCase.id} — 429 exceeded max ${MAX_RETRIES} retries, recording failure`);
        return errorResult(testCase, Date.now() - start,
          `Rate limit exceeded — max retries (${MAX_RETRIES}) reached`);
      }

      log(`${testCase.id} — 429 rate limit · retry ${attempt}/${MAX_RETRIES} · waiting ${retryAfterS}s`);
      evalState.phase         = 'retry';
      evalState.retry_attempt = attempt;
      evalState.phase_detail  = `Rate limit hit — waiting ${retryAfterS}s before retry ${attempt}/${MAX_RETRIES}`;
      evalState.cooldown_until = new Date(Date.now() + waitMs).toISOString();

      await sleep(waitMs);

      evalState.phase          = 'running';
      evalState.retry_attempt  = 0;
      evalState.cooldown_until = null;
      evalState.request_count++;
      log(`${testCase.id} — retrying (attempt ${attempt + 1})`);
      return runCaseWithRetry(testCase, model, attempt + 1);
    }

    const latency = Date.now() - start;
    const data    = await res.json();

    if (!data.ok) {
      // Check if error body signals rate limit even on non-429 status
      const isRateErr = /rate|quota|429|RESOURCE_EXHAUSTED/i.test(data.error || '');
      if (isRateErr && attempt <= MAX_RETRIES) {
        const waitMs = 60_000;
        log(`${testCase.id} — rate limit in body · retry ${attempt}/${MAX_RETRIES} · waiting 60s`);
        evalState.phase          = 'retry';
        evalState.retry_attempt  = attempt;
        evalState.phase_detail   = `Rate limit (body) — waiting 60s before retry ${attempt}/${MAX_RETRIES}`;
        evalState.cooldown_until = new Date(Date.now() + waitMs).toISOString();
        await sleep(waitMs);
        evalState.phase          = 'running';
        evalState.retry_attempt  = 0;
        evalState.cooldown_until = null;
        evalState.request_count++;
        return runCaseWithRetry(testCase, model, attempt + 1);
      }
      throw new Error(data.error || 'Agent returned ok:false');
    }

    return gradeResult(testCase, data, latency);

  } catch (err) {
    clearTimeout(timer);
    const label = err.name === 'AbortError' ? 'Timeout (35s)' : err.message;
    return errorResult(testCase, Date.now() - start, label);
  }
}

// ── Update ETA estimate ────────────────────────────────────────────
function updateETA(startAt, progress, total, batchesDone, batchTotal, batchSize) {
  if (progress === 0) { evalState.estimated_remaining_ms = 0; return; }
  const elapsed     = Date.now() - startAt;
  const avgPerCase  = elapsed / progress;
  const casesLeft   = total - progress;
  // Estimate inter-case delays + inter-batch cooldowns remaining
  const batchesLeft = batchTotal - batchesDone;
  const delayLeft   = casesLeft > 0 ? (casesLeft - 1) * RATE_LIMIT_DELAY_MS : 0;
  const coolLeft    = batchesLeft > 0 ? batchesLeft * BATCH_COOLDOWN_MS : 0;
  evalState.estimated_remaining_ms = Math.round(casesLeft * avgPerCase + delayLeft + coolLeft);
}

// ── Main evaluation runner (async, non-blocking) ──────────────────
async function runEvaluation(opts = {}) {
  if (evalState.running) throw new Error('Evaluation already in progress');

  const {
    caseIds   = null,
    model     = DEFAULT_MODEL,
    batchSize = DEFAULT_BATCH_SIZE,
  } = opts;

  const safeModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;
  const allCases  = loadCases();
  const cases     = caseIds ? allCases.filter(c => caseIds.includes(c.id)) : allCases;

  // Split into batches
  const batches = [];
  for (let i = 0; i < cases.length; i += batchSize) {
    batches.push(cases.slice(i, i + batchSize));
  }

  evalState = {
    running:               true,
    progress:              0,
    total:                 cases.length,
    currentCase:           '',
    startedAt:             new Date().toISOString(),
    error:                 null,
    phase:                 'running',
    phase_detail:          'Starting evaluation…',
    batch_current:         0,
    batch_total:           batches.length,
    batch_size:            batchSize,
    retry_attempt:         0,
    request_count:         0,
    cooldown_until:        null,
    estimated_remaining_ms:0,
    model:                 safeModel,
  };

  log(`=== Evaluation started ===`);
  log(`Model: ${safeModel} | Cases: ${cases.length} | Batches: ${batches.length} (${batchSize}/batch)`);
  log(`Inter-case delay: ${RATE_LIMIT_DELAY_MS / 1000}s | Batch cooldown: ${BATCH_COOLDOWN_MS / 1000}s`);

  const runId   = `run_${Date.now()}`;
  const results = [];
  const startAt = Date.now();

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    evalState.batch_current = bi + 1;

    // Inter-batch cooldown (skip before first batch)
    if (bi > 0) {
      log(`--- Batch cooldown: ${BATCH_COOLDOWN_MS / 1000}s before batch ${bi + 1}/${batches.length} ---`);
      evalState.phase          = 'cooldown';
      evalState.cooldown_until = new Date(Date.now() + BATCH_COOLDOWN_MS).toISOString();
      evalState.phase_detail   = `Batch cooldown — ${BATCH_COOLDOWN_MS / 1000}s pause before batch ${bi + 1}/${batches.length}`;
      await sleep(BATCH_COOLDOWN_MS);
      evalState.phase          = 'running';
      evalState.cooldown_until = null;
      evalState.phase_detail   = '';
    }

    log(`=== Batch ${bi + 1}/${batches.length}: ${batch.map(c => c.id).join(', ')} ===`);

    for (let ci = 0; ci < batch.length; ci++) {
      const tc              = batch[ci];
      const globalCaseIndex = evalState.progress + 1;

      evalState.phase        = 'running';
      evalState.currentCase  = `[Batch ${bi + 1}/${batches.length} · Case ${globalCaseIndex}/${cases.length}] ${tc.id}: ${tc.question.slice(0, 50)}…`;
      evalState.phase_detail = `Running ${tc.id}`;
      evalState.request_count++;

      log(`Request #${evalState.request_count} · Batch ${bi + 1}/${batches.length} · ${tc.id}: ${tc.question.slice(0, 60)}`);

      const result = await runCaseWithRetry(tc, safeModel);
      results.push(result);
      evalState.progress++;

      log(`${tc.id} done — score: ${result.confidence}% | passed: ${result.passed} | latency: ${result.latency_ms}ms${result.error ? ' | ERROR: ' + result.error : ''}`);

      updateETA(startAt, evalState.progress, cases.length, bi + 1, batches.length, batchSize);

      // Inter-case delay (skip after last case overall)
      const isLastOverall = bi === batches.length - 1 && ci === batch.length - 1;
      if (!isLastOverall) {
        log(`Rate limit delay: ${RATE_LIMIT_DELAY_MS / 1000}s before next case`);
        evalState.phase          = 'cooldown';
        evalState.cooldown_until = new Date(Date.now() + RATE_LIMIT_DELAY_MS).toISOString();
        evalState.phase_detail   = `Rate limit pause — ${RATE_LIMIT_DELAY_MS / 1000}s between cases`;
        await sleep(RATE_LIMIT_DELAY_MS);
        evalState.cooldown_until = null;
        evalState.phase          = 'running';
        evalState.phase_detail   = '';
      }
    }
  }

  const summary = computeSummary(results);
  const runData = {
    id:           runId,
    started_at:   evalState.startedAt,
    completed_at: new Date().toISOString(),
    duration_ms:  Date.now() - startAt,
    cases_run:    results.length,
    model:        safeModel,
    batch_size:   batchSize,
    summary,
    results,
  };

  const stored = loadResults();
  stored.runs.unshift(runData);
  if (stored.runs.length > 10) stored.runs = stored.runs.slice(0, 10);
  saveResults(stored);

  evalState.running               = false;
  evalState.phase                 = 'idle';
  evalState.currentCase           = '';
  evalState.phase_detail          = '';
  evalState.estimated_remaining_ms = 0;

  log(`=== Completed run ${runId} ===`);
  log(`Results: ${summary.passed}/${summary.total_cases} passed | Avg score: ${summary.avg_score}% | Duration: ${Math.round((Date.now() - startAt) / 1000)}s | Requests: ${evalState.request_count}`);
}

module.exports = {
  loadCases,
  loadResults,
  clearResults,
  runEvaluation,
  getState,
  ALLOWED_MODELS,
  DEFAULT_MODEL,
};
