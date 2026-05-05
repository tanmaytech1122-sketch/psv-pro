'use strict';

// ── Mock Training Pipeline ────────────────────────────────────────
// Simulates a Qwen/LLM fine-tuning readiness check without real training.
// Returns structured metadata to validate the dataset before submission.

const TOKENS_PER_STEP     = 512;
const MIN_SAMPLES_READY   = 10;
const TARGET_MODEL        = 'Qwen2.5-7B-Instruct';

// ── Estimate training duration (rough, CPU-equivalent) ────────────
function estimateTrainingTime(samples, tokensTotal) {
  const steps   = Math.ceil(tokensTotal / TOKENS_PER_STEP);
  const minutes = Math.ceil(steps * 0.015); // ~15ms per step simulated
  return { steps, estimated_minutes: minutes };
}

// ── Validate individual sample quality ────────────────────────────
function validateSample(sample) {
  const issues = [];
  if (!sample.instruction && !sample.input)
    issues.push('missing instruction/input');
  if (!sample.response && !sample.output)
    issues.push('missing response/output');
  if ((sample.tokens_est || 0) < 10)
    issues.push('response too short (<10 tokens)');
  if ((sample.tokens_est || 0) > 2048)
    issues.push('response may exceed context window (>2048 tokens)');
  return issues;
}

// ── Format dataset for Qwen/Alpaca fine-tuning format ────────────
function formatForQwen(samples) {
  return samples.map(s => ({
    instruction: s.instruction || s.input || '',
    input:       '',
    output:      s.response    || s.output || '',
  }));
}

// ── Main: prepare dataset for training ────────────────────────────
function prepareForTraining(dataset) {
  const samples     = dataset.samples || [];
  const totalTokens = samples.reduce((sum, s) => sum + (s.tokens_est || 0), 0);
  const timing      = estimateTrainingTime(samples.length, totalTokens);

  // Validate all samples
  const validationResults = samples.map(s => ({
    id:     s.id,
    issues: validateSample(s),
  }));
  const invalidCount = validationResults.filter(r => r.issues.length > 0).length;
  const validCount   = samples.length - invalidCount;

  // Quality gates
  const issues = [];
  if (samples.length < MIN_SAMPLES_READY)
    issues.push(`Need at least ${MIN_SAMPLES_READY} samples (have ${samples.length})`);
  if (invalidCount > samples.length * 0.2)
    issues.push(`>20% samples failed validation (${invalidCount}/${samples.length})`);

  const ready         = issues.length === 0 && samples.length >= MIN_SAMPLES_READY;
  const qwenFormatted = formatForQwen(samples);

  console.log(`\n📊 Training Readiness Report`);
  console.log(`   Samples      : ${samples.length}`);
  console.log(`   Valid        : ${validCount} / ${samples.length}`);
  console.log(`   Tokens est.  : ${totalTokens.toLocaleString()}`);
  console.log(`   Training est.: ~${timing.estimated_minutes} min (simulated)`);
  console.log(`   Target model : ${TARGET_MODEL}`);
  console.log(`   Ready        : ${ready ? '✅' : '❌'}`);
  if (issues.length) issues.forEach(i => console.log(`   ⚠️  ${i}`));

  return {
    ok:                  true,
    ready,
    samples:             samples.length,
    valid_samples:       validCount,
    invalid_samples:     invalidCount,
    tokens_estimate:     totalTokens,
    training_steps:      timing.steps,
    estimated_minutes:   timing.estimated_minutes,
    target_model:        TARGET_MODEL,
    format:              'Alpaca (instruction / input / output)',
    issues,
    validation_details:  validationResults.filter(r => r.issues.length > 0).slice(0, 10),
    qwen_format_preview: qwenFormatted.slice(0, 2),
  };
}

module.exports = { prepareForTraining };
