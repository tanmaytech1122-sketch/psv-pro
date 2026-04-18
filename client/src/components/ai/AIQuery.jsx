import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Send, Sparkles, Loader2, User, Bot, Calculator, RotateCcw } from 'lucide-react'

const EXAMPLE_QUERIES = [
  'What is pump cavitation and how does it affect PSV sizing?',
  'Calculate hydraulic power for flow 200 m3/h and head 40 m',
  'Explain the difference between API 520 and API 521',
  'Design a PSV for a hydrocarbon gas system',
  'What is the back pressure correction factor Kb?',
]

function ToolResult({ toolResult }) {
  if (!toolResult || toolResult.type !== 'hydraulic_power') return null
  return (
    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs font-mono">
      <div className="text-blue-400 font-semibold mb-2 uppercase tracking-wider text-2xs">Calculation</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-3/60 rounded p-2">
          <div className="text-slate-500 text-2xs uppercase">Power</div>
          <div className="text-blue-300 text-base font-bold">{toolResult.power_kW.toFixed(2)} <span className="text-xs font-normal text-slate-400">kW</span></div>
        </div>
        <div className="bg-surface-3/60 rounded p-2">
          <div className="text-slate-500 text-2xs uppercase">Power</div>
          <div className="text-blue-300 text-base font-bold">{toolResult.power_hp.toFixed(2)} <span className="text-xs font-normal text-slate-400">HP</span></div>
        </div>
      </div>
      <div className="mt-2 text-slate-500">
        Q = {toolResult.flow_m3hr} m³/h · H = {toolResult.head_m} m · ρ = {toolResult.density_kgm3} kg/m³
      </div>
      <div className="mt-1 text-purple-400">{toolResult.formula}</div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5
        ${isUser ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-blue-500/15 border border-blue-500/25'}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-purple-400" />
          : <Bot className="w-3.5 h-3.5 text-blue-400" />
        }
      </div>
      <div className={`max-w-[80%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-purple-500/15 border border-purple-500/20 text-slate-100 rounded-tr-sm'
            : 'bg-surface-2 border border-border-subtle text-slate-200 rounded-tl-sm'
          }`}>
          {msg.content}
        </div>
        {msg.toolResult && <ToolResult toolResult={msg.toolResult} />}
        {msg.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            {msg.error}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-blue-500/15 border border-blue-500/25">
        <Bot className="w-3.5 h-3.5 text-blue-400" />
      </div>
      <div className="bg-surface-2 border border-border-subtle rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

export default function AIQuery() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI engineering assistant for PSV Pro. Ask me anything — engineering concepts, PSV sizing guidance, or calculations like hydraulic power.',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

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

    // Build history for API (exclude tool metadata, only role+content)
    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))

    try {
      const { data } = await axios.post('/api/ai-chat', { messages: apiMessages })
      if (data.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.reply, toolResult: data.toolResult || null }
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
      content: 'Chat cleared. What would you like to know?',
    }])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-1/60 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-500/15 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-400" />
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
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Example queries (only show when just the welcome message exists) */}
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
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
        <div className="text-2xs text-slate-600 text-center mt-1.5">
          AI can make mistakes — verify critical engineering calculations
        </div>
      </div>
    </div>
  )
}
