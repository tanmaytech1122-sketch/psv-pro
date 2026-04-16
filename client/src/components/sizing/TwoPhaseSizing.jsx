import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Card } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function TwoPhaseSizing() {
  const [form, setForm] = useState({ P_set:150,OP:10,P_back_total:0,W:50000,T_rel:200,quality_x:0.15,rho_g:2.1,rho_l:30.5,lambda_BTUperlb:145,Cp_liq:0.61,Kd:0.975,Kc:1.0 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.twophase(form), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Two-Phase Conditions">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Set Pressure" className="col-span-2"><NumberInput value={form.P_set} onChange={num('P_set')} unit="psig"/></Field>
            <Field label="Overpressure"><NumberInput value={form.OP} onChange={num('OP')} unit="%"/></Field>
            <Field label="Back Pressure"><NumberInput value={form.P_back_total} onChange={num('P_back_total')} unit="psig"/></Field>
            <Field label="Relief Rate" className="col-span-2"><NumberInput value={form.W} onChange={num('W')} unit="lb/hr"/></Field>
            <Field label="Relief Temp."><NumberInput value={form.T_rel} onChange={num('T_rel')} unit="°F"/></Field>
            <Field label="Inlet Quality x₀"><NumberInput value={form.quality_x} onChange={num('quality_x')} step="0.01" min={0} max={1}/></Field>
          </div>
        </Card>
        <Card title="Phase Properties">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="ρ_gas"><NumberInput value={form.rho_g} onChange={num('rho_g')} unit="lb/ft³"/></Field>
            <Field label="ρ_liquid"><NumberInput value={form.rho_l} onChange={num('rho_l')} unit="lb/ft³"/></Field>
            <Field label="λ Latent Heat"><NumberInput value={form.lambda_BTUperlb} onChange={num('lambda_BTUperlb')} unit="BTU/lb"/></Field>
            <Field label="Cp_liq"><NumberInput value={form.Cp_liq} onChange={num('Cp_liq')} unit="BTU/lb·°F"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center">
          {mutation.isPending ? '…' : <span className="flex items-center gap-2"><Zap size={15}/>Calculate</span>}
        </button>
        {mutation.isError && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">{mutation.error?.error}</div>}
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="twophase"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 520 App C — Leung (1986) omega method</div>}
      </div>
    </div>
  )
}
