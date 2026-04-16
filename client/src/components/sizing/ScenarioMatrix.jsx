import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Card, Badge, Spinner, SectionTitle, Empty } from '../ui'
import { Plus, Trash2, Zap, Crown, BarChart2 } from 'lucide-react'

// ── Scenario types and defaults ────────────────────────────────────
const SCENARIO_TYPES = [
  { id: 'blocked_outlet', label: 'Blocked Outlet',      phase: 'gas'    },
  { id: 'fire',           label: 'External Fire',       phase: 'fire'   },
  { id: 'tube_rupture',   label: 'Tube Rupture',        phase: 'gas'    },
  { id: 'thermal',        label: 'Thermal Expansion',   phase: 'liquid' },
  { id: 'reflux_failure', label: 'Reflux Failure',      phase: 'gas'    },
  { id: 'cooling_failure',label: 'Cooling Water Failure',phase: 'gas'   },
  { id: 'custom',         label: 'Custom',              phase: 'gas'    },
]

const INITIAL_ROW = {
  id: Date.now(),
  scenario: 'blocked_outlet',
  label: 'Blocked Outlet',
  W: 25000, P_set: 150, OP: 10, P_back: 0,
  T_rel: 200, MW: 44.1, k: 1.14, Z: 0.95,
  Kd: 0.975, result: null, loading: false,
}

function n(v) { return parseFloat(v) || 0 }

// ── Single scenario row ────────────────────────────────────────────
function ScenarioRow({ row, onChange, onDelete, onCalculate }) {
  const isGoverning = row.isGoverning

  return (
    <tr className={`border-b border-border-subtle group
      ${isGoverning ? 'bg-blue-500/5' : 'hover:bg-surface-3/30'}`}>
      <td className="py-2 px-3">
        {isGoverning && (
          <Crown size={12} className="text-amber-400" title="Governing scenario"/>
        )}
      </td>
      <td className="py-2 px-3">
        <input
          type="text"
          value={row.label}
          onChange={e => onChange('label', e.target.value)}
          className="w-36 h-7 px-2 bg-transparent border border-transparent hover:border-border-subtle
                     focus:border-blue-500 rounded text-xs text-slate-200 outline-none"
        />
      </td>
      <td className="py-2 px-3">
        <input type="number" value={row.W} onChange={e => onChange('W', n(e.target.value))}
               className="w-20 h-7 px-2 bg-surface-3 border border-border-subtle rounded text-xs font-mono outline-none focus:border-blue-500"/>
      </td>
      <td className="py-2 px-3">
        <input type="number" value={row.P_set} onChange={e => onChange('P_set', n(e.target.value))}
               className="w-16 h-7 px-2 bg-surface-3 border border-border-subtle rounded text-xs font-mono outline-none focus:border-blue-500"/>
      </td>
      <td className="py-2 px-3">
        <input type="number" value={row.T_rel} onChange={e => onChange('T_rel', n(e.target.value))}
               className="w-16 h-7 px-2 bg-surface-3 border border-border-subtle rounded text-xs font-mono outline-none focus:border-blue-500"/>
      </td>
      <td className="py-2 px-3">
        <input type="number" value={row.MW} onChange={e => onChange('MW', n(e.target.value))}
               className="w-14 h-7 px-2 bg-surface-3 border border-border-subtle rounded text-xs font-mono outline-none focus:border-blue-500"/>
      </td>

      {/* Result columns */}
      <td className="py-2 px-3 font-mono text-xs">
        {row.loading ? <Spinner size={12}/> :
         row.result ? (
           <span className={`font-semibold ${isGoverning ? 'text-amber-300' : 'text-slate-200'}`}>
             {row.result.A_in2?.toFixed(4)}
           </span>
         ) : <span className="text-slate-700">—</span>}
      </td>
      <td className="py-2 px-3">
        {row.result?.orifice ? (
          <span className={`font-mono font-bold text-sm ${isGoverning ? 'text-amber-300' : 'text-blue-300'}`}>
            {row.result.orifice.d}
          </span>
        ) : <span className="text-slate-700">—</span>}
      </td>
      <td className="py-2 px-3">
        {row.result?.isCrit !== undefined ? (
          <Badge variant={row.result.isCrit ? 'pass' : 'warn'}>
            {row.result.isCrit ? 'Critical' : 'Subcrit'}
          </Badge>
        ) : <span className="text-slate-700">—</span>}
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onCalculate} className="btn-primary h-6 px-2 text-2xs gap-1">
            <Zap size={10}/>Run
          </button>
          <button onClick={onDelete} className="p-1 text-slate-700 hover:text-red-400 transition-colors">
            <Trash2 size={12}/>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main Scenario Matrix ───────────────────────────────────────────
export default function ScenarioMatrix() {
  const [rows, setRows] = useState([
    { ...INITIAL_ROW, id: 1, label: 'Blocked Outlet',       W: 25000 },
    { ...INITIAL_ROW, id: 2, label: 'Cooling Water Failure', W: 18000, T_rel: 350 },
    { ...INITIAL_ROW, id: 3, label: 'Reflux Failure',        W: 32000, T_rel: 180 },
  ])
  const [running, setRunning] = useState(false)

  const updateRow = (id, key, val) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [key]: val, result: null } : r))

  const deleteRow = (id) => setRows(rs => rs.filter(r => r.id !== id))

  const addRow = () =>
    setRows(rs => [...rs, { ...INITIAL_ROW, id: Date.now(), label: `Scenario ${rs.length + 1}`, result: null }])

  const calcRow = async (id) => {
    const row = rows.find(r => r.id === id)
    setRows(rs => rs.map(r => r.id === id ? { ...r, loading: true } : r))
    try {
      const result = await size.gas({
        P_set: row.P_set, OP: row.OP, P_back_total: row.P_back,
        T_rel: row.T_rel, W: row.W, MW: row.MW, k: row.k,
        Z: row.Z, Kd: row.Kd, valve_type: 'conventional', Kc: 1,
      })
      setRows(rs => {
        const updated = rs.map(r => r.id === id ? { ...r, loading: false, result } : r)
        // Mark governing scenario (max area)
        const maxA = Math.max(...updated.filter(r => r.result?.A_in2).map(r => r.result.A_in2))
        return updated.map(r => ({ ...r, isGoverning: r.result?.A_in2 === maxA && maxA > 0 }))
      })
    } catch {
      setRows(rs => rs.map(r => r.id === id ? { ...r, loading: false } : r))
    }
  }

  const calcAll = async () => {
    setRunning(true)
    await Promise.all(rows.map(r => calcRow(r.id)))
    setRunning(false)
  }

  const governing = rows.filter(r => r.isGoverning)[0]
  const calculated = rows.filter(r => r.result)

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Scenario Matrix</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Compare all relief scenarios — identify the governing (maximum area) case
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={addRow} className="btn-ghost gap-2">
            <Plus size={13}/>Add Scenario
          </button>
          <button onClick={calcAll} disabled={running} className="btn-primary gap-2">
            {running ? <Spinner size={13}/> : <Zap size={13}/>}
            Calculate All
          </button>
        </div>
      </div>

      {/* Governing case banner */}
      {governing && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg flex-shrink-0">
          <Crown size={16} className="text-amber-400 flex-shrink-0"/>
          <div className="flex-1">
            <span className="text-xs font-semibold text-amber-300">Governing: {governing.label}</span>
            <span className="text-xs text-slate-500 ml-3">
              A = {governing.result?.A_in2?.toFixed(4)} in² · Orifice {governing.result?.orifice?.d} ({governing.result?.orifice?.in_sz})
            </span>
          </div>
          <Badge variant="warn">Governing</Badge>
        </div>
      )}

      {/* Matrix table */}
      <Card className="flex-shrink-0 overflow-x-auto">
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-3/50">
              <th className="w-6 py-2 px-3"/>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">Scenario</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">W (lb/hr)</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">P_set (psig)</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">T (°F)</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">MW</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">A_req (in²)</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">Orifice</th>
              <th className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold">Flow</th>
              <th className="py-2 px-3 w-24"/>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <ScenarioRow
                key={row.id}
                row={row}
                onChange={(k, v) => updateRow(row.id, k, v)}
                onDelete={() => deleteRow(row.id)}
                onCalculate={() => calcRow(row.id)}
              />
            ))}
          </tbody>
        </table>
      </Card>

      {/* Summary bar chart */}
      {calculated.length > 1 && (
        <Card title="Area Comparison" className="flex-shrink-0">
          <div className="p-4">
            <div className="space-y-2">
              {[...calculated]
                .sort((a, b) => (b.result?.A_in2 || 0) - (a.result?.A_in2 || 0))
                .map(r => {
                  const maxA = Math.max(...calculated.map(c => c.result?.A_in2 || 0))
                  const pct  = ((r.result?.A_in2 || 0) / maxA * 100).toFixed(1)
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-40 truncate">{r.label}</span>
                      <div className="flex-1 h-5 bg-surface-3 rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all duration-500
                            ${r.isGoverning ? 'bg-amber-500/60' : 'bg-blue-500/40'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-300 w-20 text-right">
                        {r.result?.A_in2?.toFixed(4)} in²
                      </span>
                      {r.isGoverning && <Crown size={12} className="text-amber-400"/>}
                    </div>
                  )
                })}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
