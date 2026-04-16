import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Select, Card } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function LiquidSizing() {
  const [form, setForm] = useState({ P_set:300, OP:10, P_back_total:30, W:45000, rho_lbft3:52.3, visc_cp:1.0, Kd:0.65, valve_type:'conventional', Kc:1.0 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.liquid(form), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  const str = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Liquid Conditions">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Set Pressure" className="col-span-2"><NumberInput value={form.P_set} onChange={num('P_set')} unit="psig"/></Field>
            <Field label="Overpressure"><NumberInput value={form.OP} onChange={num('OP')} unit="%"/></Field>
            <Field label="Back Pressure"><NumberInput value={form.P_back_total} onChange={num('P_back_total')} unit="psig"/></Field>
            <Field label="Relief Rate" className="col-span-2"><NumberInput value={form.W} onChange={num('W')} unit="lb/hr"/></Field>
            <Field label="Density"><NumberInput value={form.rho_lbft3} onChange={num('rho_lbft3')} unit="lb/ft³"/></Field>
            <Field label="Viscosity"><NumberInput value={form.visc_cp} onChange={num('visc_cp')} unit="cP"/></Field>
          </div>
        </Card>
        <Card title="Valve Parameters">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Valve Type" className="col-span-2"><Select value={form.valve_type} onChange={str('valve_type')}><option value="conventional">Conventional — Kw=1.0</option><option value="bellows">Balanced Bellows</option><option value="pilot">Pilot</option></Select></Field>
            <Field label="Kd"><NumberInput value={form.Kd} onChange={num('Kd')} step="0.001"/></Field>
            <Field label="Kc"><NumberInput value={form.Kc} onChange={num('Kc')} step="0.1"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center">
          {mutation.isPending ? '…' : <span className="flex items-center gap-2"><Zap size={15}/>Calculate</span>}
        </button>
        {mutation.isError && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">{mutation.error?.error}</div>}
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="liquid"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 520 §3.8 — liquid service with Kw correction</div>}
      </div>
    </div>
  )
}
