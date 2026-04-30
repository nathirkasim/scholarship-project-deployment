'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, Search, Calendar, TrendingUp, User, Gavel } from 'lucide-react'

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

export default function AdminDecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [pending, setPending] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [acting, setActing] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  async function loadData() {
    const [dec, pend] = await Promise.all([
      fetch('/api/proxy/officer/decisions', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/proxy/officer/applications?status=verification_complete&limit=200', { credentials: 'include' }).then(r => r.json()),
    ])
    setDecisions(dec.decisions || [])
    setPending((pend.applications || []).filter((a: Decision) => !a.final_decision))
    setLoading(false)
  }

  useEffect(() => { loadData().catch(() => setLoading(false)) }, [])

  async function decide(applicationId: string, decision: 'approved' | 'waitlisted' | 'rejected', reason?: string) {
    setActing(applicationId)
    setActionError(null)
    const res = await fetch('/api/proxy/officer/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, decision, reason }),
      credentials: 'include',
    })
    if (res.ok) {
      setPending(p => p.filter(a => a.id !== applicationId))
      await loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      setActionError(err.error || 'Failed to record decision')
    }
    setActing(null)
    setRejectModal(null)
    setRejectReason('')
  }

  const filtered = decisions.filter(d => {
    const q = search.toLowerCase()
    return (!search || d.user.full_name.toLowerCase().includes(q) || d.user.email.toLowerCase().includes(q))
      && (filter === 'all' || d.final_decision === filter)
  })

  const counts = {
    approved:   decisions.filter(d => d.final_decision === 'approved').length,
    rejected:   decisions.filter(d => d.final_decision === 'rejected').length,
    waitlisted: decisions.filter(d => d.final_decision === 'waitlisted').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30">
        <h1 className="text-lg font-bold text-slate-900">Decisions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Pending approvals and complete audit trail</p>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Pending Decisions */}
        {(loading || pending.length > 0) && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="w-4 h-4 text-blue-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">
                Pending Final Decisions ({pending.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {actionError && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{actionError}</div>
                )}
                {pending
                  .sort((a, b) => Number(b.post_verify_composite ?? b.composite_score ?? 0) - Number(a.post_verify_composite ?? a.composite_score ?? 0))
                  .map((app, idx) => {
                    const score = app.post_verify_composite ?? app.composite_score
                    return (
                      <div key={app.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 font-bold text-blue-600 text-sm">
                            #{idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{app.user.full_name}</span>
                              <span className="text-sm text-slate-400">{app.user.email}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{app.program.program_name}</p>
                          </div>
                          {score != null && (
                            <div className="text-right flex-shrink-0 mr-4">
                              <div className="flex items-center gap-1 justify-end">
                                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-base font-bold text-slate-900">{Number(score).toFixed(1)}</span>
                              </div>
                              <div className="text-[11px] text-slate-400">score</div>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => decide(app.id, 'approved')}
                              disabled={acting === app.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {acting === app.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => decide(app.id, 'waitlisted')}
                              disabled={acting === app.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Waitlist
                            </button>
                            <button
                              onClick={() => { setRejectModal({ id: app.id, name: app.user.full_name }); setRejectReason('') }}
                              disabled={acting === app.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>
        )}

        {/* Summary cards */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Decision History</h2>
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
            <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No decisions match the current filter</div>
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
                      {d.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {d.rejection_reason}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {score != null && (
                        <>
                          <div className="flex items-center gap-1 justify-end">
                            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-base font-bold text-slate-900">{Number(score).toFixed(1)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">TOPSIS score</div>
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

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 mb-1">Reject Application</h3>
            <p className="text-sm text-slate-500 mb-4">{rejectModal.name}</p>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Provide a clear reason for rejection"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => decide(rejectModal.id, 'rejected', rejectReason)}
                disabled={!rejectReason.trim() || acting === rejectModal.id}
                className="flex-1 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {acting === rejectModal.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => { setRejectModal(null); setRejectReason('') }}
                className="px-6 py-2.5 text-sm font-semibold border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
