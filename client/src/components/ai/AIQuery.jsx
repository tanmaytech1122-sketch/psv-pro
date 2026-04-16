import { useState } from 'react'
import axios from 'axios'
import { Send, Sparkles, Calculator, Loader2 } from 'lucide-react'

export default function AIQuery() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [debug, setDebug] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    
    setLoading(true)
    setError(null)
    setResult(null)
    setDebug(null)
    
    try {
      const response = await axios.post('/api/size/ai-query', { query })
      if (response.data.ok) {
        setResult(response.data.result)
      } else {
        setError(response.data.error || 'Failed to process query')
        if (response.data.debug) {
          setDebug(response.data.debug)
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Network error. Is the backend running?'
      setError(errorMsg)
      if (err.response?.data?.debug) {
        setDebug(err.response.data.debug)
      }
    } finally {
      setLoading(false)
    }
  }

  const exampleQueries = [
    "calculate hydraulic power for flow 100 m3/h and head 50 m",
    "power for flow 250 m3/h and head 75 m",
    "hydraulic power 500 m3/h at 30 m head"
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/15 rounded-lg">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">AI Engineering Assistant</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Natural language queries for engineering calculations
            </p>
          </div>
        </div>

        {/* Input Card */}
        <div className="bg-surface-2 border border-border-subtle rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle bg-surface-1/50">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Ask anything</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Example: calculate hydraulic power for flow 100 m3/h and head 50 m"
                className="w-full px-3 py-2 bg-surface-3 border border-border-subtle rounded-lg
                           text-sm text-slate-100 placeholder:text-slate-600
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30
                           resize-none"
                rows="3"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute bottom-3 right-3 p-1.5 bg-purple-500/20 
                           border border-purple-500/30 rounded-md
                           hover:bg-purple-500/30 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                ) : (
                  <Send className="w-4 h-4 text-purple-400" />
                )}
              </button>
            </div>

            {/* Example queries */}
            <div className="flex flex-wrap gap-2">
              <span className="text-2xs text-slate-500 mt-1">Try:</span>
              {exampleQueries.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(ex)}
                  className="text-2xs px-2 py-0.5 bg-surface-3 border border-border-subtle 
                             rounded text-slate-400 hover:text-slate-200 hover:border-purple-500/30
                             transition-colors"
                >
                  {ex.length > 50 ? ex.substring(0, 50) + '...' : ex}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Error message with debug info */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400 font-medium mb-2">{error}</p>
            {debug && (
              <details className="text-xs text-slate-400 mt-2">
                <summary className="cursor-pointer hover:text-slate-300">Debug info</summary>
                <pre className="mt-2 p-2 bg-surface-3 rounded overflow-x-auto">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-surface-2 border border-border-subtle rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle bg-surface-1/50">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Results</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Query interpretation */}
              <div className="bg-surface-3/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border text-2xs font-semibold uppercase bg-purple-500/15 text-purple-400 border-purple-500/25">
                    Intent: {result.intent}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded border text-2xs font-semibold uppercase bg-blue-500/15 text-blue-400 border-blue-500/25">
                    Confidence: {(result.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500">Parameters:</span>{' '}
                  <code className="text-purple-300">
                    {JSON.stringify(result.parameters_used, null, 2)}
                  </code>
                </div>
              </div>

              {/* Calculation results */}
              <div>
                <h4 className="text-2xs font-semibold tracking-widest uppercase text-slate-500 pb-2 mb-3 border-b border-border-subtle">
                  Calculation Result
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-0.5 p-3 bg-surface-3/60 rounded-md">
                    <span className="text-2xs text-slate-500 uppercase tracking-wide">Power (kW)</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-xl font-semibold text-blue-400">
                        {result.calculation_result.power_kW.toFixed(2)}
                      </span>
                      <span className="text-2xs text-slate-500">kW</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 p-3 bg-surface-3/60 rounded-md">
                    <span className="text-2xs text-slate-500 uppercase tracking-wide">Power (HP)</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-xl font-semibold text-blue-400">
                        {result.calculation_result.power_hp.toFixed(2)}
                      </span>
                      <span className="text-2xs text-slate-500">HP</span>
                    </div>
                  </div>
                </div>
                
                {/* Formula */}
                <div className="mt-3 pt-3 border-t border-border-subtle">
                  <div className="text-2xs text-slate-500 mb-1">Formula</div>
                  <code className="text-xs text-purple-300 bg-surface-3 px-2 py-1 rounded">
                    {result.calculation_result.formula}
                  </code>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-surface-3/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Calculator className="w-3 h-3 text-slate-500 mt-0.5" />
                  <div className="text-xs text-slate-400">
                    {result.explanation}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}