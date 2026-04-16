import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Select, Card } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function FireCase() {
  const [form, setForm] = useState({ P_set:150,D_ft:6,L_ft:20,liquid_level_pct:50,orientation:'vertical',F_factor:1.0,lambda_BTUperlb:149,T_rel:100,MW:44.1,k:1.14,Z:0.95 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.fire(form), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  const str = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Vessel Geometry">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Orientation" className="col-span-2"><Select value={form.orientation} onChange={str('orientation')}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="sphere">Sphere</option></Select></Field>
            <Field label="Diameter D"><NumberInput value={form.D_ft} onChange={num('D_ft')} unit="ft"/></Field>
            <Field label="Length L"><NumberInput value={form.L_ft} onChange={num('L_ft')} unit="ft"/></Field>
            <Field label="Liquid Level" className="col-span-2"><NumberInput value={form.liquid_level_pct} onChange={num('liquid_level_pct')} unit="%" min={0} max={100}/></Field>
          </div>
        </Card>
        <Card title="Fire Conditions">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Set Pressure" className="col-span-2"><NumberInput value={form.P_set} onChange={num('P_set')} unit="psig"/></Field>
            <Field label="F Factor" hint="0=insulated, 1=bare" className="col-span-2"><NumberInput value={form.F_factor} onChange={num('F_factor')} step="0.1" min={0} max={1}/></Field>
            <Field label="λ Latent Heat"><NumberInput value={form.lambda_BTUperlb} onChange={num('lambda_BTUperlb')} unit="BTU/lb"/></Field>
            <Field label="Relief Temp."><NumberInput value={form.T_rel} onChange={num('T_rel')} unit="°F"/></Field>
            <Field label="Mol. Weight"><NumberInput value={form.MW} onChange={num('MW')} unit="lb/mol"/></Field>
            <Field label="k ratio"><NumberInput value={form.k} onChange={num('k')} step="0.01"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center">
          {mutation.isPending ? '…' : <span className="flex items-center gap-2"><Zap size={15}/>Calculate</span>}
        </button>
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="fire"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 521 §5.15 — Q = 21,000·F·Aw^0.82</div>}
      </div>
    </div>
  )
}
