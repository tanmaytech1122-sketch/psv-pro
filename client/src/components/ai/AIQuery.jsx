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
  AlertCircle, ChevronDown, Download, BookOpen, Wrench, Zap,
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

// ── Intent badge ──────────────────────────────────────────────────
function IntentBadge({ intent, toolCalled, contextUsed, ragSources }) {
  if (!intent) return null
  const isCalc = intent === 'calculation'
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
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
      {contextUsed && ragSources?.length > 0 && (
        <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
          <BookOpen size={9}/>
          RAG: {ragSources.join(', ')}
        </span>
      )}
    </div>
  )
}

// ── Save to Project Modal ─────────────────────────────────────────
function SaveToProjectModal({ sizingCard, onClose, onSaved }) {
  const qc = useQueryClient()
  const { notify } = useAppStore()
  const [selectedPid, setSelectedPid]   = useState('')
  const [showNewProj, setShowNewProj]   = useState(false)
  const [newProjName, setNewProjName]   = useState('')
  const [tag, setTag]                   = useState('')
  const [scenario, setScenario]         = useState(sizingCard?.scenario || '')

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
      const inputs = {
        service:           card.service,
        set_pressure_barg: card.set_pressure_barg,
        temp_C:            card.temp_C,
        flow_kgh:          card.flow_kgh,
        MW:                card.MW,
        k:                 card.k,
        Z:                 card.Z,
      }
      const results = {
        A_in2:   card.A_in2,
        orifice: card.orifice ? { d: card.orifice } : null,
      }
      return cases.create(selectedPid, {
        tag:      tag.trim(),
        service:  card.service || '',
        phase:    card.phase   || 'gas',
        scenario: scenario.trim() || card.scenario || '',
        inputs,
        results,
        notes:    '',
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
          <div className="bg-surface-3 border border-border-subtle rounded-lg p-3 space-y-1.5 text-xs">
            <div className="text-slate-400 font-medium mb-2">{sizingCard.service}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-500">
              <span>Phase: <span className="text-slate-300">{PHASE_LABELS[sizingCard.phase] || sizingCard.phase}</span></span>
              {sizingCard.set_pressure_barg != null && (
                <span>P_set: <span className="text-slate-300">{sizingCard.set_pressure_barg} barg</span></span>
              )}
              {sizingCard.flow_kgh != null && (
                <span>Flow: <span className="text-slate-300">{sizingCard.flow_kgh?.toLocaleString()} kg/h</span></span>
              )}
              {sizingCard.A_in2 != null && (
                <span>A_req: <span className="text-blue-300 font-mono">{Number(sizingCard.A_in2).toFixed(4)} in²</span></span>
              )}
              {sizingCard.orifice && (
                <span>Orifice: <span className="text-blue-300 font-bold">{sizingCard.orifice}</span></span>
              )}
            </div>
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
            ) : !projectList.length && !showNewProj ? (
              <p className="text-xs text-slate-600">No projects yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {projectList.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
                      ${selectedPid === p.id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-border-subtle bg-surface-3 hover:border-border-normal'}`}
                  >
                    <input
                      type="radio"
                      name="project"
                      value={p.id}
                      checked={selectedPid === p.id}
                      onChange={() => setSelectedPid(p.id)}
                      className="accent-blue-500"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="text-xs text-slate-200 block truncate">{p.name}</span>
                    </span>
                    <span className="text-2xs text-slate-600 shrink-0">{p.case_count} cases</span>
                  </label>
                ))}
              </div>
            )}

            {showNewProj ? (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newProjName.trim() && createProject.mutate()}
                  placeholder="Project name…"
                  className="flex-1 h-8 px-3 bg-surface-3 border border-blue-500/50 rounded text-xs text-slate-200
                             placeholder-slate-600 outline-none"
                />
                <button
                  onClick={() => newProjName.trim() && createProject.mutate()}
                  disabled={!newProjName.trim() || createProject.isPending}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs text-white transition-colors"
                >
                  {createProject.isPending ? <RefreshCw size={12} className="animate-spin"/> : 'Create'}
                </button>
                <button onClick={() => setShowNewProj(false)} className="h-8 px-2 text-slate-500 hover:text-slate-300">
                  <X size={14}/>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewProj(true)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
              >
                <Plus size={12}/> New project
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 justify-end border-t border-border-subtle pt-4">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button
            onClick={() => saveCase.mutate()}
            disabled={!selectedPid || saveCase.isPending}
            className="btn-primary gap-2 text-xs"
          >
            {saveCase.isPending ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>}
            Save Case
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sizing Card ───────────────────────────────────────────────────
function SizingCard({ sizingCard, onSave, onDownload, downloading }) {
  const [expanded, setExpanded] = useState(false)

  const rows = [
    sizingCard.phase             && { icon: Wind,        label: 'Phase',         value: PHASE_LABELS[sizingCard.phase] || sizingCard.phase },
    sizingCard.set_pressure_barg != null && { icon: Gauge, label: 'Set Pressure', value: `${sizingCard.set_pressure_barg} barg` },
    sizingCard.flow_kgh          != null && { icon: FlaskConical, label: 'Relief Flow', value: `${Number(sizingCard.flow_kgh).toLocaleString()} kg/h` },
    sizingCard.temp_C            != null && { icon: Thermometer, label: 'Temperature',  value: `${sizingCard.temp_C} °C` },
    sizingCard.A_in2             != null && { icon: null, label: 'Required Area',    value: `${Number(sizingCard.A_in2).toFixed(4)} in²`, highlight: true },
    sizingCard.orifice                   && { icon: null, label: 'API 526 Orifice',  value: sizingCard.orifice, highlight: true },
  ].filter(Boolean)

  return (
    <div className="mt-3 rounded-xl border border-green-500/25 bg-green-500/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-green-500/15">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-green-400 shrink-0"/>
          <div>
            <div className="text-2xs font-semibold text-green-300 uppercase tracking-wider">Sizing Result</div>
            <div className="text-xs text-slate-400 truncate max-w-[200px]">{sizingCard.service}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onDownload}
            disabled={downloading}
            title="Download Word report"
            className="flex items-center gap-1.5 text-2xs px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25
                       border border-blue-500/30 rounded-lg text-blue-300 hover:text-blue-200 transition-all disabled:opacity-50"
          >
            {downloading ? <RefreshCw size={10} className="animate-spin"/> : <Download size={10}/>}
            Report
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 text-2xs px-2.5 py-1.5 bg-green-500/15 hover:bg-green-500/25
                       border border-green-500/30 rounded-lg text-green-300 hover:text-green-200 transition-all"
          >
            <BookmarkPlus size={10}/>
            Save
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(({ icon: Icon, label, value, highlight }, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {Icon && <Icon size={10} className="text-slate-600 shrink-0"/>}
            <span className="text-2xs text-slate-500">{label}:</span>
            <span className={`text-2xs font-mono ${highlight ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {sizingCard.toolResult?.flow_regime && (
        <div className="px-3 pb-2 text-2xs text-slate-500">
          Flow: <span className="text-slate-300">{sizingCard.toolResult.flow_regime}</span>
          {sizingCard.toolResult.Kb != null && (
            <span className="ml-3">Kb: <span className="text-slate-300">{sizingCard.toolResult.Kb}</span></span>
          )}
          {sizingCard.utilisation_pct != null && (
            <span className="ml-3">Utilisation: <span className="text-blue-300">{Number(sizingCard.utilisation_pct).toFixed(1)}%</span></span>
          )}
        </div>
      )}

      {sizingCard.toolResult?.heat_input_kW != null && (
        <div className="px-3 pb-2 text-2xs text-slate-500">
          Fire heat input: <span className="text-slate-300">{sizingCard.toolResult.heat_input_kW} kW</span>
          {sizingCard.toolResult.wetted_area_ft2 != null && (
            <span className="ml-3">Wetted area: <span className="text-slate-300">{sizingCard.toolResult.wetted_area_ft2} ft²</span></span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Hydraulic power result ────────────────────────────────────────
function ToolResult({ toolResult }) {
  if (!toolResult || !toolResult.power_kW) return null
  return (
    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs font-mono">
      <div className="text-blue-400 font-semibold mb-2 uppercase tracking-wider text-2xs">Hydraulic Power</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-3/60 rounded p-2">
          <div className="text-slate-500 text-2xs uppercase">Power</div>
          <div className="text-blue-300 text-base font-bold">
            {toolResult.power_kW.toFixed(2)} <span className="text-xs font-normal text-slate-400">kW</span>
          </div>
        </div>
        <div className="bg-surface-3/60 rounded p-2">
          <div className="text-slate-500 text-2xs uppercase">Power</div>
          <div className="text-blue-300 text-base font-bold">
            {toolResult.power_hp.toFixed(2)} <span className="text-xs font-normal text-slate-400">HP</span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-slate-500">
        Q = {toolResult.flow_m3hr} m³/h · H = {toolResult.head_m} m · ρ = {toolResult.density_kgm3} kg/m³
      </div>
      <div className="mt-1 text-purple-400">{toolResult.formula}</div>
    </div>
  )
}

// ── Individual message ────────────────────────────────────────────
function Message({ msg, onSaveSizingCard, onDownloadReport }) {
  const [downloading, setDownloading] = useState(false)
  const isUser = msg.role === 'user'

  const handleDownload = async () => {
    if (!msg.sizingCard) return
    setDownloading(true)
    try {
      const payload = {
        service:       msg.sizingCard.service,
        phase:         msg.sizingCard.phase,
        scenario:      msg.sizingCard.scenario,
        P_set_barg:    msg.sizingCard.set_pressure_barg,
        P_rel_barg:    msg.sizingCard.toolResult?.relieving_pressure_barg,
        T_rel_C:       msg.sizingCard.temp_C,
        W_kgh:         msg.sizingCard.flow_kgh,
        MW:            msg.sizingCard.MW,
        k:             msg.sizingCard.k,
        Z:             msg.sizingCard.Z,
        A_in2:         msg.sizingCard.A_in2,
        orifice:       msg.sizingCard.orifice,
        orifice_size:  msg.sizingCard.selected_orifice_size,
        utilisation_pct: msg.sizingCard.utilisation_pct,
        toolResult:    msg.sizingCard.toolResult,
      }
      const response = await axios.post('/api/report', payload, { responseType: 'blob' })
      const url  = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', `PSV_Report_${Date.now()}.docx`)
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
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5
        ${isUser ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-blue-500/15 border border-blue-500/25'}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-purple-400"/>
          : <Bot  className="w-3.5 h-3.5 text-blue-400"/>
        }
      </div>
      <div className={`max-w-[84%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isUser && (
          <IntentBadge
            intent={msg.intent}
            toolCalled={msg.tool_called}
            contextUsed={msg.context_used}
            ragSources={msg.rag_sources}
          />
        )}
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed
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
                prose-ul:my-1 prose-ul:pl-4 prose-li:my-0 prose-li:text-slate-200
                prose-ol:my-1 prose-ol:pl-4
                prose-code:bg-slate-700/60 prose-code:text-blue-300 prose-code:px-1 prose-code:rounded prose-code:text-xs
                prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-600 prose-pre:rounded-lg prose-pre:p-3
                prose-blockquote:border-l-blue-500 prose-blockquote:text-slate-300
                prose-table:text-slate-200 prose-th:text-slate-100 prose-td:text-slate-300
                prose-hr:border-slate-600">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )
          }
        </div>
        {msg.toolResult && <ToolResult toolResult={msg.toolResult}/>}
        {msg.sizingCard && (
          <SizingCard
            sizingCard={msg.sizingCard}
            onSave={() => onSaveSizingCard(msg.sizingCard)}
            onDownload={handleDownload}
            downloading={downloading}
          />
        )}
        {msg.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            {msg.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-blue-500/15 border border-blue-500/25">
        <Bot className="w-3.5 h-3.5 text-blue-400"/>
      </div>
      <div className="bg-surface-2 border border-border-subtle rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
      </div>
    </div>
  )
}

// ── Main AI Query component ───────────────────────────────────────
export default function AIQuery() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your PSV Engineering AI Agent. I classify every query, call backend calculation tools for any numerical result, and use a knowledge base for standards and theory questions.\n\nAsk me to size a PSV, calculate hydraulic power, explain API 520/521, or troubleshoot valve problems.',
    }
  ])
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

    const userMsg    = { role: 'user', content: userText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const { data } = await axios.post('/api/ai-chat', { messages: apiMessages })
      if (data.ok) {
        setMessages(prev => [
          ...prev,
          {
            role:         'assistant',
            content:      data.reply,
            intent:       data.intent       || null,
            tool_called:  data.tool_called  || null,
            context_used: data.context_used || false,
            rag_sources:  data.rag_sources  || [],
            toolResult:   data.toolResult   || null,
            sizingCard:   data.sizingCard   || null,
          }
        ])
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sorry, something went wrong.', error: data.error }
        ])
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Network error'
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I ran into an error.', error: errMsg }
      ])
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
        <button
          onClick={clearChat}
          title="Clear chat"
          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-surface-3 rounded-md transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5"/>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <Message
            key={i}
            msg={msg}
            onSaveSizingCard={setSaveCard}
            onDownloadReport={() => {}}
          />
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
              <button
                key={i}
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="text-2xs px-2.5 py-1.5 bg-surface-3 hover:bg-surface-2 border border-border-subtle
                           hover:border-border-normal rounded-lg text-slate-400 hover:text-slate-200
                           transition-all disabled:opacity-50 text-left"
              >
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
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                       disabled:cursor-not-allowed rounded-xl flex items-center justify-center
                       transition-colors"
          >
            {loading
              ? <Loader2 className="w-4 h-4 text-white animate-spin"/>
              : <Send className="w-4 h-4 text-white"/>
            }
          </button>
        </div>
        <p className="text-2xs text-slate-700 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
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
