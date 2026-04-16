import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Select, Card } from '../ui'
import { Zap } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'

export default function BlowdownPage() {
  const [mode, setMode] = useState('o')
  const [form, setForm] = useState({ V:200,P0g:300,Ptg:100,T0F:150,MW:44.1,k:1.14,Z:0.92,mode:'o',A:3.6,Kd:0.61,Cv:'',vt:'globe',Qf:0,td:0,MDMT:-20 })
  const [result, setResult] = useState(null)
  const mutation = useMutation({ mutationFn: () => size.blowdown({...form,mode}), onSuccess: setResult })
  const num = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value)||0 }))
  const str = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Vessel">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Volume V"><NumberInput value={form.V} onChange={num('V')} unit="ft³"/></Field>
            <Field label="Initial P"><NumberInput value={form.P0g} onChange={num('P0g')} unit="psig"/></Field>
            <Field label="Target P"><NumberInput value={form.Ptg} onChange={num('Ptg')} unit="psig"/></Field>
            <Field label="Initial T"><NumberInput value={form.T0F} onChange={num('T0F')} unit="°F"/></Field>
            <Field label="Mol. Weight"><NumberInput value={form.MW} onChange={num('MW')} unit="lb/mol"/></Field>
            <Field label="k ratio"><NumberInput value={form.k} onChange={num('k')} step="0.01"/></Field>
            <Field label="Z Factor"><NumberInput value={form.Z} onChange={num('Z')} step="0.01"/></Field>
            <Field label="MDMT"><NumberInput value={form.MDMT} onChange={num('MDMT')} unit="°F"/></Field>
          </div>
        </Card>
        <Card title="BDV / Orifice">
          <div className="p-3 space-y-2.5">
            <div className="flex rounded overflow-hidden border border-border-subtle text-xs">
              {[['o','PSV Orifice'],['c','Control Valve']].map(([m,l])=>(
                <button key={m} onClick={()=>setMode(m)} className={`flex-1 py-1.5 font-medium transition-colors ${mode===m?'bg-blue-500/20 text-blue-300':'text-slate-500 hover:text-slate-300'}`}>{l}</button>
              ))}
            </div>
            {mode==='o' ? <>
              <Field label="Orifice Area A"><NumberInput value={form.A} onChange={num('A')} unit="in²"/></Field>
              <Field label="Kd"><NumberInput value={form.Kd} onChange={num('Kd')} step="0.01"/></Field>
            </> : <>
              <Field label="Cv"><NumberInput value={form.Cv} onChange={num('Cv')} placeholder="leave blank to autosize"/></Field>
              <Field label="Valve type"><Select value={form.vt} onChange={str('vt')}><option value="globe">Globe (Xt=0.72)</option><option value="ball">Ball (Xt=0.55)</option><option value="butterfly">Butterfly (Xt=0.35)</option></Select></Field>
            </>}
            <Field label="Fire Heat Qf"><NumberInput value={form.Qf} onChange={num('Qf')} unit="BTU/hr"/></Field>
            <Field label="Delay td"><NumberInput value={form.td} onChange={num('td')} unit="s"/></Field>
          </div>
        </Card>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full h-10 text-sm font-semibold justify-center">
          {mutation.isPending ? '…' : <span className="flex items-center gap-2"><Zap size={15}/>Run Blowdown</span>}
        </button>
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? <ResultPanel result={result} phase="blowdown"/> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">API 521 §5.6 — isentropic ODE with MDMT check</div>}
      </div>
    </div>
  )
}
