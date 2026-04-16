import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Card } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function API2000Page() {
  const [form, setForm] = useState({ capacity_bbl:50000, flash_F:80, fill_gpm:500, pumpout_gpm:0 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.api2000(form), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Tank Parameters">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Capacity" className="col-span-2"><NumberInput value={form.capacity_bbl} onChange={num('capacity_bbl')} unit="bbl"/></Field>
            <Field label="Flash Point" className="col-span-2" hint="< 100°F = volatile (12 SCFH/BPH)"><NumberInput value={form.flash_F} onChange={num('flash_F')} unit="°F"/></Field>
            <Field label="Fill Rate"><NumberInput value={form.fill_gpm} onChange={num('fill_gpm')} unit="GPM"/></Field>
            <Field label="Pump-out Rate"><NumberInput value={form.pumpout_gpm} onChange={num('pumpout_gpm')} unit="GPM"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center"><span className="flex items-center gap-2"><Zap size={15}/>Calculate</span></button>
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="api2000"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 2000 7th Ed. §4 — thermal + movement breathing</div>}
      </div>
    </div>
  )
}
