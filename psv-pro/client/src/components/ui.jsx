import { forwardRef } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react'

// ── Field ─────────────────────────────────────────────────────────
export function Field({ label, children, hint, error, required, className='' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="text-2xs font-medium tracking-wide uppercase text-slate-500 flex items-center gap-1">
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {children}
      {hint  && !error && <p className="text-2xs text-slate-600 mt-0.5">{hint}</p>}
      {error && <p className="text-2xs text-red-400 mt-0.5">{error}</p>}
    </div>
  )
}

// ── NumberInput ───────────────────────────────────────────────────
export const NumberInput = forwardRef(function NumberInput(
  { className='', unit, ...props }, ref
) {
  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        type="number"
        step="any"
        className={`h-8 px-3 w-full bg-surface-3 border border-border-subtle rounded
                    focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                    font-mono text-xs text-slate-100 ${unit?'pr-12':''} ${className}`}
        {...props}
      />
      {unit && (
        <span className="absolute right-3 text-2xs text-slate-500 pointer-events-none font-mono">
          {unit}
        </span>
      )}
    </div>
  )
})

// ── Select ────────────────────────────────────────────────────────
export function Select({ children, className='', ...props }) {
  return (
    <select
      className={`h-8 px-3 w-full bg-surface-3 border border-border-subtle rounded
                  text-xs text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                  cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

// ── Card ──────────────────────────────────────────────────────────
export function Card({ children, className='', title, action }) {
  return (
    <div className={`bg-surface-2 border border-border-subtle rounded-lg overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-1/50">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Metric tile ───────────────────────────────────────────────────
export function Metric({ label, value, unit, sub, highlight }) {
  const clr = highlight === 'pass'  ? 'text-emerald-400' :
              highlight === 'fail'  ? 'text-red-400' :
              highlight === 'warn'  ? 'text-amber-400' :
              highlight === 'blue'  ? 'text-blue-400' :
              'text-slate-100'
  return (
    <div className="flex flex-col gap-0.5 p-3 bg-surface-3/60 rounded-md">
      <span className="text-2xs text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-lg font-semibold ${clr}`}>{value ?? '—'}</span>
        {unit && <span className="text-2xs text-slate-500">{unit}</span>}
      </div>
      {sub && <span className="text-2xs text-slate-600">{sub}</span>}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────
const BADGE_STYLES = {
  pass:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  fail:    'bg-red-500/15 text-red-400 border-red-500/25',
  warn:    'bg-amber-500/15 text-amber-400 border-amber-500/25',
  info:    'bg-blue-500/15 text-blue-400 border-blue-500/25',
  draft:   'bg-slate-500/15 text-slate-400 border-slate-500/25',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/25',
}
export function Badge({ variant='info', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border
      text-2xs font-semibold tracking-wide uppercase ${BADGE_STYLES[variant]||BADGE_STYLES.info}`}>
      {children}
    </span>
  )
}

// ── Status indicator ──────────────────────────────────────────────
export function StatusIcon({ type }) {
  if (type === 'pass') return <CheckCircle2 size={14} className="text-emerald-400"/>
  if (type === 'fail') return <XCircle size={14} className="text-red-400"/>
  if (type === 'warn') return <AlertTriangle size={14} className="text-amber-400"/>
  return <Info size={14} className="text-blue-400"/>
}

// ── Orifice chip ──────────────────────────────────────────────────
export function OrificeChip({ designation, size_label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 rounded-md flex items-center justify-center
                      bg-blue-500/15 border border-blue-500/30 font-mono font-bold text-lg text-blue-300">
        {designation}
      </div>
      {size_label && <span className="text-2xs text-slate-500 mt-1">{size_label}</span>}
    </div>
  )
}

// ── Compliance check row ──────────────────────────────────────────
export function ComplianceRow({ label, status, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
      <div className="flex items-center gap-2">
        <StatusIcon type={status}/>
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      {value && <span className="text-xs font-mono text-slate-400">{value}</span>}
    </div>
  )
}

// ── Notification toast ────────────────────────────────────────────
export function Toast({ msg, type='info', onDismiss }) {
  const icons = { info: Info, warn: AlertTriangle, pass: CheckCircle2, fail: XCircle }
  const styles = {
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    pass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    fail: 'border-red-500/30 bg-red-500/10 text-red-300',
  }
  const Icon = icons[type] || Info
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${styles[type]||styles.info}`}>
      <Icon size={13}/>
      <span className="flex-1">{msg}</span>
      {onDismiss && <button onClick={onDismiss}><X size={12}/></button>}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({ size=16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-blue-400">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"
              fill="none" strokeDasharray="60" strokeDashoffset="45" strokeLinecap="round"/>
    </svg>
  )
}

// ── Empty state ───────────────────────────────────────────────────
export function Empty({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && <Icon size={36} className="text-slate-700"/>}
      <div>
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {subtitle && <p className="text-xs text-slate-600 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return (
    <h4 className="text-2xs font-semibold tracking-widest uppercase text-slate-500
                   pb-2 mb-3 border-b border-border-subtle">
      {children}
    </h4>
  )
}

// ── Divider ───────────────────────────────────────────────────────
export function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-px flex-1 bg-border-subtle"/>
      {label && <span className="text-2xs text-slate-600 uppercase tracking-wider">{label}</span>}
      <div className="h-px flex-1 bg-border-subtle"/>
    </div>
  )
}
