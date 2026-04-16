import { useLocation } from 'react-router-dom'
import { Save, Download, RefreshCw, HelpCircle } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { Toast } from '../ui'

const ROUTE_LABELS = {
  '/size/gas':        { title: 'Gas / Vapour Sizing',    std: 'API 520 Part I §3.6' },
  '/size/steam':      { title: 'Steam Sizing',           std: 'API 520 Part I §3.7 — Napier' },
  '/size/liquid':     { title: 'Liquid Sizing',          std: 'API 520 Part I §3.8 — Kw' },
  '/size/twophase':   { title: 'Two-Phase Sizing',       std: 'API 520 Part I App C — Leung 1986' },
  '/size/fire':       { title: 'External Fire',          std: 'API 521 §5.15 — wetted area' },
  '/size/blowdown':   { title: 'Blowdown / Depressurisation', std: 'API 521 §5.6 — isentropic ODE' },
  '/size/thermal':    { title: 'Thermal Relief',         std: 'API 521 §5.20' },
  '/size/tuberupture':{ title: 'Tube Rupture',           std: 'API 521 §5.19 — two-thirds rule' },
  '/size/api2000':    { title: 'Tank Breathing',         std: 'API 2000 7th Ed. §4' },
  '/scenarios':       { title: 'Scenario Matrix',        std: 'API 521 §5 — governing case analysis' },
  '/reaction':        { title: 'Reaction Force',         std: 'API 520 Part II §4' },
  '/piping':          { title: 'Inlet Piping',           std: 'Darcy-Weisbach + Colebrook-White' },
  '/sil':             { title: 'SIL / LOPA',             std: 'IEC 61511' },
  '/projects':        { title: 'Projects',               std: 'Case management' },
  '/register':        { title: 'PSV Register',           std: 'Equipment register' },
  '/settings':        { title: 'Settings',               std: 'Preferences' },
}

export default function Header() {
  const location = useLocation()
  const { notifications, dismissNotification, units, setUnits } = useAppStore()
  const meta = ROUTE_LABELS[location.pathname] || { title: 'PSV Pro', std: '' }

  return (
    <header className="h-12 flex items-center justify-between px-4
                       bg-surface-1 border-b border-border-subtle flex-shrink-0">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-100 leading-none">{meta.title}</h1>
          <p className="text-2xs text-slate-500 mt-0.5">{meta.std}</p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Unit toggle */}
        <div className="flex rounded overflow-hidden border border-border-subtle text-2xs">
          {['imperial','metric'].map(u => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`px-2.5 py-1 uppercase tracking-wide font-medium transition-colors
                ${units===u ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {u==='imperial'?'IMP':'SI'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border-subtle mx-1"/>

        <button className="btn-ghost h-7 w-7 p-0 flex items-center justify-center rounded"
                title="Save case">
          <Save size={13}/>
        </button>
        <button className="btn-ghost h-7 w-7 p-0 flex items-center justify-center rounded"
                title="Export PDF">
          <Download size={13}/>
        </button>
        <button className="btn-ghost h-7 w-7 p-0 flex items-center justify-center rounded"
                title="Help">
          <HelpCircle size={13}/>
        </button>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="absolute top-14 right-4 z-50 flex flex-col gap-1.5 w-72">
          {notifications.map(n => (
            <Toast key={n.id} msg={n.msg} type={n.type}
                   onDismiss={() => dismissNotification(n.id)}/>
          ))}
        </div>
      )}
    </header>
  )
}
