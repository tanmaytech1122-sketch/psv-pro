import { Wrench } from 'lucide-react'
export default function PlaceholderPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center">
        <Wrench size={24} className="text-slate-600"/>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <p className="text-xs text-slate-600 mt-1">This module is available in the full release</p>
      </div>
    </div>
  )
}
