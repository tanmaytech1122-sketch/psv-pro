import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projects, cases } from '../../utils/api'
import { Spinner } from '../ui'
import { X, Save, FolderOpen, Plus } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

export default function SaveCaseModal({ phase, inputs, results, onClose }) {
  const qc = useQueryClient()
  const { notify } = useAppStore()
  const [tag, setTag]         = useState('')
  const [service, setService] = useState('')
  const [scenario, setScenario] = useState('')
  const [notes, setNotes]     = useState('')
  const [selectedPid, setPid] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [creatingNew, setCreatingNew]       = useState(false)

  const { data: projectList = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  })

  const createProject = useMutation({
    mutationFn: () => projects.create({ name: newProjectName }),
    onSuccess: (p) => {
      qc.invalidateQueries(['projects'])
      setPid(p.id)
      setCreatingNew(false)
      setNewProjectName('')
    }
  })

  const saveCase = useMutation({
    mutationFn: () => cases.create(selectedPid, {
      tag, service, phase, scenario, notes,
      inputs,
      results: results ? { ...results, orifice: results.orifice } : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['project', selectedPid])
      notify(`${tag || phase} saved to project`, 'pass')
      onClose()
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-2 border border-border-normal rounded-xl w-[420px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Save size={15} className="text-blue-400"/>
            <h2 className="text-sm font-semibold text-slate-200">Save Calculation</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16}/>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Project selector */}
          <div className="space-y-2">
            <label className="text-2xs font-medium tracking-wide uppercase text-slate-500">
              Project *
            </label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-600 text-xs">
                <Spinner size={12}/> Loading projects…
              </div>
            ) : creatingNew ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="New project name"
                  className="flex-1 h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 outline-none"
                  onKeyDown={e => e.key === 'Enter' && newProjectName && createProject.mutate()}
                />
                <button
                  onClick={() => newProjectName && createProject.mutate()}
                  disabled={!newProjectName || createProject.isPending}
                  className="btn-primary px-3 h-8"
                >
                  {createProject.isPending ? <Spinner size={12}/> : 'Create'}
                </button>
                <button onClick={() => setCreatingNew(false)} className="btn-ghost px-2 h-8">
                  <X size={12}/>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedPid}
                  onChange={e => setPid(e.target.value)}
                  className="flex-1 h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="">— select project —</option>
                  {projectList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.unit ? ` · ${p.unit}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setCreatingNew(true)}
                  className="btn-ghost h-8 px-2 gap-1 flex-shrink-0"
                  title="New project"
                >
                  <Plus size={12}/>
                </button>
              </div>
            )}
          </div>

          {/* Case metadata */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'tag',      val: tag,      set: setTag,      label: 'PSV Tag',     placeholder: 'PSV-101' },
              { key: 'service',  val: service,  set: setService,  label: 'Service',     placeholder: 'Propane vapour' },
              { key: 'scenario', val: scenario, set: setScenario, label: 'Scenario',    placeholder: 'Blocked outlet', full: true },
            ].map(({ key, val, set, label, placeholder, full }) => (
              <div key={key} className={`flex flex-col gap-1 ${full ? 'col-span-2' : ''}`}>
                <label className="text-2xs font-medium tracking-wide uppercase text-slate-500">{label}</label>
                <input
                  type="text"
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  className="h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-2xs font-medium tracking-wide uppercase text-slate-500">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional engineering notes…"
              className="px-3 py-2 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Result summary */}
          {results && (
            <div className="flex items-center gap-3 p-3 bg-surface-3/50 rounded-md border border-border-subtle">
              <div className="font-mono text-sm font-bold text-slate-200">
                {results.A_in2?.toFixed(4)}
                <span className="text-xs text-slate-500 font-normal ml-1">in²</span>
              </div>
              {results.orifice && (
                <div className="w-7 h-7 rounded bg-blue-500/15 border border-blue-500/25 flex items-center justify-center font-mono font-bold text-sm text-blue-300">
                  {results.orifice.d}
                </div>
              )}
              <span className="text-xs text-slate-500 uppercase tracking-wide">{phase}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 justify-end border-t border-border-subtle pt-4">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => saveCase.mutate()}
            disabled={!selectedPid || saveCase.isPending}
            className="btn-primary gap-2"
          >
            {saveCase.isPending ? <Spinner size={13}/> : <Save size={13}/>}
            Save Case
          </button>
        </div>
      </div>
    </div>
  )
}
