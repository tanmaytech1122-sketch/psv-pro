import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Card, SectionTitle } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function TubeRupturePage() {
  const [form, setForm] = useState({ OD_in:0.75,wall_t_in:0.083,n_tubes:2,Kd:0.61,P_HP:600,T_HP:400,MW_HP:28,k_HP:1.30,P_LP:150,T_LP:200,MW_LP:44.1,k_LP:1.14 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.tuberupture(form), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Tube Geometry">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="OD"><NumberInput value={form.OD_in} onChange={num('OD_in')} unit="in"/></Field>
            <Field label="Wall t"><NumberInput value={form.wall_t_in} onChange={num('wall_t_in')} unit="in"/></Field>
            <Field label="No. tubes"><NumberInput value={form.n_tubes} onChange={num('n_tubes')} min={1}/></Field>
            <Field label="Kd"><NumberInput value={form.Kd} onChange={num('Kd')} step="0.01"/></Field>
          </div>
        </Card>
        <Card title="HP Side">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="P_HP psig"><NumberInput value={form.P_HP} onChange={num('P_HP')} unit="psig"/></Field>
            <Field label="T_HP °F"><NumberInput value={form.T_HP} onChange={num('T_HP')} unit="°F"/></Field>
            <Field label="MW_HP"><NumberInput value={form.MW_HP} onChange={num('MW_HP')}/></Field>
            <Field label="k_HP"><NumberInput value={form.k_HP} onChange={num('k_HP')} step="0.01"/></Field>
          </div>
        </Card>
        <Card title="LP Side">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="P_LP psig"><NumberInput value={form.P_LP} onChange={num('P_LP')} unit="psig"/></Field>
            <Field label="T_LP °F"><NumberInput value={form.T_LP} onChange={num('T_LP')} unit="°F"/></Field>
            <Field label="MW_LP"><NumberInput value={form.MW_LP} onChange={num('MW_LP')}/></Field>
            <Field label="k_LP"><NumberInput value={form.k_LP} onChange={num('k_LP')} step="0.01"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center"><span className="flex items-center gap-2"><Zap size={15}/>Calculate</span></button>
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="tuberupture"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 521 §5.19 — two-thirds pressure rule</div>}
      </div>
    </div>
  )
}
