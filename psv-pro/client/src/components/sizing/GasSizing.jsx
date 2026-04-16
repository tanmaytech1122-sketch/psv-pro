import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { size } from '../../utils/api'
import { Field, NumberInput, Select, Card } from '../ui'
import { Zap, Save } from 'lucide-react'
import ResultPanel from '../results/ResultPanel'
import SaveCaseModal from '../projects/SaveCaseModal'

const DEFAULTS = {
  P_set:150, OP:10, P_back_total:0, T_rel:200,
  W:25000, MW:44.1, k:1.14, Z:0.95,
  Kd:0.975, valve_type:'conventional', Kc:1.0, inlet_dP:0,
}
const PRESETS = {
  propane:  { MW:44.1,  k:1.14, label:'Propane (C₃H₈)' },
  methane:  { MW:16.04, k:1.31, label:'Methane (CH₄)' },
  ethylene: { MW:28.05, k:1.24, label:'Ethylene (C₂H₄)' },
  co2:      { MW:44.01, k:1.30, label:'CO₂' },
  nitrogen: { MW:28.01, k:1.40, label:'Nitrogen (N₂)' },
  air:      { MW:28.97, k:1.40, label:'Air' },
  h2:       { MW:2.016, k:1.41, label:'Hydrogen (H₂)' },
  h2s:      { MW:34.08, k:1.32, label:'H₂S' },
}

export default function GasSizing() {
  const [form, setForm]     = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  const mutation = useMutation({ mutationFn: () => size.gas(form), onSuccess: setResult })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const num = k => e => set(k, parseFloat(e.target.value)||0)
  const str = k => e => set(k, e.target.value)
  const applyPreset = k => { const p=PRESETS[k]; if(p) setForm(f=>({...f,MW:p.MW,k:p.k})) }

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <Card title="Process Conditions">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Set Pressure" className="col-span-2"><NumberInput value={form.P_set} onChange={num('P_set')} unit="psig"/></Field>
            <Field label="Overpressure"><NumberInput value={form.OP} onChange={num('OP')} unit="%"/></Field>
            <Field label="Back Pressure"><NumberInput value={form.P_back_total} onChange={num('P_back_total')} unit="psig"/></Field>
            <Field label="Relief Temp." className="col-span-2"><NumberInput value={form.T_rel} onChange={num('T_rel')} unit="°F"/></Field>
            <Field label="Relief Rate" className="col-span-2"><NumberInput value={form.W} onChange={num('W')} unit="lb/hr"/></Field>
          </div>
        </Card>
        <Card title="Fluid Properties">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Fluid Preset" className="col-span-2">
              <Select defaultValue="" onChange={e => applyPreset(e.target.value)}>
                <option value="">— select preset —</option>
                {Object.entries(PRESETS).map(([k,p])=><option key={k} value={k}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Mol. Weight"><NumberInput value={form.MW} onChange={num('MW')} unit="lb/mol"/></Field>
            <Field label="k (Cp/Cv)"><NumberInput value={form.k} onChange={num('k')} step="0.01"/></Field>
            <Field label="Z Factor" className="col-span-2" hint={form.Z<0.80?'⚠ Low Z — near saturation':''}>
              <NumberInput value={form.Z} onChange={num('Z')} step="0.01"/>
            </Field>
          </div>
        </Card>
        <Card title="Valve Parameters">
          <div className="p-3 grid grid-cols-2 gap-2.5">
            <Field label="Valve Type" className="col-span-2">
              <Select value={form.valve_type} onChange={str('valve_type')}>
                <option value="conventional">Conventional</option>
                <option value="bellows">Balanced Bellows</option>
                <option value="pilot">Pilot Operated</option>
              </Select>
            </Field>
            <Field label="Kd"><NumberInput value={form.Kd} onChange={num('Kd')} step="0.001"/></Field>
            <Field label="Kc (RD)"><NumberInput value={form.Kc} onChange={num('Kc')} step="0.1"/></Field>
            <Field label="Inlet ΔP" className="col-span-2" hint="API 520 §3.3 inlet loss deduction">
              <NumberInput value={form.inlet_dP} onChange={num('inlet_dP')} unit="psi"/>
            </Field>
          </div>
        </Card>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1 h-10 text-sm font-semibold justify-center">
            {mutation.isPending ? <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="60" strokeDashoffset="45"/></svg>Calc…</span> : <span className="flex items-center gap-2"><Zap size={15}/>Calculate</span>}
          </button>
          {result && (
            <button onClick={() => setSaving(true)} className="btn-ghost h-10 px-3" title="Save to project">
              <Save size={15}/>
            </button>
          )}
        </div>
        {mutation.isError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {mutation.error?.error || 'Calculation failed'}
            {mutation.error?.details?.map(d=><div key={d.field} className="mt-1">• {d.message}</div>)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 bg-surface-1 rounded-lg border border-border-subtle overflow-y-auto">
        {result ? (
          <>
            <div className="px-4 py-2 border-b border-border-subtle bg-surface-2/50 text-2xs text-slate-500 uppercase tracking-wider font-medium">
              API 520 §3.6 — {result.isCrit ? 'Critical Flow (Eq.3)' : 'Subcritical Flow (Eq.4)'}
            </div>
            <ResultPanel result={result} phase="gas"/>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
            <div className="w-16 h-16 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center">
              <Zap size={24} className="text-slate-600"/>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Ready to calculate</p>
              <p className="text-xs text-slate-700 mt-1.5 max-w-48">API 520 §3.6 — critical and subcritical gas/vapour sizing</p>
            </div>
          </div>
        )}
      </div>
      {saving && (
        <SaveCaseModal
          phase="gas"
          inputs={form}
          results={result}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  )
}
