'use strict';

const fs   = require('fs');
const path = require('path');

const CASES_PATH   = path.join(__dirname, '../../data/eval_cases.json');
const RESULTS_PATH = path.join(__dirname, '../../data/eval_results.json');
const AI_CHAT_URL  = 'http://localhost:3001/api/ai-chat';
const CASE_TIMEOUT = 35_000; // ms per case

// ── In-memory job state ────────────────────────────────────────────
let evalState = {
  running:     false,
  progress:    0,
  total:       0,
  currentCase: '',
  startedAt:   null,
  error:       null,
};

function getState() { return { ...evalState }; }

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
  const { expected }  = testCase;
  const {
    intent, tool_called, context_used,
    rag_sources, toolResult, reply,
  } = aiResponse;

  let score = 0, maxScore = 0;

  // 1. Intent (20 pts)
  const intentCorrect = intent === expected.intent;
  score += intentCorrect ? 20 : 0;
  maxScore += 20;

  // 2. Tool usage — only scored for calculation cases (30 pts)
  let toolCorrect = true;
  if (testCase.category === 'calculation') {
    toolCorrect = tool_called === expected.tool;
    score   += toolCorrect ? 30 : 0;
    maxScore += 30;
  }

  // 3. Key terms in response (30 pts)
  const replyLower = (reply || '').toLowerCase();
  const termsFound  = (expected.key_terms || []).filter(t =>
    replyLower.includes(t.toLowerCase())
  );
  const termRatio  = expected.key_terms?.length > 0
    ? termsFound.length / expected.key_terms.length
    : 1;
  const termScore  = termRatio * 30;
  score   += termScore;
  maxScore += 30;

  // 4. RAG context used — for knowledge + reasoning (20 pts)
  let ragCorrect = true;
  if (testCase.category !== 'calculation') {
    ragCorrect = context_used === true;
    score   += ragCorrect ? 20 : 0;
    maxScore += 20;
  }

  // 5. Numeric accuracy — when expected numeric_checks present (20 pts)
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
        const diffPct = Math.abs(actual - chk.value) / Math.abs(chk.value) * 100;
        if (diffPct <= tol) numericPassed++;
      }
    });
    score   += 20 * (numericTotal > 0 ? numericPassed / numericTotal : 1);
    maxScore += 20;
  }

  const finalScore = maxScore > 0 ? (score / maxScore) * 100 : 0;

  // ── Hallucination detection ──────────────────────────────────────
  let hallucinationFlag   = false;
  let hallucinationReason = null;

  if (testCase.category !== 'calculation') {
    if (!context_used && (reply || '').length > 200) {
      hallucinationFlag   = true;
      hallucinationReason = 'Answer not grounded in RAG context (context_used=false)';
    }
  }
  if (testCase.category === 'calculation' && tool_called && !toolCorrect) {
    hallucinationFlag   = true;
    hallucinationReason = `Wrong tool used: "${tool_called}" (expected "${expected.tool}")`;
  }

  // ── Confidence score (0-100) ─────────────────────────────────────
  // Weighted: intent(0.2), tool(0.3 if calc else 0), terms(0.3), rag(0.2 if non-calc)
  const confidence = Math.round(finalScore * 10) / 10;

  return {
    case_id:             testCase.id,
    category:            testCase.category,
    question:            testCase.question,
    answer:              reply || '',
    latency_ms:          latencyMs,
    intent_actual:       intent || null,
    intent_expected:     expected.intent,
    intent_correct:      intentCorrect,
    tool_called:         tool_called || null,
    tool_expected:       expected.tool || null,
    tool_correct:        toolCorrect,
    key_terms_expected:  expected.key_terms || [],
    key_terms_found:     termsFound,
    key_terms_missed:    (expected.key_terms || []).filter(t => !termsFound.includes(t)),
    key_term_score:      Math.round(termScore),
    context_used:        context_used || false,
    rag_sources:         rag_sources  || [],
    hallucination_flag:  hallucinationFlag,
    hallucination_reason:hallucinationReason,
    numeric_checks_passed: numericPassed,
    numeric_checks_total:  numericTotal,
    confidence,
    passed: finalScore >= 60,
    toolResult: toolResult || null,
  };
}

// ── Compute summary metrics across results ────────────────────────
function computeSummary(results) {
  const total        = results.length;
  const passed       = results.filter(r => r.passed).length;
  const avgLatency   = total > 0
    ? Math.round(results.reduce((s, r) => s + (r.latency_ms || 0), 0) / total)
    : 0;
  const avgScore     = total > 0
    ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / total * 10) / 10
    : 0;

  const calcCases    = results.filter(r => r.category === 'calculation');
  const toolAccPct   = calcCases.length > 0
    ? Math.round(calcCases.filter(r => r.tool_correct).length / calcCases.length * 100)
    : null;

  const ragCases     = results.filter(r => r.category !== 'calculation');
  const ragHitPct    = ragCases.length > 0
    ? Math.round(ragCases.filter(r => r.context_used).length / ragCases.length * 100)
    : null;

  const hallucFlags  = results.filter(r => r.hallucination_flag).length;

  const byCategory   = ['knowledge','calculation','reasoning'].map(cat => {
    const sub   = results.filter(r => r.category === cat);
    return {
      category: cat,
      total:    sub.length,
      passed:   sub.filter(r => r.passed).length,
      avg_score: sub.length > 0
        ? Math.round(sub.reduce((s, r) => s + r.confidence, 0) / sub.length * 10) / 10
        : 0,
    };
  });

  return {
    total_cases:        total,
    passed,
    failed:             total - passed,
    pass_rate_pct:      total > 0 ? Math.round(passed / total * 100) : 0,
    avg_latency_ms:     avgLatency,
    avg_score:          avgScore,
    tool_accuracy_pct:  toolAccPct,
    rag_hit_rate_pct:   ragHitPct,
    hallucination_flags:hallucFlags,
    by_category:        byCategory,
  };
}

// ── Run one test case via the AI agent HTTP API ────────────────────
async function runCase(testCase) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CASE_TIMEOUT);

  try {
    const res  = await fetch(AI_CHAT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: [{ role: 'user', content: testCase.question }] }),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    const latency = Date.now() - start;
    const data    = await res.json();

    if (!data.ok) throw new Error(data.error || 'Agent returned ok:false');
    return gradeResult(testCase, data, latency);

  } catch (err) {
    clearTimeout(timer);
    return {
      case_id:   testCase.id,
      category:  testCase.category,
      question:  testCase.question,
      answer:    '',
      latency_ms: Date.now() - start,
      error:     err.name === 'AbortError' ? 'Timeout (35s)' : err.message,
      intent_correct: false, tool_correct: false, key_term_score: 0,
      context_used: false, hallucination_flag: false, hallucination_reason: null,
      numeric_checks_passed: 0, numeric_checks_total: 0,
      confidence: 0, passed: false,
      key_terms_found: [], key_terms_missed: testCase.expected?.key_terms || [],
      rag_sources: [], toolResult: null,
    };
  }
}

// ── Main evaluation runner (async, non-blocking) ──────────────────
async function runEvaluation(caseIds = null) {
  if (evalState.running) throw new Error('Evaluation already in progress');

  const allCases = loadCases();
  const cases    = caseIds
    ? allCases.filter(c => caseIds.includes(c.id))
    : allCases;

  evalState = {
    running:     true,
    progress:    0,
    total:       cases.length,
    currentCase: '',
    startedAt:   new Date().toISOString(),
    error:       null,
  };

  const runId    = `run_${Date.now()}`;
  const results  = [];
  const startAt  = Date.now();

  for (const tc of cases) {
    evalState.currentCase = `[${tc.id}] ${tc.question.slice(0, 60)}…`;
    console.log(`[eval] Running ${tc.id}: ${tc.question.slice(0, 60)}`);

    const result = await runCase(tc);
    results.push(result);
    evalState.progress++;
  }

  const summary = computeSummary(results);
  const runData = {
    id:           runId,
    started_at:   evalState.startedAt,
    completed_at: new Date().toISOString(),
    duration_ms:  Date.now() - startAt,
    cases_run:    results.length,
    summary,
    results,
  };

  const stored = loadResults();
  stored.runs.unshift(runData);
  if (stored.runs.length > 10) stored.runs = stored.runs.slice(0, 10);
  saveResults(stored);

  evalState.running     = false;
  evalState.currentCase = '';
  console.log(`[eval] Completed run ${runId}: ${summary.passed}/${summary.total_cases} passed, avg score ${summary.avg_score}%`);
}

module.exports = {
  loadCases,
  loadResults,
  clearResults,
  runEvaluation,
  getState,
};
