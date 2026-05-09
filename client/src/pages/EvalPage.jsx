import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, Play, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock, Zap, BookOpen,
  Wrench, Target, Brain, ShieldAlert,
  Loader2, Info, Hourglass, RefreshCw, AlertTriangle,
  ChevronDown as CaretDown, Cpu,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────
const MODELS = {
  'gemini-2.0-flash-lite': { label: 'Gemini 2.0 Flash Lite', badge: 'Fastest · cheapest',   color: 'text-green-400' },
  'gemini-2.0-flash':      { label: 'Gemini 2.0 Flash',      badge: 'Balanced',              color: 'text-blue-400'  },
  'gemini-2.5-flash':      { label: 'Gemini 2.5 Flash',      badge: 'Best quality',          color: 'text-purple-400'},
}

// ── API helpers ───────────────────────────────────────────────────
const api = {
  cases:   ()           => axios.get('/api/eval/cases').then(r => r.data),
  status:  ()           => axios.get('/api/eval/status').then(r => r.data),
  results: ()           => axios.get('/api/eval/results').then(r => r.data),
  run:     (opts)       => axios.post('/api/eval/run', opts).then(r => r.data),
  clear:   ()           => axios.delete('/api/eval/results').then(r => r.data),
}

// ── Category config ────────────────────────────────────────────────
const CAT = {
  knowledge:   { label: 'Knowledge',   color: 'purple', icon: BookOpen },
  calculation: { label: 'Calculation', color: 'blue',   icon: Wrench   },
  reasoning:   { label: 'Reasoning',   color: 'amber',  icon: Brain    },
}
const CAT_COLORS = {
  knowledge:   'bg-purple-500/10 text-purple-300 border-purple-500/20',
  calculation: 'bg-blue-500/10   text-blue-300   border-blue-500/20',
  reasoning:   'bg-amber-500/10  text-amber-300  border-amber-500/20',
}

// ── Format ms → human readable ────────────────────────────────────
function fmtMs(ms) {
  if (!ms || ms <= 0) return '0s'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ── Countdown hook — reads cooldown_until from status ────────────
function useCountdown(cooldown_until) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!cooldown_until) { setRemaining(0); return }
    const tick = () => {
      const diff = new Date(cooldown_until) - Date.now()
      setRemaining(Math.max(0, Math.round(diff / 1000)))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [cooldown_until])
  return remaining
}

// ── Metric card ────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, unit, sub, color }) {
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
      <div className="p-1.5 rounded-lg bg-current/10 w-fit mb-2">
        <Icon size={14} className="opacity-80"/>
      </div>
      <div className="text-2xl font-bold font-mono leading-none">
        {value ?? '—'}
        {unit && <span className="text-sm font-normal ml-1 opacity-70">{unit}</span>}
      </div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
      {sub && <div className="text-2xs opacity-50 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Enhanced progress panel (running / cooldown / retry) ──────────
function ProgressPanel({ status }) {
  const countdown = useCountdown(status.cooldown_until)
  const pct       = status.total > 0 ? Math.round(status.progress / status.total * 100) : 0
  const isCooldown = status.phase === 'cooldown'
  const isRetry    = status.phase === 'retry'
  const isRunning  = status.phase === 'running'

  // Panel colour
  const panelCls = isRetry   ? 'border-amber-500/20 bg-amber-500/5'
                 : isCooldown? 'border-blue-500/20   bg-blue-500/5'
                 :             'border-blue-500/20   bg-blue-500/5'

  // Phase icon + label
  let PhaseIcon  = Loader2
  let phaseLabel = 'Running evaluation…'
  let iconCls    = 'text-blue-400 animate-spin'

  if (isCooldown) {
    PhaseIcon  = Hourglass
    phaseLabel = 'Waiting for rate limit cooldown'
    iconCls    = 'text-amber-400 animate-pulse'
  } else if (isRetry) {
    PhaseIcon  = RefreshCw
    phaseLabel = `Rate limit hit — retrying (${status.retry_attempt}/${3})`
    iconCls    = 'text-amber-400 animate-spin'
  }

  const barColor = isCooldown || isRetry ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${panelCls}`}>
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhaseIcon size={14} className={iconCls}/>
          <span className="text-sm font-medium text-slate-200">{phaseLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span>{status.progress}/{status.total} cases</span>
          {status.request_count > 0 && (
            <span className="text-slate-500">{status.request_count} req sent</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-2xs text-slate-500">
          <span>{pct}% complete</span>
          {status.estimated_remaining_ms > 0 && (
            <span>~{fmtMs(status.estimated_remaining_ms)} remaining</span>
          )}
        </div>
      </div>

      {/* Batch info */}
      {status.batch_total > 1 && (
        <div className="flex items-center gap-2 text-2xs text-slate-500">
          <div className="flex gap-1">
            {Array.from({ length: status.batch_total }, (_, i) => (
              <div key={i} className={`w-4 h-1.5 rounded-full ${
                i + 1 <  status.batch_current ? 'bg-blue-500'
              : i + 1 === status.batch_current ? (isCooldown || isRetry ? 'bg-amber-400' : 'bg-blue-400 animate-pulse')
              :                                   'bg-slate-700'
              }`}/>
            ))}
          </div>
          <span>Batch {status.batch_current}/{status.batch_total}</span>
        </div>
      )}

      {/* Cooldown countdown */}
      {(isCooldown || isRetry) && countdown > 0 && (
        <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/15">
          <Hourglass size={11} className="text-amber-400 shrink-0"/>
          <span className="text-xs text-amber-300 font-medium">
            {isRetry ? `Retrying in ${countdown}s` : `Resuming in ${countdown}s`}
          </span>
          <span className="ml-auto text-2xs text-amber-400/60">{status.phase_detail}</span>
        </div>
      )}

      {/* Current case */}
      {isRunning && status.currentCase && (
        <div className="text-2xs text-slate-500 truncate">{status.currentCase}</div>
      )}

      {/* Model badge */}
      {status.model && (
        <div className="text-2xs text-slate-600">
          Model: <span className="text-slate-400">{status.model}</span>
          {status.batch_size && <span className="ml-2">· Batch size: {status.batch_size}</span>}
        </div>
      )}
    </div>
  )
}

// ── Model selector ─────────────────────────────────────────────────
function ModelSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  const m               = MODELS[value] || MODELS['gemini-2.5-flash']

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-2 text-xs px-3 py-1.5 bg-surface-3 border border-border-subtle
                   rounded-lg hover:border-slate-500/50 transition-all disabled:opacity-40"
      >
        <Cpu size={11} className={m.color}/>
        <span className="text-slate-300">{m.label}</span>
        <CaretDown size={11} className="text-slate-500"/>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[220px] bg-surface-1
                        border border-border-subtle rounded-xl shadow-xl overflow-hidden">
          {Object.entries(MODELS).map(([id, cfg]) => (
            <button key={id} onClick={() => { onChange(id); setOpen(false) }}
              className={`w-full text-left px-3 py-2.5 hover:bg-surface-3 transition-colors
                          flex items-start justify-between gap-3
                          ${id === value ? 'bg-surface-3' : ''}`}>
              <div>
                <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                <div className="text-2xs text-slate-500 mt-0.5">{cfg.badge}</div>
              </div>
              {id === value && <CheckCircle2 size={11} className="text-green-400 mt-0.5 shrink-0"/>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Batch size selector ────────────────────────────────────────────
function BatchSelector({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-slate-500">Batch:</span>
      {[3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)} disabled={disabled}
          className={`text-2xs w-6 h-6 rounded border transition-all disabled:opacity-40
            ${value === n
              ? 'bg-slate-600 border-slate-500 text-slate-200 font-semibold'
              : 'border-border-subtle text-slate-500 hover:text-slate-300 hover:border-slate-500/50'
            }`}>
          {n}
        </button>
      ))}
    </div>
  )
}

// ── Score pill ─────────────────────────────────────────────────────
function ScorePill({ score }) {
  const color = score >= 80 ? 'text-green-400 bg-green-500/15 border-green-500/25'
              : score >= 60 ? 'text-amber-400 bg-amber-500/15 border-amber-500/25'
              :               'text-red-400   bg-red-500/15   border-red-500/25'
  return (
    <span className={`text-2xs font-bold px-2 py-0.5 rounded border ${color}`}>
      {score != null ? `${score}%` : '—'}
    </span>
  )
}

// ── Key terms ─────────────────────────────────────────────────────
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
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500 mb-1">AI Response</p>
        <div className="text-xs text-slate-300 bg-surface-3 rounded-lg p-3 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-border-subtle">
          {result.answer || <span className="text-red-400 italic">{result.error || 'No answer'}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">Metrics</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Intent</span>
              <span className={result.intent_correct ? 'text-green-400' : 'text-red-400'}>
                {result.intent_actual || '—'} {result.intent_correct ? '✓' : `✗ (exp: ${result.intent_expected})`}
              </span>
            </div>
            {result.tool_expected && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tool called</span>
                <span className={result.tool_correct ? 'text-green-400' : 'text-red-400'}>
                  {result.tool_called || 'none'} {result.tool_correct ? '✓' : `✗ (exp: ${result.tool_expected})`}
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
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Key Terms ({result.key_terms_found?.length}/{(result.key_terms_found?.length||0) + (result.key_terms_missed?.length||0)})
          </p>
          <KeyTerms found={result.key_terms_found||[]} missed={result.key_terms_missed||[]}/>
        </div>
      </div>

      {result.hallucination_flag && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <ShieldAlert size={13} className="text-amber-400 mt-0.5 shrink-0"/>
          <div>
            <p className="text-xs font-semibold text-amber-300">Hallucination Warning</p>
            <p className="text-2xs text-amber-400/80 mt-0.5">{result.hallucination_reason}</p>
          </div>
        </div>
      )}

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
    <div className={`border-b border-border-subtle last:border-0 ${index % 2 !== 0 ? 'bg-surface-3/20' : ''}`}>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 hover:bg-surface-3/40 transition-colors">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{statusIcon}</div>
          <div className="shrink-0 w-16">
            <div className="text-2xs font-mono text-slate-300 font-semibold">{result.case_id}</div>
            <span className={`text-2xs px-1.5 py-0.5 rounded border ${CAT_COLORS[result.category]} mt-0.5 inline-block`}>
              {catCfg.label}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-200 leading-tight line-clamp-2">{result.question}</p>
            {result.tool_called && (
              <span className="text-2xs text-blue-400 font-mono mt-0.5 inline-block">⚙ {result.tool_called}</span>
            )}
            {result.error && (
              <span className="text-2xs text-red-400 mt-0.5 inline-block">⚠ {result.error}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center hidden sm:block">
              <div className="text-2xs text-slate-500">Latency</div>
              <div className="text-xs font-mono text-slate-300">{(result.latency_ms/1000).toFixed(1)}s</div>
            </div>
            <div className="text-center">
              <div className="text-2xs text-slate-500">Score</div>
              <ScorePill score={result.confidence}/>
            </div>
            {result.hallucination_flag && <ShieldAlert size={13} className="text-amber-400"/>}
            {expanded ? <ChevronDown size={13} className="text-slate-500"/> : <ChevronRight size={13} className="text-slate-500"/>}
          </div>
        </div>
      </button>
      {expanded && <ExpandedResult result={result}/>}
    </div>
  )
}

// ── Category summary ───────────────────────────────────────────────
function CategoryBar({ byCategory }) {
  if (!byCategory) return null
  return (
    <div className="grid grid-cols-3 gap-3">
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
        Run the benchmark to evaluate the AI agent across 13 test cases.
        Rate limiting is handled automatically.
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
  const qc               = useQueryClient()
  const [filter, setFilter]     = useState('all')
  const [model,  setModel]      = useState('gemini-2.5-flash')
  const [batchSize, setBatchSize] = useState(4)

  const { data: casesData } = useQuery({
    queryKey:  ['eval-cases'],
    queryFn:   api.cases,
    staleTime: Infinity,
  })

  const { data: resultsData, refetch: refetchResults } = useQuery({
    queryKey:  ['eval-results'],
    queryFn:   api.results,
    staleTime: 0,
  })

  const { data: statusData } = useQuery({
    queryKey:       ['eval-status'],
    queryFn:        api.status,
    refetchInterval: (data) => data?.running ? 1500 : false,
    staleTime:      0,
  })

  // Fetch results when run completes
  useEffect(() => {
    if (statusData && !statusData.running && statusData.progress > 0 && statusData.phase === 'idle') {
      refetchResults()
      qc.invalidateQueries(['eval-results'])
    }
  }, [statusData?.running, statusData?.phase])

  const runMutation = useMutation({
    mutationFn: (opts) => api.run(opts),
    onSuccess: () => qc.invalidateQueries(['eval-status']),
  })

  const clearMutation = useMutation({
    mutationFn: api.clear,
    onSuccess:  () => { qc.invalidateQueries(['eval-results']); refetchResults() },
  })

  const isRunning  = statusData?.running === true
  const latestRun  = resultsData?.runs?.[0]
  const summary    = latestRun?.summary
  const results    = latestRun?.results || []
  const filtered   = filter === 'all' ? results : results.filter(r => r.category === filter)
  const scoreColor = !summary ? 'slate' : summary.avg_score >= 80 ? 'green' : summary.avg_score >= 60 ? 'amber' : 'red'

  function startRun() {
    runMutation.mutate({ model, batch_size: batchSize, case_ids: null })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/15 rounded-xl border border-purple-500/20">
              <FlaskConical size={18} className="text-purple-400"/>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">AI Evaluation Dashboard</h1>
              <p className="text-2xs text-slate-500">
                {casesData?.total || 13} test cases · rate-limited to 5 req/min
                {latestRun && (
                  <span className="ml-1">
                    · Last run: {new Date(latestRun.started_at).toLocaleString()}
                    {latestRun.model && <span className="ml-1 text-slate-600">({latestRun.model})</span>}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <BatchSelector value={batchSize} onChange={setBatchSize} disabled={isRunning}/>
            <ModelSelector value={model} onChange={setModel} disabled={isRunning}/>
            {latestRun && (
              <button onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending || isRunning}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-slate-500 hover:text-red-400
                           hover:bg-red-500/10 border border-border-subtle hover:border-red-500/20
                           rounded-lg transition-all disabled:opacity-40">
                <Trash2 size={12}/> Clear
              </button>
            )}
            <button onClick={startRun} disabled={isRunning || runMutation.isPending}
              className="flex items-center gap-2 text-xs px-4 py-2 bg-purple-600 hover:bg-purple-500
                         disabled:opacity-50 rounded-lg text-white font-semibold transition-colors">
              {isRunning || runMutation.isPending
                ? <><Loader2 size={13} className="animate-spin"/> Running…</>
                : <><Play size={13}/> Run Benchmark</>
              }
            </button>
          </div>
        </div>

        {/* Progress panel */}
        {isRunning && statusData && <ProgressPanel status={statusData}/>}

        {/* Summary metrics */}
        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard icon={Target}   label="Overall Score"  value={summary.avg_score}       unit="%"  sub={`${summary.passed}/${summary.total_cases} passed`} color={scoreColor}/>
              <MetricCard icon={Clock}    label="Avg Latency"    value={(summary.avg_latency_ms/1000).toFixed(2)} unit="s" sub="per question"   color="blue"/>
              <MetricCard icon={Zap}      label="Tool Accuracy"  value={summary.tool_accuracy_pct ?? '—'} unit={summary.tool_accuracy_pct != null ? '%' : ''} sub="calculation cases" color={summary.tool_accuracy_pct >= 80 ? 'green' : 'amber'}/>
              <MetricCard icon={BookOpen} label="RAG Hit Rate"   value={summary.rag_hit_rate_pct  ?? '—'} unit={summary.rag_hit_rate_pct  != null ? '%' : ''} sub="context retrieved"  color={summary.rag_hit_rate_pct  >= 80 ? 'green' : 'amber'}/>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex items-center gap-3">
                <div className="p-1.5 bg-green-500/10 rounded-lg"><CheckCircle2 size={14} className="text-green-400"/></div>
                <div><div className="text-lg font-bold text-green-400">{summary.passed}</div><div className="text-2xs text-slate-500">Cases passed</div></div>
              </div>
              <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex items-center gap-3">
                <div className="p-1.5 bg-red-500/10 rounded-lg"><XCircle size={14} className="text-red-400"/></div>
                <div><div className="text-lg font-bold text-red-400">{summary.failed}</div><div className="text-2xs text-slate-500">Cases failed</div></div>
              </div>
              <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex items-center gap-3">
                <div className="p-1.5 bg-amber-500/10 rounded-lg"><ShieldAlert size={14} className="text-amber-400"/></div>
                <div><div className="text-lg font-bold text-amber-400">{summary.hallucination_flags}</div><div className="text-2xs text-slate-500">Hallucination flags</div></div>
              </div>
            </div>

            <CategoryBar byCategory={summary.by_category}/>
          </>
        )}

        {/* Results table */}
        {results.length > 0 ? (
          <div className="bg-surface-2 border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center gap-1 px-4 py-3 border-b border-border-subtle bg-surface-1/40">
              <span className="text-2xs text-slate-500 font-semibold uppercase tracking-wide mr-2">Filter:</span>
              {['all', 'knowledge', 'calculation', 'reasoning'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-2xs px-2.5 py-1 rounded-md border transition-all capitalize font-medium
                    ${filter === f ? 'bg-slate-600/60 border-slate-500/50 text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  {f === 'all' ? `All (${results.length})` : `${f} (${results.filter(r => r.category === f).length})`}
                </button>
              ))}
              <div className="ml-auto text-2xs text-slate-600 flex items-center gap-1">
                <Info size={10}/> Click row to expand
              </div>
            </div>

            <div className="grid grid-cols-[1.5rem_5rem_1fr_5rem_5rem] gap-3 px-4 py-2 border-b border-border-subtle bg-surface-3/30">
              <div/><div className="text-2xs font-semibold uppercase tracking-wide text-slate-500">ID / Type</div>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500">Question</div>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500 text-right">Latency</div>
              <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500 text-right">Score</div>
            </div>

            {filtered.length === 0
              ? <div className="py-8 text-center text-sm text-slate-500">No results for this filter</div>
              : filtered.map((r, i) => <ResultRow key={r.case_id} result={r} index={i}/>)
            }
          </div>
        ) : !isRunning && (
          <div className="bg-surface-2 border border-border-subtle rounded-xl">
            <EmptyState onRun={startRun} loading={runMutation.isPending}/>
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
                    <div className="text-2xs text-slate-500">
                      {run.cases_run} cases · {fmtMs(run.duration_ms)}
                      {run.model && <span className="ml-1.5 text-slate-600">· {run.model}</span>}
                    </div>
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
            <div className="text-2xs text-slate-500 space-y-1">
              <p><span className="text-slate-400 font-semibold">Scoring:</span> Intent (20 pts) + Tool accuracy (30 pts, calculation) + Key terms (30 pts) + RAG usage (20 pts, knowledge/reasoning) + Numeric accuracy (20 pts, when applicable). Pass ≥ 60%.</p>
              <p><span className="text-slate-400 font-semibold">Rate limiting:</span> 13s between cases (configurable via RATE_LIMIT_DELAY env), 30s cooldown between batches. On 429 errors, the system automatically waits for the Retry-After period and retries up to 3 times.</p>
              <p><span className="text-slate-400 font-semibold">Batches:</span> Cases run in groups of 3–5. Choose a smaller batch size to reduce burst pressure on the API quota.</p>
              <p><span className="text-slate-400 font-semibold">Models:</span> Gemini 2.0 Flash Lite is fastest and cheapest. Gemini 2.5 Flash gives highest accuracy. All three use the same tools and RAG system.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
