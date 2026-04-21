'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, User, TrendingDown } from 'lucide-react'

interface FlaggedApp {
  id: string; anomaly_score: number; anomaly_flag: boolean; status: string
  anomaly_reasons: { g_rules_fired: string[]; ml_flag: boolean } | null
  user: { full_name: string; email: string }; program: { program_name: string }
}

const G_RULE_DESC: Record<string, string> = {
  'G-01': 'Low income (2L) with car value 3L',
  'G-02': 'Low income (2L) with electronics 50K',
  'G-03': 'Low income (2L) with gold/jewellery 2L',
  'G-04': 'Low income (2L) with fixed deposits 1L',
  'G-05': 'Kuccha housing declared with total assets 1L',
  'G-06': 'Rented housing declared alongside land ownership',
  'G-07': 'Government benefits active with income 5L',
  'G-08': 'ML Isolation Forest anomaly score  0.65 threshold',
}

export default function AdminReviewPage() {
  const [queue, setQueue] = useState<{ anomaly_flagged: FlaggedApp[]; review_band: FlaggedApp[] }>({ anomaly_flagged: [], review_band: [] })
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/proxy/officer/review-queue', { credentials: 'include' })
      .then(r => r.json()).then(d => { setQueue(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleClear(id: string) {
    setActing(id)
    const res = await fetch(`/api/proxy/officer/review/${id}/clear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cleared by administrator after review' }), credentials: 'include',
    })
    if (res.ok) setQueue(q => ({ ...q, anomaly_flagged: q.anomaly_flagged.filter(a => a.id !== id) }))
    setActing(null)
  }

  async function handleReject(id: string) {
    if (!reason.trim()) return
    setActing(id)
    const res = await fetch(`/api/proxy/officer/review/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }), credentials: 'include',
    })
    if (res.ok) { setQueue(q => ({ ...q, anomaly_flagged: q.anomaly_flagged.filter(a => a.id !== id) })); setRejectId(null); setReason('') }
    setActing(null)
  }

  const total = queue.anomaly_flagged.length + queue.review_band.length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Flagged Cases</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {queue.anomaly_flagged.length} flagged for review  {queue.review_band.length} in verification discrepancy band
            </p>
          </div>
          {queue.anomaly_flagged.length > 0 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-red-50 border border-red-200 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-700">{queue.anomaly_flagged.length} need action</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Anomaly Flagged */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-red-600">System-Flagged Applications  Action Required ({queue.anomaly_flagged.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : queue.anomaly_flagged.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="font-semibold text-slate-700">No flagged applications</p>
              <p className="text-slate-400 text-sm mt-1">All submitted applications passed system checks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...queue.anomaly_flagged].sort((a, b) => b.anomaly_score - a.anomaly_score).map(app => {
                const isRej = rejectId === app.id
                const flags = [...(app.anomaly_reasons?.g_rules_fired ?? []), ...(app.anomaly_reasons?.ml_flag ? ['G-08'] : [])]

                return (
                  <div key={app.id} className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{app.user?.full_name}</span>
                            <span className="text-slate-400 text-sm">{app.user?.email}</span>
                            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">
                              {flags.length} rule{flags.length !== 1 ? 's' : ''} fired
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{app.program?.program_name}</p>
                        </div>
                      </div>

                      {/* Always-visible flagging reasons */}
                      <div className="mt-4 space-y-2">
                        {flags.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No specific rules recorded</p>
                        ) : flags.map(rule => (
                          <div key={rule} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm
                            ${rule === 'G-08' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                            <code className={`font-bold text-xs w-10 flex-shrink-0 mt-0.5 ${rule === 'G-08' ? 'text-red-600' : 'text-orange-600'}`}>{rule}</code>
                            <span className="text-slate-700">{G_RULE_DESC[rule] ?? 'Anomaly detected by ML model'}</span>
                          </div>
                        ))}
                      </div>

                      {isRej && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Rejection Reason <span className="text-red-500">*</span></label>
                          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Provide a clear reason for rejection"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        {!isRej ? (
                          <>
                            <button onClick={() => handleClear(app.id)} disabled={acting === app.id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                              <CheckCircle2 className="w-3.5 h-3.5" />{acting === app.id ? 'Processing' : 'Approve & Continue'}
                            </button>
                            <button onClick={() => { setRejectId(app.id); setReason('') }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors">
                              <XCircle className="w-3.5 h-3.5" />Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleReject(app.id)} disabled={!reason.trim() || acting === app.id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                              {acting === app.id ? 'Rejecting' : 'Confirm Rejection'}
                            </button>
                            <button onClick={() => setRejectId(null)}
                              className="px-4 py-2 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors">
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Verification review band */}
        {queue.review_band.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-600">Verification Discrepancy Band  Match 5079% ({queue.review_band.length})</h2>
            </div>
            <div className="space-y-2.5">
              {queue.review_band.map(app => (
                <div key={app.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900">{app.user?.full_name}</div>
                    <div className="text-xs text-slate-400">{app.user?.email}  {app.program?.program_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.anomaly_flag && <span className="px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold">Anomaly</span>}
                    <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">Match 5079%  0.85 penalty</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
