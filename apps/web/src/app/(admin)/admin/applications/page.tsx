'use client'

import { useEffect, useState } from 'react'
import { Play, AlertTriangle, Search, ChevronDown, ChevronUp, RefreshCw, Zap, UserCheck } from 'lucide-react'

interface Application {
  id: string; composite_rank: number | null; status: string
  composite_score: number | null; merit_score: number | null
  rule_need_score: number | null; integrity_adj: number | null
  anomaly_flag: boolean; user: { full_name: string; email: string }
}
interface Program { id: string; program_name: string; academic_year: string }
type SortKey = 'composite_rank' | 'composite_score' | 'merit_score' | 'rule_need_score'

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  draft:                 { label: 'Draft',               dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600' },
  submitted:             { label: 'Submitted',           dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700' },
  evaluating:            { label: 'Under Review',        dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700' },
  anomaly_flagged:       { label: 'Flagged',             dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700' },
  not_shortlisted:       { label: 'Ineligible',          dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-500' },
  evaluated:             { label: 'Evaluated',           dot: 'bg-cyan-500',    badge: 'bg-cyan-50 text-cyan-700' },
  scored:                { label: 'Ranked',              dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700' },
  verification_pending:  { label: 'Verif. Pending',      dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700' },
  verification_complete: { label: 'Verified',            dot: 'bg-teal-500',    badge: 'bg-teal-50 text-teal-700' },
  approved:              { label: 'Approved',            dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  waitlisted:            { label: 'Waitlisted',          dot: 'bg-yellow-500',  badge: 'bg-yellow-50 text-yellow-700' },
  rejected:              { label: 'Rejected',            dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700' },
}

export default function AdminApplicationsPage() {
  const [program, setProgram] = useState<Program | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'composite_rank', asc: true })
  const [triggering, setTriggering] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/proxy/officer/applications', { credentials: 'include' })
      .then(r => r.json()).then(d => { setProgram(d.program || null); setApps(d.applications || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter])

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  async function trigger(action: 'topsis' | 'verification') {
    setTriggering(action)
    const url = action === 'topsis' ? '/api/proxy/officer/trigger-topsis' : '/api/proxy/officer/trigger-verification'
    const res = await fetch(url, { method: 'POST', credentials: 'include' })
    const d = await res.json()
    res.ok ? showToast(d.message) : showToast(d.error ?? 'Action failed', false)
    setTriggering(null)
  }

  function toggleSort(key: SortKey) { setSort(s => s.key === key ? { ...s, asc: !s.asc } : { key, asc: false }) }

  const filtered = apps
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .filter(a => !search || a.user?.full_name?.toLowerCase().includes(search.toLowerCase()) || a.user?.email?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = Number(a[sort.key] ?? (sort.key === 'composite_rank' ? 9999 : 0))
      const bv = Number(b[sort.key] ?? (sort.key === 'composite_rank' ? 9999 : 0))
      return sort.asc ? av - bv : bv - av
    })

  const statusCounts = apps.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {} as Record<string, number>)

  const Th = ({ label, k }: { label: string; k?: SortKey }) => (
    <th className={`px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${k ? 'cursor-pointer select-none hover:text-slate-600' : ''}`}
      onClick={() => k && toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}
        {k && sort.key === k && (sort.asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  )

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Applications</h1>
            <p className="text-sm text-slate-500 mt-0.5">{program?.program_name ?? 'Loading'}  {filtered.length} of {apps.length} shown</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => trigger('topsis')} disabled={triggering !== null}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors disabled:opacity-50">
              {triggering === 'topsis' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Run TOPSIS Ranking
            </button>
            <button onClick={() => trigger('verification')} disabled={triggering !== null}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors disabled:opacity-50">
              {triggering === 'verification' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Send to Verification
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5 flex-nowrap">
          <button onClick={() => setStatusFilter('all')}
            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            All <span className="ml-1 opacity-70">{apps.length}</span>
          </button>
          {Object.entries(statusCounts).map(([status, count]) => {
            const m = STATUS_META[status]
            return (
              <button key={status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors
                  ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${m?.dot ?? 'bg-slate-400'}`} />
                {m?.label ?? status} <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="mt-3 relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10 shadow-sm">
              <tr>
                <Th label="Rank" k="composite_rank" />
                <Th label="Student" />
                <Th label="TOPSIS Score" k="composite_score" />
                <Th label="Merit" k="merit_score" />
                <Th label="Need" k="rule_need_score" />
                <Th label="Status" />
                <Th label="Flag" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-20 text-slate-400 text-sm">No applications match the current filter</td></tr>
              ) : filtered.map(app => {
                const m = STATUS_META[app.status]
                return (
                  <tr key={app.id} className="bg-white hover:bg-blue-50/40 transition-colors group">
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-400">
                      {app.composite_rank ? `#${app.composite_rank}` : ''}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 leading-tight">{app.user?.full_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{app.user?.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-base font-bold text-slate-900">
                        {app.composite_score != null ? Number(app.composite_score).toFixed(1) : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-blue-600 tabular-nums">
                      {app.merit_score != null ? Number(app.merit_score).toFixed(1) : ''}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-emerald-600 tabular-nums">
                      {app.rule_need_score != null ? Number(app.rule_need_score).toFixed(1) : ''}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${m?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m?.dot ?? 'bg-slate-400'}`} />
                        {m?.label ?? app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {app.anomaly_flag && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Anomaly
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border-t border-slate-200 px-6 py-2.5 text-xs text-slate-400 flex-shrink-0">
        {filtered.length} applications shown  Sorted by {sort.key.replace(/_/g, ' ')} ({sort.asc ? 'asc' : 'desc'})  TOPSIS score computed cohort-wide after all scoring completes
      </div>
    </div>
  )
}
