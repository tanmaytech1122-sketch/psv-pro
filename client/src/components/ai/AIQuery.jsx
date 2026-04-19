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
  AlertCircle, ChevronDown
} from 'lucide-react'

const EXAMPLE_QUERIES = [
  'Design a PSV for a propane gas system, set pressure 10 barg',
  'Calculate hydraulic power for flow 200 m3/h and head 40 m',
  'Size a PSV for steam: 5000 kg/h, 150°C, 8 barg set pressure',
  'Explain the difference between API 520 and API 521',
  'What is the back pressure correction factor Kb?',
]

// ── Phase label map ───────────────────────────────────────────────
const PHASE_LABELS = {
  gas: 'Gas / Vapour', steam: 'Steam', liquid: 'Liquid',
  twophase: 'Two-Phase', fire: 'Fire Case', thermal: 'Thermal',
  tuberupture: 'Tube Rupture', blowdown: 'Blowdown',
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
        service:            card.service,
        set_pressure_barg:  card.set_pressure_barg,
        set_pressure_psig:  card.set_pressure_psig,
        temp_C:             card.temp_C,
        flow_kgh:           card.flow_kgh,
        MW:                 card.MW,
        k:                  card.k,
        Z:                  card.Z,
        assumptions:        card.assumptions,
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
        notes:    card.notes || card.assumptions || '',
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

        {/* Header */}
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

          {/* Sizing summary preview */}
          <div className="bg-surface-3 border border-border-subtle rounded-lg p-3 space-y-1.5 text-xs">
            <div className="text-slate-400 font-medium mb-2">{sizingCard.service}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-500">
              <span>Phase: <span className="text-slate-300">{PHASE_LABELS[sizingCard.phase] || sizingCard.phase}</span></span>
              {sizingCard.set_pressure_barg != null && (
                <span>P_set: <span className="text-slate-300">{sizingCard.set_pressure_barg} barg</span></span>
              )}
              {sizingCard.flow_kgh != null && (
                <span>Flow: <span className="text-slate-300">{sizingCard.flow_kgh.toLocaleString()} kg/h</span></span>
              )}
              {sizingCard.temp_C != null && (
                <span>Temp: <span className="text-slate-300">{sizingCard.temp_C}°C</span></span>
              )}
              {sizingCard.A_in2 != null && (
                <span>A_req: <span className="text-blue-300 font-mono">{sizingCard.A_in2.toFixed(4)} in²</span></span>
              )}
              {sizingCard.orifice && (
                <span>Orifice: <span className="text-blue-300 font-bold">{sizingCard.orifice}</span></span>
              )}
            </div>
          </div>

          {/* Tag */}
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

          {/* Scenario */}
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

          {/* Project selector */}
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
                      {(p.plant || p.unit) && (
                        <span className="text-2xs text-slate-600">
                          {[p.plant, p.unit].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="text-2xs text-slate-600 shrink-0">{p.case_count} cases</span>
                  </label>
                ))}
              </div>
            )}

            {/* New project inline */}
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

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 justify-end border-t border-border-subtle pt-4">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button
            onClick={() => saveCase.mutate()}
            disabled={!selectedPid || saveCase.isPending}
            className="btn-primary gap-2 text-xs"
          >
            {saveCase.isPending
              ? <RefreshCw size={12} className="animate-spin"/>
              : <Save size={12}/>
            }
            Save Case
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sizing Card (appears inline in chat) ──────────────────────────
function SizingCard({ sizingCard, onSave }) {
  const [expanded, setExpanded] = useState(false)

  const rows = [
    sizingCard.phase        && { icon: Wind,        label: 'Phase',    value: PHASE_LABELS[sizingCard.phase] || sizingCard.phase, highlight: false },
    sizingCard.set_pressure_barg != null && { icon: Gauge, label: 'Set Pressure', value: `${sizingCard.set_pressure_barg} barg`, highlight: false },
    sizingCard.set_pressure_psig != null && !sizingCard.set_pressure_barg && { icon: Gauge, label: 'Set Pressure', value: `${sizingCard.set_pressure_psig} psig`, highlight: false },
    sizingCard.flow_kgh     != null && { icon: FlaskConical, label: 'Relief Flow', value: `${Number(sizingCard.flow_kgh).toLocaleString()} kg/h`, highlight: false },
    sizingCard.temp_C       != null && { icon: Thermometer, label: 'Temperature', value: `${sizingCard.temp_C}°C`, highlight: false },
    sizingCard.A_in2        != null && { icon: null, label: 'Required Area', value: `${Number(sizingCard.A_in2).toFixed(4)} in²`, highlight: true },
    sizingCard.orifice           && { icon: null, label: 'API 526 Orifice', value: sizingCard.orifice, highlight: true },
  ].filter(Boolean)

  return (
    <div className="mt-3 rounded-xl border border-green-500/25 bg-green-500/5 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-green-500/15">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-green-400 shrink-0"/>
          <div>
            <div className="text-2xs font-semibold text-green-300 uppercase tracking-wider">Sizing Summary</div>
            <div className="text-xs text-slate-400 truncate max-w-[240px]">{sizingCard.service}</div>
          </div>
        </div>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 text-2xs px-2.5 py-1.5 bg-green-500/15 hover:bg-green-500/25
                     border border-green-500/30 rounded-lg text-green-300 hover:text-green-200 transition-all"
        >
          <BookmarkPlus size={11}/>
          Save to Project
        </button>
      </div>

      {/* Key values grid */}
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

      {/* Assumptions (expandable) */}
      {sizingCard.assumptions && (
        <div className="border-t border-green-500/10">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-2xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            <AlertCircle size={10}/>
            Assumptions
            <ChevronDown size={10} className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
          {expanded && (
            <div className="px-3 pb-2.5 text-2xs text-slate-500 leading-relaxed">
              {sizingCard.assumptions}
              {sizingCard.notes && sizingCard.notes !== sizingCard.assumptions && (
                <div className="mt-1 text-slate-600">{sizingCard.notes}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tool Result (hydraulic power) ─────────────────────────────────
function ToolResult({ toolResult }) {
  if (!toolResult || toolResult.type !== 'hydraulic_power') return null
  return (
    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs font-mono">
      <div className="text-blue-400 font-semibold mb-2 uppercase tracking-wider text-2xs">Calculation</div>
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
function Message({ msg, onSaveSizingCard }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5
        ${isUser ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-blue-500/15 border border-blue-500/25'}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-purple-400"/>
          : <Bot className="w-3.5 h-3.5 text-blue-400"/>
        }
      </div>
      <div className={`max-w-[82%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
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
                prose-blockquote:border-l-blue-500 prose-blockquote:text-slate-300 prose-blockquote:italic
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
      content: 'Hello! I\'m your AI engineering assistant. Ask me anything — PSV sizing, API standards, fluid properties, or engineering calculations. I\'ll give you real answers with assumptions stated, not just more questions.',
    }
  ])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [saveCard, setSaveCard]     = useState(null)
  const bottomRef                   = useRef(null)
  const textareaRef                 = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    const userMsg = { role: 'user', content: userText }
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
            role: 'assistant',
            content: data.reply,
            toolResult: data.toolResult || null,
            sizingCard: data.sizingCard  || null,
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
            <h1 className="text-sm font-semibold text-slate-100">AI Engineering Assistant</h1>
            <p className="text-2xs text-slate-500">Powered by Gemini · Ask anything</p>
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
            onSaveSizingCard={(card) => setSaveCard(card)}
          />
        ))}
        {loading && <TypingIndicator/>}
        <div ref={bottomRef}/>
      </div>

      {/* Example queries (only when just the welcome message) */}
      {messages.length === 1 && !loading && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-2xs px-2.5 py-1 bg-surface-2 border border-border-subtle rounded-full
                         text-slate-400 hover:text-slate-200 hover:border-purple-500/40 transition-colors"
            >
              {q.length > 55 ? q.slice(0, 55) + '…' : q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-border-subtle">
        <div className="flex gap-2 items-end bg-surface-2 border border-border-subtle rounded-xl p-2
                        focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600
                       resize-none outline-none min-h-[24px] max-h-[120px] leading-6 py-0.5"
            style={{ height: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 p-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40
                       disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {loading
              ? <Loader2 className="w-4 h-4 text-white animate-spin"/>
              : <Send className="w-4 h-4 text-white"/>
            }
          </button>
        </div>
        <div className="text-2xs text-slate-600 text-center mt-1.5">
          AI can make mistakes — verify critical engineering calculations independently
        </div>
      </div>

      {/* Save to Project modal */}
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
