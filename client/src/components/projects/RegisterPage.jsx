import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { projects as projectsApi } from '../../utils/api'
import { Card, Badge, Spinner, Empty } from '../ui'
import { BookOpen, Download, Search, Filter } from 'lucide-react'

const STATUS_VARIANT = { draft:'draft', calculated:'info', approved:'pass', superseded:'warn' }
const PHASE_LABELS   = { gas:'Gas', steam:'Steam', liquid:'Liquid', twophase:'2-Phase',
                         fire:'Fire', blowdown:'Blowdown', thermal:'Thermal', tuberupture:'Tube Rupt.' }

function exportCSV(rows) {
  const headers = ['Project','Tag','Service','Phase','Scenario','P_set (psig)',
                   'W (lb/hr)','A_req (in²)','Orifice','Status','Updated']
  const lines = rows.map(r => [
    r.project_name, r.tag||'', r.service||'', PHASE_LABELS[r.phase]||r.phase,
    r.scenario||'', r.results?.P1_psia ? (r.results.P1_psia - 14.696).toFixed(1) : '',
    r.inputs?.W||'', r.results?.A_in2?.toFixed(4)||'',
    r.results?.orifice?.d||'', r.status,
    new Date(r.updated_at).toLocaleDateString()
  ].map(v => `"${v}"`).join(','))
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `psv_register_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

export default function RegisterPage() {
  const [search, setSearch] = useState('')
  const [filterPhase, setFilterPhase] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: projectList = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  // Fetch all project details to get cases
  const { data: allProjects = [], isLoading: loadingDetails } = useQuery({
    queryKey: ['all-projects-detail'],
    queryFn: () => Promise.all(projectList.map(p => projectsApi.get(p.id))),
    enabled: projectList.length > 0,
  })

  // Flatten all cases across projects
  const allCases = allProjects.flatMap(p =>
    (p?.cases || []).map(c => ({
      ...c,
      project_name: p?.name || '—',
      project_id:   p?.id,
      inputs:  c.inputs  || {},
      results: c.results || null,
    }))
  )

  // Filter
  const filtered = allCases.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || [c.tag, c.service, c.scenario, c.project_name]
      .some(v => v?.toLowerCase().includes(q))
    const matchPhase  = !filterPhase  || c.phase === filterPhase
    const matchStatus = !filterStatus || c.status === filterStatus
    return matchSearch && matchPhase && matchStatus
  })

  const loading = isLoading || loadingDetails

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <BookOpen size={15} className="text-blue-400"/>PSV Register
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {allCases.length} cases across {allProjects.length} projects
          </p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          disabled={!filtered.length}
          className="btn-ghost gap-2"
        >
          <Download size={13}/>Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tag, service, scenario…"
            className="w-full h-8 pl-8 pr-3 bg-surface-3 border border-border-subtle rounded
                       text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 outline-none"
          />
        </div>
        <select
          value={filterPhase}
          onChange={e => setFilterPhase(e.target.value)}
          className="h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200 outline-none cursor-pointer"
        >
          <option value="">All phases</option>
          {Object.entries(PHASE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-3 bg-surface-3 border border-border-subtle rounded text-xs text-slate-200 outline-none cursor-pointer"
        >
          <option value="">All statuses</option>
          {['draft','calculated','approved','superseded'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Register table */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Spinner size={20}/></div>
      ) : !allCases.length ? (
        <Empty
          icon={BookOpen}
          title="Register is empty"
          subtitle="Save calculations to a project and they will appear here"
        />
      ) : !filtered.length ? (
        <Empty icon={Filter} title="No matching cases" subtitle="Try adjusting your filters"/>
      ) : (
        <Card className="flex-1 overflow-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="sticky top-0">
              <tr className="bg-surface-3 border-b border-border-subtle">
                {['Project','Tag','Service','Phase','Scenario',
                  'P_set (psig)','W (lb/hr)','A_req (in²)','Orifice','Status','Updated'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-2xs text-slate-500 uppercase tracking-wide font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border-subtle hover:bg-surface-3/30">
                  <td className="py-2 px-3 text-slate-400 max-w-[120px] truncate">{c.project_name}</td>
                  <td className="py-2 px-3 font-medium text-blue-300">{c.tag || '—'}</td>
                  <td className="py-2 px-3 text-slate-300 max-w-[120px] truncate">{c.service || '—'}</td>
                  <td className="py-2 px-3">
                    <Badge variant="info">{PHASE_LABELS[c.phase] || c.phase}</Badge>
                  </td>
                  <td className="py-2 px-3 text-slate-400 max-w-[120px] truncate">{c.scenario || '—'}</td>
                  <td className="py-2 px-3 font-mono text-slate-300">
                    {c.results?.P1_psia ? (c.results.P1_psia - 14.696).toFixed(1) : '—'}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-300">
                    {c.inputs?.W?.toLocaleString() || '—'}
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold text-slate-200">
                    {c.results?.A_in2?.toFixed(4) || '—'}
                  </td>
                  <td className="py-2 px-3">
                    {c.results?.orifice?.d ? (
                      <span className="font-mono font-bold text-base text-blue-300">
                        {c.results.orifice.d}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant={STATUS_VARIANT[c.status] || 'draft'}>{c.status}</Badge>
                  </td>
                  <td className="py-2 px-3 text-slate-600">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
