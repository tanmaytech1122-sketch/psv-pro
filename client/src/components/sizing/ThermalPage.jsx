import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Card } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function ThermalPage() {
  const [form, setForm] = useState({ Q_BTUhr:500000, beta:0.00056, SG:1.0, Cp_BTUperlbF:1.0, P_set:250, P_back:0, Kd:0.65, Kc:1.0 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.thermal(form), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Thermal Input">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Heat Input Q" className="col-span-2"><NumberInput value={form.Q_BTUhr} onChange={num('Q_BTUhr')} unit="BTU/hr"/></Field>
            <Field label="β (1/°F)"><NumberInput value={form.beta} onChange={num('beta')} step="0.00001"/></Field>
            <Field label="SG"><NumberInput value={form.SG} onChange={num('SG')} step="0.01"/></Field>
            <Field label="Cp"><NumberInput value={form.Cp_BTUperlbF} onChange={num('Cp_BTUperlbF')} unit="BTU/lb·°F"/></Field>
            <Field label="P_set"><NumberInput value={form.P_set} onChange={num('P_set')} unit="psig"/></Field>
            <Field label="P_back"><NumberInput value={form.P_back} onChange={num('P_back')} unit="psig"/></Field>
            <Field label="Kd"><NumberInput value={form.Kd} onChange={num('Kd')} step="0.01"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center"><span className="flex items-center gap-2"><Zap size={15}/>Calculate</span></button>
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="thermal"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 521 §5.20 — Q = β·Q_heat/(500·SG·Cp)</div>}
      </div>
    </div>
  )
}
