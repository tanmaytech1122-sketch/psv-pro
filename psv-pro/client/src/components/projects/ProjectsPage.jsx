import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projects, cases } from '../../utils/api'
import { Card, Badge, Empty, Spinner, SectionTitle } from '../ui'
import {
  FolderOpen, Plus, Trash2, ChevronRight, Calendar,
  User, Building2, Layers, FileText, X, Save, RefreshCw
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'

// ── Status badge map ───────────────────────────────────────────────
const STATUS_VARIANT = {
  draft:      'draft',
  calculated: 'info',
  approved:   'pass',
  superseded: 'warn',
}

const PHASE_LABELS = {
  gas:          'Gas',
  steam:        'Steam',
  liquid:       'Liquid',
  twophase:     'Two-Phase',
  fire:         'Fire Case',
  blowdown:     'Blowdown',
  thermal:      'Thermal',
  tuberupture:  'Tube Rupture',
}

// ── New Project Modal ──────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name:'', plant:'', unit:'', engineer:'', description:'' })
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => projects.create(form),
    onSuccess: (p) => { qc.invalidateQueries(['projects']); onCreated(p); onClose() }
  })
  const f = k => e => setForm(s => ({ ...s, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-2 border border-border-normal rounded-xl w-[420px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-slate-200">New Project</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key:'name',        label:'Project Name *', placeholder:'e.g. Distillation Unit Revamp' },
            { key:'plant',       label:'Plant / Facility', placeholder:'e.g. Refinery Unit 3' },
            { key:'unit',        label:'Process Unit',  placeholder:'e.g. CDU-101' },
            { key:'engineer',    label:'Engineer',      placeholder:'Your name' },
            { key:'description', label:'Description',   placeholder:'Brief scope description', multi:true },
          ].map(({ key, label, placeholder, multi }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-2xs font-medium tracking-wide uppercase text-slate-500">{label}</label>
              {multi ? (
                <textarea
                  rows={2}
                  value={form[key]}
                  onChange={f(key)}
                  placeholder={placeholder}
                  className="px-3 py-2 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200
                             placeholder-slate-600 focus:border-blue-500 outline-none resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={form[key]}
                  onChange={f(key)}
                  placeholder={placeholder}
                  className="h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200
                             placeholder-slate-600 focus:border-blue-500 outline-none"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-5 pb-5 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
            className="btn-primary gap-2"
          >
            {mutation.isPending ? <RefreshCw size={13} className="animate-spin"/> : <Save size={13}/>}
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Project detail panel ───────────────────────────────────────────
function ProjectDetail({ projectId, onBack }) {
  const qc = useQueryClient()
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projects.get(projectId),
  })
  const deleteCaseMutation = useMutation({
    mutationFn: (cid) => cases.delete(projectId, cid),
    onSuccess: () => qc.invalidateQueries(['project', projectId])
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <Spinner size={20}/>
    </div>
  )

  if (!project) return null

  return (
    <div className="space-y-4">
      {/* Project header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={onBack} className="text-2xs text-blue-400 hover:text-blue-300 mb-1.5 flex items-center gap-1">
            ← All Projects
          </button>
          <h2 className="text-base font-semibold text-slate-100">{project.name}</h2>
          <div className="flex gap-3 mt-1 text-xs text-slate-500">
            {project.plant    && <span className="flex items-center gap-1"><Building2 size={11}/>{project.plant}</span>}
            {project.unit     && <span className="flex items-center gap-1"><Layers size={11}/>{project.unit}</span>}
            {project.engineer && <span className="flex items-center gap-1"><User size={11}/>{project.engineer}</span>}
          </div>
          {project.description && <p className="text-xs text-slate-600 mt-1.5 max-w-xl">{project.description}</p>}
        </div>
        <span className="text-2xs text-slate-600">
          {project.cases?.length || 0} cases
        </span>
      </div>

      {/* Cases table */}
      <Card title="Calculation Cases">
        {!project.cases?.length ? (
          <div className="py-12 text-center">
            <FileText size={28} className="text-slate-700 mx-auto mb-2"/>
            <p className="text-sm text-slate-500">No cases yet</p>
            <p className="text-xs text-slate-700 mt-1">Run calculations and save them here</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Service</th>
                <th>Phase</th>
                <th>Scenario</th>
                <th>A_req (in²)</th>
                <th>Orifice</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {project.cases.map(c => (
                <tr key={c.id} className="cursor-pointer">
                  <td className="text-blue-300 font-medium">{c.tag || '—'}</td>
                  <td className="text-slate-300">{c.service || '—'}</td>
                  <td><Badge variant="info">{PHASE_LABELS[c.phase] || c.phase}</Badge></td>
                  <td className="text-slate-400">{c.scenario || '—'}</td>
                  <td className="font-mono text-slate-200">
                    {c.results?.A_in2?.toFixed(4) || '—'}
                  </td>
                  <td>
                    {c.results?.orifice?.d ? (
                      <span className="font-mono font-bold text-blue-300 text-sm">
                        {c.results.orifice.d}
                      </span>
                    ) : '—'}
                  </td>
                  <td><Badge variant={STATUS_VARIANT[c.status] || 'draft'}>{c.status}</Badge></td>
                  <td className="text-slate-600">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCaseMutation.mutate(c.id) }}
                      className="p-1 text-slate-700 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── Main Projects Page ─────────────────────────────────────────────
export default function ProjectsPage() {
  const [showNew, setShowNew]       = useState(false)
  const [selected, setSelected]     = useState(null)
  const qc = useQueryClient()
  const { notify } = useAppStore()

  const { data: projectList = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => projects.delete(id),
    onSuccess: () => { qc.invalidateQueries(['projects']); notify('Project deleted', 'warn') }
  })

  if (selected) {
    return (
      <div className="overflow-y-auto h-full pr-1">
        <ProjectDetail projectId={selected} onBack={() => setSelected(null)}/>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Projects</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {projectList.length} project{projectList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary gap-2">
          <Plus size={13}/>New Project
        </button>
      </div>

      {/* Project cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Spinner size={20}/></div>
      ) : !projectList.length ? (
        <Empty
          icon={FolderOpen}
          title="No projects yet"
          subtitle="Create a project to organise your PSV calculations and build a register"
          action={
            <button onClick={() => setShowNew(true)} className="btn-primary gap-2 mt-2">
              <Plus size={13}/>Create First Project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {projectList.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              className="group flex items-center gap-4 p-4 bg-surface-2 border border-border-subtle
                         rounded-lg hover:border-border-normal hover:bg-surface-3/50
                         cursor-pointer transition-all duration-150"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/20
                              flex items-center justify-center flex-shrink-0">
                <FolderOpen size={18} className="text-blue-400"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{p.name}</span>
                  <span className="text-2xs text-slate-600 font-mono">
                    {p.case_count} {p.case_count === 1 ? 'case' : 'cases'}
                  </span>
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-slate-600">
                  {p.plant    && <span className="flex items-center gap-1"><Building2 size={10}/>{p.plant}</span>}
                  {p.unit     && <span className="flex items-center gap-1"><Layers size={10}/>{p.unit}</span>}
                  {p.engineer && <span className="flex items-center gap-1"><User size={10}/>{p.engineer}</span>}
                  <span className="flex items-center gap-1">
                    <Calendar size={10}/>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-slate-600 mt-1 truncate">{p.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id) }}
                  className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete project"
                >
                  <Trash2 size={14}/>
                </button>
                <ChevronRight size={14} className="text-slate-600"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={(p) => { notify(`Project "${p.name}" created`, 'pass'); setSelected(p.id) }}
        />
      )}
    </div>
  )
}
