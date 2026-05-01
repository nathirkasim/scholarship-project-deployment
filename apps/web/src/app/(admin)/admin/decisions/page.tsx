'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, Search, Calendar, TrendingUp, User, Gavel, FileText, X, RefreshCw } from 'lucide-react'

interface Decision {
  id: string; status: string; final_decision: string | null
  composite_score: number | null; post_verify_composite: number | null
  rejection_reason: string | null; decided_at: string | null
  user: { full_name: string; email: string }; program: { program_name: string }
}

const DECISION: Record<string, { label: string; cls: string; dot: string; icon: React.ReactNode }> = {
  approved:   { label: 'Approved',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:   { label: 'Rejected',   cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500',     icon: <XCircle className="w-3.5 h-3.5" /> },
  waitlisted: { label: 'Waitlisted', cls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500',   icon: <Clock className="w-3.5 h-3.5" /> },
}

function RejectionNoticeModal({ reason, name, onClose }: { reason: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900">Rejection Notice</h3>
            <p className="text-sm text-slate-500 mt-0.5">{name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{reason}</div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminDecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [noticeModal, setNoticeModal] = useState<{ reason: string; name: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadData(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      // GET /officer/decisions auto-finalizes any pending verification_complete apps
      const dec = await fetch('/api/proxy/officer/decisions', { credentials: 'include' }).then(r => r.json())
      setDecisions(dec.decisions || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const filtered = decisions
    .filter(d => {
      const q = search.toLowerCase()
      return (!search || d.user.full_name.toLowerCase().includes(q) || d.user.email.toLowerCase().includes(q))
        && (filter === 'all' || d.final_decision === filter)
    })
    .sort((a, b) =>
      Number(b.post_verify_composite ?? b.composite_score ?? 0) -
      Number(a.post_verify_composite ?? a.composite_score ?? 0)
    )

  const counts = {
    approved:   decisions.filter(d => d.final_decision === 'approved').length,
    rejected:   decisions.filter(d => d.final_decision === 'rejected').length,
    waitlisted: decisions.filter(d => d.final_decision === 'waitlisted').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Decisions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Decisions are applied automatically based on post-verification composite score. Ranked highest to lowest.
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Summary cards */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Gavel className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Decision Summary</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'approved', label: 'Approved', count: counts.approved },
              { key: 'rejected', label: 'Rejected', count: counts.rejected },
              { key: 'waitlisted', label: 'Waitlisted', count: counts.waitlisted },
            ].map(({ key, label, count }) => {
              const d = DECISION[key]; const active = filter === key
              return (
                <button key={key} onClick={() => setFilter(active ? 'all' : key)}
                  className={`rounded-2xl border p-5 text-center transition-all hover:shadow-sm
                    ${active ? `${d.cls} border-current shadow-sm` : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${d.dot}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${active ? '' : 'text-slate-500'}`}>{label}</span>
                  </div>
                  <div className={`text-3xl font-bold ${active ? '' : 'text-slate-900'}`}>{count}</div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Toolbar */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <div className="flex gap-2">
            {['all', 'approved', 'rejected', 'waitlisted'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-colors
                  ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* History List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {decisions.length === 0
                ? 'No decisions yet — decisions are written automatically once field verifications complete.'
                : 'No decisions match the current filter'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(d => {
                const cfg = d.final_decision ? DECISION[d.final_decision] : null
                const score = d.post_verify_composite ?? d.composite_score
                return (
                  <div key={d.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg?.cls ?? 'bg-slate-100 text-slate-500'}`}>
                      {cfg?.icon ?? <User className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{d.user.full_name}</span>
                        <span className="text-sm text-slate-400">{d.user.email}</span>
                        {cfg && <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{d.program.program_name}</p>
                      {d.rejection_reason && (
                        <button
                          onClick={() => setNoticeModal({ reason: d.rejection_reason!, name: d.user.full_name })}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          View rejection notice
                        </button>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {score != null && (
                        <>
                          <div className="flex items-center gap-1 justify-end">
                            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-base font-bold text-slate-900">{Number(score).toFixed(1)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">{d.post_verify_composite != null ? 'Post-verify' : 'Composite'}</div>
                        </>
                      )}
                      {d.decided_at && (
                        <div className="flex items-center gap-1 justify-end mt-1 text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(d.decided_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
              Showing {filtered.length} of {decisions.length} decisions
            </div>
          )}
        </div>
      </div>

      {noticeModal && (
        <RejectionNoticeModal
          reason={noticeModal.reason}
          name={noticeModal.name}
          onClose={() => setNoticeModal(null)}
        />
      )}
    </div>
  )
}
