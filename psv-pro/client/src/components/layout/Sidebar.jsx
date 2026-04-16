import { NavLink } from 'react-router-dom'
import {
  Gauge, Thermometer, Droplets, Layers, Flame,
  Wind, Pipette, Activity, BarChart2, BookOpen,
  Settings, ChevronLeft, ChevronRight, FolderOpen,
  Waves, Shield, Wrench, TrendingDown, Sparkles  // Added Sparkles icon for AI
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'

const NAV = [
  {
    group: 'Sizing',
    items: [
      { to: '/size/gas',       icon: Gauge,       label: 'Gas / Vapour',   sub: 'API 520 §3.6' },
      { to: '/size/steam',     icon: Thermometer, label: 'Steam',          sub: 'API 520 §3.7' },
      { to: '/size/liquid',    icon: Droplets,    label: 'Liquid',         sub: 'API 520 §3.8' },
      { to: '/size/twophase',  icon: Layers,      label: 'Two-Phase',      sub: 'API 520 App C' },
    ]
  },
  {
    group: 'Scenarios',
    items: [
      { to: '/size/fire',      icon: Flame,       label: 'External Fire',  sub: 'API 521 §5.15' },
      { to: '/size/blowdown',  icon: TrendingDown,label: 'Blowdown',       sub: 'API 521 §5.6' },
      { to: '/size/thermal',   icon: Activity,    label: 'Thermal Relief', sub: 'API 521 §5.20' },
      { to: '/size/tuberupture',icon: Waves,      label: 'Tube Rupture',   sub: 'API 521 §5.19' },
      { to: '/size/api2000',   icon: Wind,        label: 'Tank Breathing', sub: 'API 2000' },
    ]
  },
  {
    group: 'Analysis',
    items: [
      { to: '/scenarios',      icon: BarChart2,   label: 'Scenario Matrix',sub: 'Governing case' },
      { to: '/reaction',       icon: Wrench,      label: 'Reaction Force', sub: 'API 520 Pt.II' },
      { to: '/piping',         icon: Pipette,     label: 'Inlet Piping',   sub: 'Darcy-Weisbach' },
      { to: '/sil',            icon: Shield,      label: 'SIL / LOPA',     sub: 'IEC 61511' },
    ]
  },
  {
    group: 'AI Assistant',  // NEW GROUP
    items: [
      { to: '/ai',             icon: Sparkles,    label: 'AI Assistant',   sub: 'Natural language queries' },
    ]
  },
  {
    group: 'Projects',
    items: [
      { to: '/projects',       icon: FolderOpen,  label: 'Projects',       sub: 'Case management' },
      { to: '/register',       icon: BookOpen,    label: 'PSV Register',   sub: 'Export ready' },
    ]
  },
  {
    group: 'System',
    items: [
      { to: '/settings',       icon: Settings,    label: 'Settings',       sub: 'Units & prefs' },
    ]
  },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <aside
      className={`flex flex-col bg-surface-1 border-r border-border-subtle
                  transition-all duration-200 ease-in-out flex-shrink-0
                  ${sidebarOpen ? 'w-52' : 'w-12'}`}
    >
      {/* Logo */}
      <div className="h-12 flex items-center px-3 border-b border-border-subtle flex-shrink-0">
        {sidebarOpen ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Gauge size={13} className="text-white"/>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">PSV Pro</div>
              <div className="text-2xs text-slate-500 leading-none mt-0.5">v4.0</div>
            </div>
          </div>
        ) : (
          <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center mx-auto">
            <Gauge size={13} className="text-white"/>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map(({ group, items }) => (
          <div key={group} className="mb-1">
            {sidebarOpen && (
              <p className="text-2xs text-slate-600 uppercase tracking-widest font-semibold
                            px-3 py-1.5 mt-1">
                {group}
              </p>
            )}
            {items.map(({ to, icon: Icon, label, sub }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md text-xs
                   transition-colors duration-100 group
                   ${isActive
                     ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                     : 'text-slate-400 hover:bg-surface-3 hover:text-slate-200 border border-transparent'
                   }
                   ${to === '/ai' && !isActive ? 'hover:border-purple-500/30 hover:bg-purple-500/10' : ''}
                   ${to === '/ai' && isActive ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : ''}
                   `
                }
                title={!sidebarOpen ? label : undefined}
              >
                <Icon size={14} className="flex-shrink-0"/>
                {sidebarOpen && (
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-none">{label}</div>
                    <div className="text-2xs text-slate-600 mt-0.5 group-hover:text-slate-500">{sub}</div>
                  </div>
                )}
              </NavLink>
            ))}
            {!sidebarOpen && <div className="h-px bg-border-subtle mx-2 my-1"/>}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="h-8 flex items-center justify-center border-t border-border-subtle
                   text-slate-600 hover:text-slate-300 hover:bg-surface-3 transition-colors"
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <ChevronLeft size={14}/> : <ChevronRight size={14}/>}
      </button>
    </aside>
  )
}