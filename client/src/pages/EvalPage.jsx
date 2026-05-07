import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, Play, Trash2, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, Zap, BookOpen,
  Wrench, TrendingUp, BarChart3, Target, Brain, ShieldAlert,
  Activity, Loader2, Info,
} from 'lucide-react'

// ── API helpers ───────────────────────────────────────────────────
const api = {
  cases:   () => axios.get('/api/eval/cases').then(r => r.data),
  status:  () => axios.get('/api/eval/status').then(r => r.data),
  results: () => axios.get('/api/eval/results').then(r => r.data),
  run:     (caseIds) => axios.post('/api/eval/run', { case_ids: caseIds || null }).then(r => r.data),
  clear:   () => axios.delete('/api/eval/results').then(r => r.data),
}

// ── Category config ────────────────────────────────────────────────
const CAT = {
  knowledge:   { label: 'Knowledge', color: 'purple', icon: BookOpen },
  calculation: { label: 'Calculation', color: 'blue',   icon: Wrench },
  reasoning:   { label: 'Reasoning',   color: 'amber',  icon: Brain },
}

const CAT_COLORS = {
  knowledge:   'bg-purple-500/10 text-purple-300 border-purple-500/20',
  calculation: 'bg-blue-500/10   text-blue-300   border-blue-500/20',
  reasoning:   'bg-amber-500/10  text-amber-300  border-amber-500/20',
}

// ── Metric card ────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, unit, sub, color, loading }) {
  const colors = {
    green:  'text-green-400  bg-green-500/8   border-green-500/20',
    blue:   'text-blue-400   bg-blue-500/8    border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/8  border-purple-500/20',
    amber:  'text-amber-400  bg-amber-500/8   border-amber-500/20',
    red:    'text-red-400    bg-red-500/8     border-red-500/20',
    slate:  'text-slate-400  bg-slate-500/8   border-slate-500/20',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.slate}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`p-1.5 rounded-lg bg-current/10`}>
          <Icon size={14} className="opacity-80"/>
        </div>
        {loading && <Loader2 size={12} className="animate-spin opacity-50 mt-0.5"/>}
      </div>
      <div className="mt-1">
        <div className="text-2xl font-bold font-mono leading-none">
          {loading ? '—' : (value ?? '—')}
          {!loading && unit && <span className="text-sm font-normal ml-1 opacity-70">{unit}</span>}
        </div>
        <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
        {sub && <div className="text-2xs opacity-50 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────
function ProgressBar({ progress, total, currentCase }) {
  const pct = total > 0 ? Math.round(progress / total * 100) : 0
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="text-blue-400 animate-spin"/>
          <span className="text-sm font-medium text-blue-300">Running evaluation…</span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{progress} / {total}</span>
      </div>
      <div className="h-2 bg-white/8 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {currentCase && (
        <div className="text-2xs text-slate-500 truncate">{currentCase}</div>
      )}
    </div>
  )
}

// ── Score pill ─────────────────────────────────────────────────────
function ScorePill({ score, size = 'sm' }) {
  const color = score >= 80 ? 'text-green-400 bg-green-500/15 border-green-500/25'
              : score >= 60 ? 'text-amber-400 bg-amber-500/15 border-amber-500/25'
              :               'text-red-400   bg-red-500/15   border-red-500/25'
  const cls = size === 'lg'
    ? `text-base font-bold px-3 py-1 rounded-lg border ${color}`
    : `text-2xs font-bold px-2 py-0.5 rounded border ${color}`
  return <span className={cls}>{score != null ? `${score}%` : '—'}</span>
}

// ── Key terms display ──────────────────────────────────────────────
function KeyTerms({ found, missed }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {found.map(t => (
        <span key={t} className="text-2xs px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-300">{t}</span>
      ))}
      {missed.map(t => (
        <span key={t} className="text-2xs px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 line-through">{t}</span>
      ))}
    </div>
  )
}

// ── Expanded result row ────────────────────────────────────────────
function ExpandedResult({ result }) {
  return (
    <div className="px-4 pb-4 pt-2 bg-surface-3/40 border-t border-border-subtle space-y-3">
      {/* Answer */}
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500 mb-1">AI Response</p>
        <div className="text-xs text-slate-300 bg-surface-3 rounded-lg p-3 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-border-subtle">
          {result.answer || <span className="text-red-400 italic">{result.error || 'No answer'}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Left: Metrics */}
        <div className="space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">Metrics</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Intent</span>
              <span className={result.intent_correct ? 'text-green-400' : 'text-red-400'}>
                {result.intent_actual || '—'} {result.intent_correct ? '✓' : `✗ (expected ${result.intent_expected})`}
              </span>
            </div>
            {result.tool_expected && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tool called</span>
                <span className={result.tool_correct ? 'text-green-400' : 'text-red-400'}>
                  {result.tool_called || 'none'} {result.tool_correct ? '✓' : `✗ (expected ${result.tool_expected})`}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">RAG context</span>
              <span className={result.context_used ? 'text-green-400' : 'text-slate-500'}>
                {result.context_used ? 'Used ✓' : 'Not used'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Latency</span>
              <span className="text-slate-300 font-mono">{(result.latency_ms / 1000).toFixed(2)}s</span>
            </div>
            {result.numeric_checks_total > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Numeric checks</span>
                <span className={result.numeric_checks_passed === result.numeric_checks_total ? 'text-green-400' : 'text-amber-400'}>
                  {result.numeric_checks_passed}/{result.numeric_checks_total} passed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Key terms */}
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Key Terms ({result.key_terms_found?.length}/{(result.key_terms_found?.length||0) + (result.key_terms_missed?.length||0)})
          </p>
          <KeyTerms found={result.key_terms_found || []} missed={result.key_terms_missed || []}/>
        </div>
      </div>

      {/* Hallucination warning */}
      {result.hallucination_flag && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <ShieldAlert size={13} className="text-amber-400 mt-0.5 shrink-0"/>
          <div>
            <p className="text-xs font-semibold text-amber-300">Hallucination Warning</p>
            <p className="text-2xs text-amber-400/80 mt-0.5">{result.hallucination_reason}</p>
          </div>
        </div>
      )}

      {/* RAG sources */}
      {result.rag_sources?.length > 0 && (
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500 mb-1">RAG Sources</p>
          <div className="flex flex-wrap gap-1">
            {[...new Set(result.rag_sources.map(s => typeof s === 'string' ? s : s?.source || '').filter(Boolean))].map(src => (
              <span key={src} className="text-2xs px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-300">{src}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Result row ─────────────────────────────────────────────────────
function ResultRow({ result, index }) {
  const [expanded, setExpanded] = useState(false)
  const catCfg = CAT[result.category] || CAT.knowledge

  const statusIcon = result.error
    ? <XCircle size={13} className="text-slate-500"/>
    : result.passed
    ? <CheckCircle2 size={13} className="text-green-400"/>
    : <XCircle size={13} className="text-red-400"/>

  return (
    <div className={`border-b border-border-subtle last:border-0 ${index % 2 === 0 ? '' : 'bg-surface-3/20'}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 hover:bg-surface-3/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Status */}
          <div className="mt-0.5 shrink-0">{statusIcon}</div>

          {/* ID + Category */}
          <div className="shrink-0 w-16">
            <div className="text-2xs font-mono text-slate-300 font-semibold">{result.case_id}</div>
            <span className={`text-2xs px-1.5 py-0.5 rounded border ${CAT_COLORS[result.category]} mt-0.5 inline-block`}>
              {catCfg.label}
            </span>
          </div>

          {/* Question */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-200 leading-tight line-clamp-2">{result.question}</p>
            {result.tool_called && (
              <span className="text-2xs text-blue-400 font-mono mt-0.5 inline-block">
                ⚙ {result.tool_called}
              </span>
            )}
          </div>

          {/* Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center hidden sm:block">
              <div className="text-2xs text-slate-500">Latency</div>
              <div className="text-xs font-mono text-slate-300">{(result.latency_ms/1000).toFixed(1)}s</div>
            </div>
            <div className="text-center">
              <div className="text-2xs text-slate-500">Score</div>
              <ScorePill score={result.confidence}/>
            </div>
            {result.hallucination_flag && (
              <ShieldAlert size={13} className="text-amber-400" title="Hallucination warning"/>
            )}
            {expanded
              ? <ChevronDown size={13} className="text-slate-500"/>
              : <ChevronRight size={13} className="text-slate-500"/>
            }
          </div>
        </div>
      </button>

      {expanded && <ExpandedResult result={result}/>}
    </div>
  )
}

// ── Category summary bar ───────────────────────────────────────────
function CategoryBar({ byCategory }) {
  if (!byCategory) return null
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {byCategory.map(cat => {
        const cfg = CAT[cat.category] || CAT.knowledge
        const Icon = cfg.icon
        return (
          <div key={cat.category} className="bg-surface-3 border border-border-subtle rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={12} className="text-slate-400"/>
              <span className="text-2xs font-semibold text-slate-300 uppercase tracking-wide">{cfg.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-slate-100">{cat.passed}/{cat.total}</div>
                <div className="text-2xs text-slate-500">passed</div>
              </div>
              <ScorePill score={cat.avg_score}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────
function EmptyState({ onRun, loading }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
        <FlaskConical size={28} className="text-purple-400"/>
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-1">No evaluations run yet</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        Run the benchmark to evaluate the AI agent across 13 test cases covering
        knowledge, calculation accuracy, and reasoning quality.
      </p>
      <button onClick={onRun} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500
                   disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors">
        {loading ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>}
        Run Benchmark
      </button>
    </div>
  )
}

// ── Main EvalPage ──────────────────────────────────────────────────
export default function EvalPage() {
  const qc        = useQueryClient()
  const [filter, setFilter] = useState('all')
  const pollingRef = useRef(null)

  // Fetch cases metadata
  const { data: casesData } = useQuery({
    queryKey: ['eval-cases'],
    queryFn:  api.cases,
    staleTime: Infinity,
  })

  // Fetch evaluation results
  const { data: resultsData, refetch: refetchResults } = useQuery({
    queryKey: ['eval-results'],
    queryFn:  api.results,
    staleTime: 0,
  })

  // Poll status while running
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['eval-status'],
    queryFn:  api.status,
    refetchInterval: (data) => data?.running ? 2000 : false,
    staleTime: 0,
  })

  // Watch for run completion
  useEffect(() => {
    if (statusData && !statusData.running && statusData.progress > 0) {
      refetchResults()
      qc.invalidateQueries(['eval-results'])
    }
  }, [statusData?.running])

  // Run mutation
  const runMutation = useMutation({
    mutationFn: (caseIds) => api.run(caseIds),
    onSuccess: () => {
      // Start polling status
      qc.invalidateQueries(['eval-status'])
    },
    onError: (err) => {
      console.error('Run failed:', err)
    },
  })

  // Clear mutation
  const clearMutation = useMutation({
    mutationFn: api.clear,
    onSuccess: () => {
      qc.invalidateQueries(['eval-results'])
      refetchResults()
    },
  })

  const isRunning  = statusData?.running === true
  const latestRun  = resultsData?.runs?.[0]
  const summary    = latestRun?.summary
  const results    = latestRun?.results || []

  // Filter results
  const filtered = filter === 'all'
    ? results
    : results.filter(r => r.category === filter)

  // Summary color
  const scoreColor = !summary ? 'slate'
    : summary.avg_score >= 80 ? 'green'
    : summary.avg_score >= 60 ? 'amber'
    : 'red'

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/15 rounded-xl border border-purple-500/20">
              <FlaskConical size={18} className="text-purple-400"/>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">AI Evaluation Dashboard</h1>
              <p className="text-2xs text-slate-500">
                Gemini 2.5 Flash · {casesData?.total || 13} test cases ·
                {latestRun && (
                  <span className="ml-1">Last run: {new Date(latestRun.started_at).toLocaleString()}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latestRun && (
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending || isRunning}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-slate-500 hover:text-red-400
                           hover:bg-red-500/10 border border-border-subtle hover:border-red-500/20
                           rounded-lg transition-all disabled:opacity-40"
              >
                <Trash2 size={12}/>
                Clear
              </button>
            )}
            <button
              onClick={() => runMutation.mutate(null)}
              disabled={isRunning || runMutation.isPending}
              className="flex items-center gap-2 text-xs px-4 py-2 bg-purple-600 hover:bg-purple-500
                         disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
            >
              {isRunning || runMutation.isPending
                ? <><Loader2 size={13} className="animate-spin"/> Running…</>
                : <><Play size={13}/> Run Benchmark</>
              }
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <ProgressBar
            progress={statusData.progress}
            total={statusData.total}
            currentCase={statusData.currentCase}
          />
        )}

        {/* Summary metrics */}
        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                icon={Target}
                label="Overall Score"
                value={summary.avg_score}
                unit="%"
                sub={`${summary.passed}/${summary.total_cases} passed`}
                color={scoreColor}
              />
              <MetricCard
                icon={Clock}
                label="Avg Latency"
                value={(summary.avg_latency_ms / 1000).toFixed(2)}
                unit="s"
                sub="per question"
                color="blue"
              />
              <MetricCard
                icon={Zap}
                label="Tool Accuracy"
                value={summary.tool_accuracy_pct ?? '—'}
                unit={summary.tool_accuracy_pct != null ? '%' : ''}
                sub="calculation cases"
                color={summary.tool_accuracy_pct >= 80 ? 'green' : 'amber'}
              />
              <MetricCard
                icon={BookOpen}
                label="RAG Hit Rate"
                value={summary.rag_hit_rate_pct ?? '—'}
                unit={summary.rag_hit_rate_pct != null ? '%' : ''}
                sub="context retrieved"
                color={summary.rag_hit_rate_pct >= 80 ? 'green' : 'amber'}
              />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex items-center gap-3">
                <div className="p-1.5 bg-green-500/10 rounded-lg">
                  <CheckCircle2 size={14} className="text-green-400"/>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{summary.passed}</div>
                  <div className="text-2xs text-slate-500">Cases passed</div>
                </div>
              </div>
              <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex items-center gap-3">
                <div className="p-1.5 bg-red-500/10 rounded-lg">
                  <XCircle size={14} className="text-red-400"/>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{summary.failed}</div>
                  <div className="text-2xs text-slate-500">Cases failed</div>
                </div>
              </div>
              <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex items-center gap-3">
                <div className="p-1.5 bg-amber-500/10 rounded-lg">
                  <ShieldAlert size={14} className="text-amber-400"/>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-400">{summary.hallucination_flags}</div>
                  <div className="text-2xs text-slate-500">Hallucination flags</div>
                </div>
              </div>
            </div>

            {/* By category */}
            <CategoryBar byCategory={summary.by_category}/>
          </>
        )}

        {/* Results table */}
        {results.length > 0 ? (
          <div className="bg-surface-2 border border-border-subtle rounded-xl overflow-hidden">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-4 py-3 border-b border-border-subtle bg-surface-1/40">
              <span className="text-2xs text-slate-500 font-semibold uppercase tracking-wide mr-2">Filter:</span>
              {['all', 'knowledge', 'calculation', 'reasoning'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-2xs px-2.5 py-1 rounded-md border transition-all capitalize font-medium
                    ${filter === f
                      ? 'bg-slate-600/60 border-slate-500/50 text-slate-200'
                      : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-border-subtle'
                    }`}>
                  {f === 'all' ? `All (${results.length})` : `${f} (${results.filter(r => r.category === f).length})`}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 text-2xs text-slate-600">
                <Info size={10}/>
                <span>Click row to expand</span>
              </div>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1.5rem_5rem_1fr_6rem_5rem] gap-3 px-4 py-2 border-b border-border-subtle bg-surface-3/30">
              <div/>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500">ID / Type</div>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500">Question</div>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500 text-right">Latency</div>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500 text-right">Score</div>
            </div>

            {/* Result rows */}
            <div>
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No results for this filter</div>
              ) : (
                filtered.map((result, i) => (
                  <ResultRow key={result.case_id} result={result} index={i}/>
                ))
              )}
            </div>
          </div>
        ) : !isRunning && (
          <div className="bg-surface-2 border border-border-subtle rounded-xl">
            <EmptyState
              onRun={() => runMutation.mutate(null)}
              loading={runMutation.isPending}
            />
          </div>
        )}

        {/* Previous runs */}
        {resultsData?.runs?.length > 1 && (
          <div className="bg-surface-2 border border-border-subtle rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Previous Runs</h3>
            <div className="space-y-2">
              {resultsData.runs.slice(1).map(run => (
                <div key={run.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                  <div>
                    <div className="text-xs text-slate-300">{new Date(run.started_at).toLocaleString()}</div>
                    <div className="text-2xs text-slate-500">{run.cases_run} cases · {(run.duration_ms/1000).toFixed(0)}s duration</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xs text-slate-500">{run.summary?.passed}/{run.summary?.total_cases} passed</span>
                    <ScorePill score={run.summary?.avg_score}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-surface-2 border border-border-subtle rounded-xl p-4">
          <div className="flex items-start gap-2.5">
            <Info size={13} className="text-slate-500 mt-0.5 shrink-0"/>
            <div className="text-2xs text-slate-500 space-y-0.5">
              <p><span className="text-slate-400 font-semibold">Scoring:</span> Intent (20 pts) + Tool accuracy (30 pts, calculation only) + Key terms (30 pts) + RAG usage (20 pts, knowledge/reasoning) + Numeric accuracy (20 pts, when applicable).</p>
              <p><span className="text-slate-400 font-semibold">Pass threshold:</span> ≥ 60% confidence score.</p>
              <p><span className="text-slate-400 font-semibold">Hallucination detection:</span> Flagged when knowledge/reasoning answer is long but RAG context was not retrieved.</p>
              <p><span className="text-slate-400 font-semibold">Note:</span> Each benchmark run costs ~13 Gemini API calls. Free tier: 5 req/min — allow ~3 min per full run.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
