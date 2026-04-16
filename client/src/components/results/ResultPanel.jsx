import { Metric, Badge, OrificeChip, ComplianceRow, SectionTitle, Card } from '../ui'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ── Main result renderer ───────────────────────────────────────────
export default function ResultPanel({ result, phase }) {
  if (!result) return <EmptyResult/>

  const renderers = {
    gas:         GasResult,
    steam:       SteamResult,
    liquid:      LiquidResult,
    twophase:    TwoPhaseResult,
    fire:        FireResult,
    blowdown:    BlowdownResult,
    thermal:     ThermalResult,
    tuberupture: TubeRuptureResult,
    api2000:     API2000Result,
    reaction:    ReactionResult,
  }

  const Renderer = renderers[phase] || GenericResult
  return <Renderer result={result}/>
}

// ── Empty placeholder ──────────────────────────────────────────────
function EmptyResult() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
      <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center">
        <Info size={20} className="text-slate-600"/>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">No results yet</p>
        <p className="text-xs text-slate-700 mt-1">Fill in the inputs and click Calculate</p>
      </div>
    </div>
  )
}

// ── Orifice selection header ───────────────────────────────────────
function OrificeHeader({ orifice, A_in2 }) {
  if (!orifice) return null
  return (
    <div className="flex items-center gap-4 p-4 bg-surface-3/40 border-b border-border-subtle">
      <OrificeChip designation={orifice.d} size_label={orifice.in_sz}/>
      <div className="flex-1">
        <div className="text-xl font-mono font-bold text-slate-100">
          {A_in2?.toFixed(4)} <span className="text-sm text-slate-500 font-normal">in²</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          Required: {A_in2?.toFixed(4)} in² &nbsp;|&nbsp; Orifice: {orifice.a} in² &nbsp;|&nbsp;
          Utilisation: {orifice.cap_pct?.toFixed(1)}%
        </div>
        <div className="flex gap-2 mt-1.5">
          {orifice.is_multi  && <Badge variant="fail">Multiple valves required</Badge>}
          {orifice.is_chatter&& <Badge variant="warn">Chatter risk &lt;30%</Badge>}
          {orifice.is_knife  && <Badge variant="warn">High utilisation &gt;90%</Badge>}
          {!orifice.is_multi && !orifice.is_chatter && !orifice.is_knife &&
            <Badge variant="pass">Orifice OK</Badge>}
        </div>
      </div>
    </div>
  )
}

// ── Gas result ─────────────────────────────────────────────────────
function GasResult({ result }) {
  const { A_in2, orifice, isCrit, Kb, C, P1_psia, P2_psia, z_warn, lp_warn, F2 } = result
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Required Area"  value={A_in2?.toFixed(4)}    unit="in²"  highlight="blue"/>
        <Metric label="Flow Regime"    value={isCrit?'Critical':'Subcritical'}
                highlight={isCrit?'pass':'warn'}/>
        <Metric label="P₁ Relieving"   value={P1_psia?.toFixed(2)}   unit="psia"/>
        <Metric label="P₂ Back Press." value={P2_psia?.toFixed(2)}   unit="psia"/>
        <Metric label="Kb Back-press." value={Kb?.toFixed(4)}/>
        <Metric label="C Coefficient"  value={C?.toFixed(1)} sub="520√(k·(2/(k+1))^((k+1)/(k-1)))"/>
        {!isCrit && <Metric label="F₂ Factor" value={F2?.toFixed(4)}/>}
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="Critical flow confirmed" status={isCrit?'pass':'warn'}
                       value={isCrit?'Choked':'Subcritical — verify BP'}/>
        <ComplianceRow label="Compressibility Z ≥ 0.80" status={z_warn?'fail':'pass'}
                       value={z_warn?'Z < 0.80 — near saturation':'OK'}/>
        <ComplianceRow label="High-pressure range (≥ 70 psig)" status={lp_warn?'warn':'pass'}
                       value={lp_warn?'LP service — verify Kb method':'OK'}/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── Steam result ───────────────────────────────────────────────────
function SteamResult({ result }) {
  const { A_in2, orifice, Ksh, Kn, Kb, T_sat_F, P1_psia } = result
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Required Area"  value={A_in2?.toFixed(4)}    unit="in²" highlight="blue"/>
        <Metric label="P₁ Relieving"   value={P1_psia?.toFixed(2)}  unit="psia"/>
        <Metric label="Ksh Superheat"  value={Ksh?.toFixed(4)}
                highlight={Ksh < 0.90 ? 'warn' : 'pass'}
                sub={Ksh < 1.0 ? `${((1-Ksh)*100).toFixed(1)}% area increase` : 'Saturated'}/>
        <Metric label="Kn Napier"      value={Kn?.toFixed(4)}
                highlight={Kn < 1.0 ? 'warn' : 'pass'}/>
        <Metric label="Kb Back-press." value={Kb?.toFixed(4)}/>
        <Metric label="T_sat"          value={T_sat_F?.toFixed(1)}  unit="°F"/>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="Superheat correction" status={Ksh < 0.95?'warn':'pass'}
                       value={`Ksh = ${Ksh?.toFixed(4)}`}/>
        <ComplianceRow label="Napier correction (< 1500 psia)" status={Kn < 0.95?'warn':'pass'}
                       value={`Kn = ${Kn?.toFixed(4)}`}/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── Liquid result ──────────────────────────────────────────────────
function LiquidResult({ result }) {
  const { A_in2, orifice, Kv, Kw, Re, Q_gpm, dP_psi, flashing_warn } = result
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Required Area"  value={A_in2?.toFixed(4)}   unit="in²" highlight="blue"/>
        <Metric label="Flow Rate"      value={Q_gpm?.toFixed(2)}   unit="GPM"/>
        <Metric label="ΔP"             value={dP_psi?.toFixed(2)}  unit="psi"/>
        <Metric label="Kw Back-press." value={Kw?.toFixed(4)}
                sub={Kw < 1.0 ? 'Bellows derate applied' : 'Conventional (no derate)'}/>
        <Metric label="Kv Viscosity"   value={Kv?.toFixed(4)}
                highlight={Kv < 0.95 ? 'warn' : 'pass'}/>
        <Metric label="Reynolds No."   value={Re?.toFixed(0)} sub="2.8·W/(μ·√A)"/>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="Flashing risk" status={flashing_warn?'fail':'pass'}
                       value={flashing_warn?'P₂/P₁ < 50% — use Two-Phase tab':'Non-flashing confirmed'}/>
        <ComplianceRow label="Viscosity correction" status={Kv<0.90?'warn':'pass'}
                       value={`Kv = ${Kv?.toFixed(4)}${Kv<0.95?' — significant derate':''}`}/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── Two-phase result ───────────────────────────────────────────────
function TwoPhaseResult({ result }) {
  const { A_in2, orifice, omega, eta, Gc_lbhr_in2, isSub } = result
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Required Area"     value={A_in2?.toFixed(4)}        unit="in²" highlight="blue"/>
        <Metric label="ω (omega)"         value={omega?.toFixed(4)}         sub="Leung compressibility parameter"/>
        <Metric label="η Critical Ratio"  value={eta?.toFixed(4)}           sub="Pc/P₁"/>
        <Metric label="Gc Critical Flux"  value={Gc_lbhr_in2?.toFixed(0)}  unit="lb/hr·in²"/>
        <Metric label="Flow Regime"       value={isSub?'Subcritical':'Critical'}
                highlight={isSub?'warn':'pass'}/>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="Omega method valid (x > 0)" status="pass"
                       value={`ω = ${omega?.toFixed(4)}`}/>
        <ComplianceRow label="Flow regime" status={isSub?'warn':'pass'}
                       value={isSub?'Subcritical — BP above critical':'Critical (choked) flow'}/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── Fire case result ───────────────────────────────────────────────
function FireResult({ result }) {
  const { A_in2, orifice, Aw_ft2, Q_BTUhr, Q_MMBTUhr, W_relief_lbhr, P1_psia } = result
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Required Area"  value={A_in2?.toFixed(4)}         unit="in²"    highlight="blue"/>
        <Metric label="Wetted Area Aw" value={Aw_ft2?.toFixed(2)}        unit="ft²"
                sub={Aw_ft2>=2500?'≥ 2500 ft² cap applied':undefined}/>
        <Metric label="Fire Heat Q"    value={Q_MMBTUhr?.toFixed(3)}     unit="MMBTU/hr"/>
        <Metric label="Relief Rate W"  value={W_relief_lbhr?.toFixed(0)} unit="lb/hr"/>
        <Metric label="P₁ (21% OP)"   value={P1_psia?.toFixed(2)}       unit="psia"
                sub="API 521 §5.15 fire overpressure"/>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="21% overpressure applied" status="pass" value="API 521 §5.15"/>
        <ComplianceRow label="Wetted area cap" status={Aw_ft2>=2500?'warn':'pass'}
                       value={Aw_ft2>=2500?'Capped at 2500 ft² (sphere)':'Within limit'}/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── Blowdown result ────────────────────────────────────────────────
function BlowdownResult({ result }) {
  const { t_api521_s, passes_15min, T_min_F, mdmt_violated, W_peak_lbhr, P_final_psig, points } = result
  return (
    <div className="flex flex-col">
      {/* Header status */}
      <div className={`flex items-center gap-3 p-4 border-b border-border-subtle
                       ${passes_15min ? 'bg-emerald-500/8' : 'bg-red-500/8'}`}>
        {passes_15min
          ? <CheckCircle2 size={20} className="text-emerald-400"/>
          : <XCircle     size={20} className="text-red-400"/>}
        <div>
          <div className={`text-sm font-bold ${passes_15min?'text-emerald-300':'text-red-300'}`}>
            {passes_15min ? 'PASS — 15-min criterion met' : 'FAIL — exceeds 15 min'}
          </div>
          <div className="text-xs text-slate-500">
            API 521 §5.6 depressurisation to 50% initial pressure
          </div>
        </div>
        <div className="ml-auto font-mono text-lg font-bold text-slate-100">
          {(t_api521_s/60).toFixed(1)} <span className="text-xs text-slate-500 font-normal">min</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Depressure Time"  value={(t_api521_s/60).toFixed(2)}  unit="min"
                highlight={passes_15min?'pass':'fail'}/>
        <Metric label="T_min Metal"      value={T_min_F?.toFixed(1)}         unit="°F"
                highlight={mdmt_violated?'fail':'pass'}
                sub={mdmt_violated?'⚠ Below MDMT — brittle fracture risk':'OK'}/>
        <Metric label="Peak Flow"        value={W_peak_lbhr?.toFixed(0)}     unit="lb/hr"/>
        <Metric label="Final Pressure"   value={P_final_psig?.toFixed(1)}    unit="psig"/>
      </div>

      {/* Pressure-time chart */}
      {points && points.length > 0 && (
        <div className="px-4 pb-4">
          <SectionTitle>Pressure Profile</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={points} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="t" tick={{fill:'#64748b',fontSize:10}} tickLine={false}
                     label={{value:'Time (s)',fill:'#64748b',fontSize:10,position:'insideBottom',offset:-2}}/>
              <YAxis tick={{fill:'#64748b',fontSize:10}} tickLine={false}/>
              <Tooltip contentStyle={{background:'#1a2438',border:'1px solid rgba(255,255,255,0.1)',
                fontSize:11,borderRadius:4}} labelStyle={{color:'#94a3b8'}}
                formatter={(v,n)=>[v.toFixed(1), n==='P'?'Pressure (psig)':'Temp (°F)']}/>
              <Area type="monotone" dataKey="P" stroke="#3b82f6" fill="url(#pGrad)"
                    strokeWidth={1.5} dot={false} name="P"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="15-min API 521 criterion" status={passes_15min?'pass':'fail'}
                       value={(t_api521_s/60).toFixed(2)+' min'}/>
        <ComplianceRow label="MDMT fracture risk" status={mdmt_violated?'fail':'pass'}
                       value={`T_min = ${T_min_F?.toFixed(1)}°F`}/>
      </div>
    </div>
  )
}

// ── Thermal result ─────────────────────────────────────────────────
function ThermalResult({ result }) {
  const { A_in2, orifice, Q_gpm, dP_psi } = result
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Required Area" value={A_in2?.toFixed(5)} unit="in²" highlight="blue"
                sub="Typically very small — verify minimum orifice"/>
        <Metric label="Relief Flow"   value={Q_gpm?.toFixed(4)}  unit="GPM"/>
        <Metric label="ΔP"            value={dP_psi?.toFixed(2)} unit="psi"/>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="API 521 §5.20 thermal method" status="pass" value="Q=β·Q_heat/(500·SG·Cp)"/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── Tube rupture result ────────────────────────────────────────────
function TubeRuptureResult({ result }) {
  const { A_in2, orifice, credibility, P_ratio, W_tube_lbhr, ID_in } = result
  const isPSVRequired = credibility?.includes('PSV required')
  return (
    <div className="flex flex-col">
      <OrificeHeader orifice={orifice} A_in2={A_in2}/>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Metric label="Credibility" value={isPSVRequired?'PSV Required':'Verify'}
                highlight={isPSVRequired?'fail':'warn'}/>
        <Metric label="P_HP/P_LP Ratio" value={P_ratio?.toFixed(3)}
                sub="Threshold: 1.5 (API 521 §5.19)"/>
        <Metric label="Tube Flow Rate"   value={W_tube_lbhr?.toFixed(0)} unit="lb/hr"/>
        <Metric label="Tube ID"          value={ID_in?.toFixed(4)} unit="in"/>
        <Metric label="Required Area"    value={A_in2?.toFixed(4)} unit="in²" highlight="blue"/>
      </div>
      <div className="px-4 pb-4">
        <SectionTitle>Compliance Checks</SectionTitle>
        <ComplianceRow label="Credibility assessment" status={isPSVRequired?'fail':'warn'}
                       value={`P_ratio = ${P_ratio?.toFixed(3)}`}/>
        <ComplianceRow label="Orifice selection" status={orifice?.is_multi?'fail':'pass'}
                       value={orifice?.d + ' — ' + orifice?.in_sz}/>
      </div>
    </div>
  )
}

// ── API 2000 result ────────────────────────────────────────────────
function API2000Result({ result }) {
  const { th_out_SCFH, th_in_SCFH, move_out_SCFH, move_in_SCFH,
          total_out_SCFH, total_in_SCFH, governing_SCFH, flash_rate_SCFH_BPH } = result
  const govOut = total_out_SCFH >= total_in_SCFH
  return (
    <div className="flex flex-col p-4 gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Governing Rate"  value={governing_SCFH?.toFixed(0)} unit="SCFH" highlight="blue"
                sub={govOut?'Outbreathing governs':'Inbreathing governs'}/>
        <Metric label="Flash Rate"      value={flash_rate_SCFH_BPH}         unit="SCFH/BPH"
                sub={flash_rate_SCFH_BPH===12?'Flash < 100°F (volatile)':'Flash ≥ 100°F (stable)'}/>
      </div>
      <div>
        <SectionTitle>Breathing Rates</SectionTitle>
        <table className="data-table w-full">
          <thead><tr><th>Direction</th><th>Thermal</th><th>Movement</th><th>Total</th></tr></thead>
          <tbody>
            <tr>
              <td className="text-slate-400">Outbreathing ↑</td>
              <td>{th_out_SCFH?.toFixed(0)}</td>
              <td>{move_out_SCFH?.toFixed(0)}</td>
              <td className={govOut?'text-blue-300 font-bold':''}>{total_out_SCFH?.toFixed(0)}</td>
            </tr>
            <tr>
              <td className="text-slate-400">Inbreathing ↓</td>
              <td>{th_in_SCFH?.toFixed(0)}</td>
              <td>{move_in_SCFH?.toFixed(0)}</td>
              <td className={!govOut?'text-blue-300 font-bold':''}>{total_in_SCFH?.toFixed(0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Reaction force result ──────────────────────────────────────────
function ReactionResult({ result }) {
  const { Fm_lbf, Fp_lbf, F_static_lbf, F_design_lbf, F_design_kN } = result
  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      <Metric label="F_design" value={F_design_lbf?.toFixed(1)} unit="lbf" highlight="blue"/>
      <Metric label="F_design" value={F_design_kN?.toFixed(3)}  unit="kN"/>
      <Metric label="Fm Momentum" value={Fm_lbf?.toFixed(1)} unit="lbf"/>
      <Metric label="Fp Pressure" value={Fp_lbf?.toFixed(1)}  unit="lbf"/>
      <Metric label="F_static"    value={F_static_lbf?.toFixed(1)} unit="lbf"/>
    </div>
  )
}

// ── Generic fallback ───────────────────────────────────────────────
function GenericResult({ result }) {
  return (
    <div className="p-4">
      <SectionTitle>Result</SectionTitle>
      <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}
