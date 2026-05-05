import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projects, cases } from '../../utils/api'
import { useAppStore } from '../../store/appStore'
import {
  Send, Sparkles, Loader2, User, Bot, RotateCcw,
  BookmarkPlus, X, Save, FolderOpen, Plus, RefreshCw,
  CheckCircle2, FlaskConical, Gauge, Thermometer, Wind,
  AlertCircle, Download, BookOpen, Wrench, Zap, TrendingUp,
} from 'lucide-react'

const EXAMPLE_QUERIES = [
  'Design a PSV for propane gas: 10 barg set pressure, 5000 kg/h, 50°C',
  'Calculate hydraulic power for 200 m³/h flow and 40 m head',
  'Size a steam PSV: 5000 kg/h, 150°C, 8 barg',
  'What is PSV chattering and how do I prevent it?',
  'Explain the back pressure correction factor Kb in API 520',
]

const PHASE_LABELS = {
  gas: 'Gas / Vapour', steam: 'Steam', liquid: 'Liquid',
  twophase: 'Two-Phase', fire: 'Fire Case', thermal: 'Thermal',
  tuberupture: 'Tube Rupture', blowdown: 'Blowdown',
}

// ── Divider ───────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-white/8 my-0"/>
}

// ── Intent badge ──────────────────────────────────────────────────
function IntentBadge({ intent, toolCalled, contextUsed, ragSources }) {
  if (!intent) return null
  const isCalc = intent === 'calculation'

  // ragSources may be array of objects {source,topic,section} or strings
  const sourceNames = (ragSources || []).map(s =>
    typeof s === 'string' ? s : (s?.source || '')
  ).filter(Boolean)

  // deduplicate
  const uniqueSources = [...new Set(sourceNames)]

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-1">
      <span className={`inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full font-medium border
        ${isCalc
          ? 'bg-blue-500/10 border-blue-500/25 text-blue-300'
          : 'bg-purple-500/10 border-purple-500/25 text-purple-300'
        }`}>
        {isCalc ? <Wrench size={9}/> : <BookOpen size={9}/>}
        {isCalc ? 'Calculation' : 'Knowledge'}
      </span>
      {toolCalled && (
        <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 font-medium">
          <Zap size={9}/>
          {toolCalled.replace(/_/g, ' ')}
        </span>
      )}
      {contextUsed && uniqueSources.length > 0 && (
        <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
          <BookOpen size={9}/>
          {uniqueSources.join(', ')}
        </span>
      )}
    </div>
  )
}

// ── Save to Project Modal ─────────────────────────────────────────
function SaveToProjectModal({ sizingCard, onClose, onSaved }) {
  const qc = useQueryClient()
  const { notify } = useAppStore()
  const [selectedPid, setSelectedPid] = useState('')
  const [showNewProj, setShowNewProj] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [tag, setTag]                 = useState('')
  const [scenario, setScenario]       = useState(sizingCard?.scenario || '')

  const { data: projectList = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  })

  const createProject = useMutation({
    mutationFn: () => projects.create({ name: newProjName }),
    onSuccess: (p) => {
      qc.invalidateQueries(['projects'])
      setSelectedPid(p.id)
      setShowNewProj(false)
      setNewProjName('')
    }
  })

  const saveCase = useMutation({
    mutationFn: () => {
      const card = sizingCard
      return cases.create(selectedPid, {
        tag:      tag.trim(),
        service:  card.service || '',
        phase:    card.phase   || 'gas',
        scenario: scenario.trim() || card.scenario || '',
        inputs: {
          service:           card.service,
          set_pressure_barg: card.set_pressure_barg,
          temp_C:            card.temp_C,
          flow_kgh:          card.flow_kgh,
          MW:                card.MW,
          k:                 card.k,
          Z:                 card.Z,
        },
        results: {
          A_in2:   card.A_in2,
          orifice: card.orifice ? { d: card.orifice } : null,
        },
        notes: '',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries(['projects'])
      qc.invalidateQueries(['project', selectedPid])
      notify('Case saved to project', 'pass')
      onSaved()
      onClose()
    },
    onError: (e) => notify(e.error || 'Save failed', 'warn'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-2 border border-border-normal rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center">
              <BookmarkPlus size={14} className="text-green-400"/>
            </div>
            <h2 className="text-sm font-semibold text-slate-200">Save to Project</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16}/>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mini preview */}
          <div className="bg-surface-3 border border-border-subtle rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="col-span-2 text-slate-300 font-medium mb-1">{sizingCard.service}</span>
            {sizingCard.set_pressure_barg != null && <span className="text-slate-500">P_set: <span className="text-slate-300">{sizingCard.set_pressure_barg} barg</span></span>}
            {sizingCard.flow_kgh != null && <span className="text-slate-500">Flow: <span className="text-slate-300">{Number(sizingCard.flow_kgh).toLocaleString()} kg/h</span></span>}
            {sizingCard.A_in2 != null && <span className="text-slate-500">Area: <span className="text-blue-300 font-mono">{Number(sizingCard.A_in2).toFixed(4)} in²</span></span>}
            {sizingCard.orifice && <span className="text-slate-500">Orifice: <span className="text-blue-300 font-bold">{sizingCard.orifice}</span></span>}
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-medium uppercase tracking-wide text-slate-500">PSV Tag (optional)</label>
            <input
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="e.g. PSV-101, RV-2A"
              className="w-full h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200
                         placeholder-slate-600 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-medium uppercase tracking-wide text-slate-500">Scenario</label>
            <input
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              placeholder="e.g. Blocked outlet, Fire case"
              className="w-full h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200
                         placeholder-slate-600 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-wide text-slate-500">Select Project</label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <RefreshCw size={12} className="animate-spin"/> Loading projects…
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {projectList.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
                    ${selectedPid === p.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-border-subtle bg-surface-3 hover:border-border-normal'}`}>
                    <input type="radio" name="project" value={p.id}
                      checked={selectedPid === p.id} onChange={() => setSelectedPid(p.id)}
                      className="accent-blue-500"/>
                    <span className="flex-1 min-w-0 text-xs text-slate-200 truncate">{p.name}</span>
                    <span className="text-2xs text-slate-600 shrink-0">{p.case_count} cases</span>
                  </label>
                ))}
              </div>
            )}
            {showNewProj ? (
              <div className="flex gap-2 mt-2">
                <input autoFocus value={newProjName} onChange={e => setNewProjName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newProjName.trim() && createProject.mutate()}
                  placeholder="Project name…"
                  className="flex-1 h-8 px-3 bg-surface-3 border border-blue-500/50 rounded text-xs text-slate-200 placeholder-slate-600 outline-none"/>
                <button onClick={() => newProjName.trim() && createProject.mutate()}
                  disabled={!newProjName.trim() || createProject.isPending}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs text-white transition-colors">
                  {createProject.isPending ? <RefreshCw size={12} className="animate-spin"/> : 'Create'}
                </button>
                <button onClick={() => setShowNewProj(false)} className="h-8 px-2 text-slate-500 hover:text-slate-300">
                  <X size={14}/>
                </button>
              </div>
            ) : (
              <button onClick={() => setShowNewProj(true)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors">
                <Plus size={12}/> New project
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 justify-end border-t border-border-subtle pt-4">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button onClick={() => saveCase.mutate()} disabled={!selectedPid || saveCase.isPending}
            className="btn-primary gap-2 text-xs">
            {saveCase.isPending ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>}
            Save Case
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Compact data cell ─────────────────────────────────────────────
function Cell({ label, value, accent }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs text-slate-600 uppercase tracking-wide leading-none">{label}</span>
      <span className={`text-xs font-medium leading-tight ${accent ? 'text-blue-300 font-bold font-mono' : 'text-slate-200'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Utilisation bar ───────────────────────────────────────────────
function UtilBar({ pct }) {
  if (pct == null) return null
  const p    = Math.min(100, Math.max(0, Number(pct)))
  const color = p > 95 ? 'bg-red-400' : p > 85 ? 'bg-amber-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }}/>
      </div>
      <span className={`text-2xs font-bold tabular-nums ${p > 95 ? 'text-red-400' : p > 85 ? 'text-amber-400' : 'text-green-400'}`}>
        {p.toFixed(1)}%
      </span>
    </div>
  )
}

// ── Sizing Result Card (compact, 2-col grid) ──────────────────────
function SizingCard({ sizingCard, onSave, onDownload, downloading }) {
  const tr  = sizingCard.toolResult || {}
  const pct = sizingCard.utilisation_pct

  const isOk    = pct != null && Number(pct) <= 100
  const isWarn  = pct != null && Number(pct) > 90
  const statusColor = isWarn ? 'text-amber-400' : 'text-green-400'
  const statusIcon  = isWarn ? '⚠' : '✔'
  const statusMsg   = !isOk
    ? 'Over capacity — select larger orifice'
    : isWarn
    ? 'High utilisation — verify with supplier'
    : 'Sizing OK — within acceptable range'

  return (
    <div className="mt-2 rounded-xl border border-green-500/20 bg-green-500/4 overflow-hidden w-full max-w-[560px]">

      {/* ── Summary bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-green-500/8 border-b border-green-500/15">
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 size={12} className="text-green-400 shrink-0"/>
          <span className="text-2xs font-semibold text-green-300 uppercase tracking-wider shrink-0">Sizing Result</span>
          {sizingCard.orifice && (
            <span className="text-2xs bg-blue-500/20 border border-blue-500/25 text-blue-200 rounded px-1.5 py-0.5 font-bold shrink-0">
              Orifice {sizingCard.orifice}
            </span>
          )}
          {sizingCard.A_in2 != null && (
            <span className="text-2xs text-slate-400 font-mono truncate">
              {Number(sizingCard.A_in2).toFixed(4)} in²
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDownload} disabled={downloading} title="Download Word report"
            className="flex items-center gap-1 text-2xs px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25
                       border border-blue-500/30 rounded text-blue-300 hover:text-blue-200 transition-all disabled:opacity-50">
            {downloading ? <RefreshCw size={9} className="animate-spin"/> : <Download size={9}/>}
            <span className="hidden sm:inline">Report</span>
          </button>
          <button onClick={onSave}
            className="flex items-center gap-1 text-2xs px-2 py-1 bg-green-500/15 hover:bg-green-500/25
                       border border-green-500/30 rounded text-green-300 hover:text-green-200 transition-all">
            <BookmarkPlus size={9}/>
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* ── Two-column: Inputs | Results ─────────────────────── */}
      <div className="grid grid-cols-2 divide-x divide-white/8">

        {/* Left: Process Inputs */}
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Inputs</p>
          <div className="space-y-1.5">
            <Cell label="Service" value={sizingCard.service}/>
            <Cell label="Phase"   value={PHASE_LABELS[sizingCard.phase] || sizingCard.phase}/>
            <Cell label="Set Pressure"  value={sizingCard.set_pressure_barg != null ? `${sizingCard.set_pressure_barg} barg` : null}/>
            <Cell label="Temperature"   value={sizingCard.temp_C != null ? `${sizingCard.temp_C} °C` : null}/>
            <Cell label="Relief Flow"   value={sizingCard.flow_kgh != null ? `${Number(sizingCard.flow_kgh).toLocaleString()} kg/h` : null}/>
            {sizingCard.MW  != null && <Cell label="MW"  value={`${sizingCard.MW} kg/kmol`}/>}
            {sizingCard.k   != null && <Cell label="k (Cp/Cv)" value={String(sizingCard.k)}/>}
          </div>
        </div>

        {/* Right: Calculation Results */}
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Results</p>
          <div className="space-y-1.5">
            <Cell label="Required Area" value={sizingCard.A_in2 != null
              ? `${Number(sizingCard.A_in2).toFixed(4)} in² (${(Number(sizingCard.A_in2)*6.4516).toFixed(2)} cm²)`
              : null} accent/>
            <Cell label="API 526 Orifice"  value={sizingCard.orifice} accent/>
            <Cell label="Orifice Area"     value={sizingCard.orifice_area_in2 != null
              ? `${Number(sizingCard.orifice_area_in2).toFixed(4)} in²`
              : null}/>
            <Cell label="Size (in × out)"  value={sizingCard.selected_orifice_size}/>
            <Cell label="Flow Regime"      value={tr.flow_regime}/>
            {tr.Kb  != null && <Cell label="Kb (back pressure)" value={String(tr.Kb)}/>}
            {tr.heat_input_kW != null && <Cell label="Fire Heat Input" value={`${tr.heat_input_kW} kW`}/>}
          </div>
        </div>
      </div>

      {/* ── Utilisation bar ──────────────────────────────────── */}
      {pct != null && (
        <>
          <Divider/>
          <div className="px-3 py-2 space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs text-slate-500 uppercase tracking-wide">Capacity Utilisation</span>
            </div>
            <UtilBar pct={pct}/>
          </div>
        </>
      )}

      {/* ── Status row ───────────────────────────────────────── */}
      <Divider/>
      <div className="px-3 py-1.5 flex items-center gap-1.5">
        <span className={`text-xs font-semibold ${statusColor}`}>{statusIcon}</span>
        <span className={`text-2xs ${statusColor}`}>{statusMsg}</span>
        <span className="ml-auto text-2xs text-slate-600">API 520 / API 526</span>
      </div>
    </div>
  )
}

// ── Hydraulic power result ─────────────────────────────────────────
function ToolResult({ toolResult }) {
  if (!toolResult?.power_kW) return null
  return (
    <div className="mt-2 border border-blue-500/20 bg-blue-500/6 rounded-xl overflow-hidden w-full max-w-[560px]">
      <div className="px-3 py-2 bg-blue-500/10 border-b border-blue-500/15 flex items-center gap-1.5">
        <TrendingUp size={11} className="text-blue-400"/>
        <span className="text-2xs font-semibold text-blue-300 uppercase tracking-wider">Hydraulic Power</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/8">
        <div className="px-3 py-2.5 text-center">
          <div className="text-2xs text-slate-500 uppercase tracking-wide mb-1">Kilowatts</div>
          <div className="text-lg font-bold text-blue-300 font-mono">{toolResult.power_kW.toFixed(2)}</div>
          <div className="text-2xs text-slate-500">kW</div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className="text-2xs text-slate-500 uppercase tracking-wide mb-1">Horsepower</div>
          <div className="text-lg font-bold text-blue-300 font-mono">{toolResult.power_hp.toFixed(2)}</div>
          <div className="text-2xs text-slate-500">HP</div>
        </div>
      </div>
      <Divider/>
      <div className="px-3 py-1.5 text-2xs text-slate-500 font-mono">
        Q = {toolResult.flow_m3hr} m³/h · H = {toolResult.head_m} m · ρ = {toolResult.density_kgm3} kg/m³
        <span className="ml-2 text-purple-400">{toolResult.formula}</span>
      </div>
    </div>
  )
}

// ── Individual message ─────────────────────────────────────────────
function Message({ msg, onSaveSizingCard }) {
  const [downloading, setDownloading] = useState(false)
  const isUser = msg.role === 'user'

  const handleDownload = async () => {
    if (!msg.sizingCard) return
    setDownloading(true)
    try {
      const c = msg.sizingCard
      const payload = {
        service:         c.service,
        fluid:           c.service,
        phase:           c.phase,
        scenario:        c.scenario,
        P_set_barg:      c.set_pressure_barg,
        P_rel_barg:      c.toolResult?.relieving_pressure_barg,
        T_rel_C:         c.temp_C,
        W_kgh:           c.flow_kgh,
        MW:              c.MW,
        k:               c.k,
        Z:               c.Z,
        A_in2:           c.A_in2,
        orifice:         c.orifice,
        orifice_area_in2: c.orifice_area_in2,
        orifice_size:    c.selected_orifice_size,
        utilisation_pct: c.utilisation_pct,
        toolResult:      c.toolResult,
      }
      const response = await axios.post('/api/report', payload, { responseType: 'blob' })
      const url  = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href  = url
      const svc  = (c.service || 'PSV').replace(/\s+/g, '_').substring(0, 30)
      link.setAttribute('download', `PSV_Report_${svc}_${new Date().toISOString().slice(0,10)}.docx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Report download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5
        ${isUser ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-blue-500/15 border border-blue-500/25'}`}>
        {isUser
          ? <User className="w-3 h-3 text-purple-400"/>
          : <Bot  className="w-3 h-3 text-blue-400"/>
        }
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1.5 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}
           style={{ maxWidth: 'min(84%, 600px)' }}>

        {!isUser && (
          <IntentBadge
            intent={msg.intent}
            toolCalled={msg.tool_called}
            contextUsed={msg.context_used}
            ragSources={msg.rag_sources}
          />
        )}

        {/* Text bubble */}
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed w-full overflow-x-auto
          ${isUser
            ? 'bg-purple-500/15 border border-purple-500/20 text-slate-100 rounded-tr-sm whitespace-pre-wrap'
            : 'bg-surface-2 border border-border-subtle text-slate-200 rounded-tl-sm'
          }`}>
          {isUser
            ? msg.content
            : (
              <div className="prose prose-sm prose-invert max-w-none
                prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                prose-p:text-slate-200 prose-p:my-1 prose-p:leading-relaxed
                prose-strong:text-slate-100 prose-strong:font-semibold
                prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-slate-200
                prose-ol:my-1 prose-ol:pl-4
                prose-code:bg-slate-700/60 prose-code:text-blue-300 prose-code:px-1 prose-code:rounded prose-code:text-xs
                prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-600 prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto
                prose-blockquote:border-l-blue-500 prose-blockquote:text-slate-300
                prose-table:text-xs prose-th:text-slate-100 prose-td:text-slate-300
                prose-hr:border-slate-700">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )
          }
        </div>

        {/* Tool result cards — outside text bubble, full width */}
        {msg.toolResult  && <ToolResult toolResult={msg.toolResult}/>}
        {msg.sizingCard  && (
          <SizingCard
            sizingCard={msg.sizingCard}
            onSave={() => onSaveSizingCard(msg.sizingCard)}
            onDownload={handleDownload}
            downloading={downloading}
          />
        )}
        {msg.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5 flex items-center gap-1.5">
            <AlertCircle size={12}/>
            {msg.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ───────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-blue-500/15 border border-blue-500/25">
        <Bot className="w-3 h-3 text-blue-400"/>
      </div>
      <div className="bg-surface-2 border border-border-subtle rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
      </div>
    </div>
  )
}

// ── Main AI Query component ────────────────────────────────────────
export default function AIQuery() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Hello! I\'m your PSV Engineering AI Agent. I classify every query, call backend calculation tools for any numerical result, and use a knowledge base for standards and theory questions.\n\nAsk me to size a PSV, calculate hydraulic power, explain API 520/521, or troubleshoot valve problems.',
  }])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [saveCard, setSaveCard] = useState(null)
  const bottomRef               = useRef(null)
  const textareaRef             = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    const userMsg     = { role: 'user', content: userText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const { data } = await axios.post('/api/ai-chat', { messages: apiMessages })
      if (data.ok) {
        setMessages(prev => [...prev, {
          role:         'assistant',
          content:      data.reply,
          intent:       data.intent      || null,
          tool_called:  data.tool_called || null,
          context_used: data.context_used || false,
          rag_sources:  data.rag_sources  || [],
          toolResult:   data.toolResult   || null,
          sizingCard:   data.sizingCard   || null,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant', content: 'Something went wrong.', error: data.error,
        }])
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Network error'
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'I ran into an error.', error: errMsg,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Chat cleared. What would you like to work on?',
    }])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-1/60 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-500/15 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-400"/>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">PSV Engineering Agent</h1>
            <p className="text-2xs text-slate-500">Gemini 2.5 Flash · Tool Calling · RAG</p>
          </div>
        </div>
        <button onClick={clearChat} title="Clear chat"
          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-surface-3 rounded-md transition-colors">
          <RotateCcw className="w-3.5 h-3.5"/>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overflow-x-hidden">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onSaveSizingCard={setSaveCard}/>
        ))}
        {loading && <TypingIndicator/>}
        <div ref={bottomRef}/>
      </div>

      {/* Example queries */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex-shrink-0">
          <p className="text-2xs text-slate-600 mb-2 uppercase tracking-wide font-medium">Try asking:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_QUERIES.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} disabled={loading}
                className="text-2xs px-2.5 py-1.5 bg-surface-3 hover:bg-surface-2 border border-border-subtle
                           hover:border-border-normal rounded-lg text-slate-400 hover:text-slate-200
                           transition-all disabled:opacity-50 text-left">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border-subtle bg-surface-1/40 px-4 py-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a PSV sizing question or request a calculation…"
            rows={1}
            className="flex-1 bg-surface-3 border border-border-subtle rounded-xl px-3 py-2.5 text-sm
                       text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500/50
                       resize-none leading-relaxed min-h-[40px] max-h-[120px] overflow-y-auto"
            style={{ height: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                       disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors">
            {loading
              ? <Loader2 className="w-4 h-4 text-white animate-spin"/>
              : <Send    className="w-4 h-4 text-white"/>
            }
          </button>
        </div>
        <p className="text-2xs text-slate-700 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>

      {/* Save modal */}
      {saveCard && (
        <SaveToProjectModal
          sizingCard={saveCard}
          onClose={() => setSaveCard(null)}
          onSaved={() => setSaveCard(null)}
        />
      )}
    </div>
  )
}
