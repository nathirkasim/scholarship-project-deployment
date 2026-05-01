'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, CheckCircle2 } from 'lucide-react'

interface DiscrepancyApp {
  id: string
  verification_match_score: number | null
  composite_score: number | null
  post_verify_composite: number | null
  anomaly_flag: boolean
  status: string
  user: { full_name: string; email: string }
  program: { program_name: string }
}

export default function AdminReviewPage() {
  const [apps, setApps] = useState<DiscrepancyApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/proxy/officer/applications?status=verification_complete', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const band = (d.applications ?? []).filter(
          (a: DiscrepancyApp) =>
            a.verification_match_score != null &&
            a.verification_match_score >= 50 &&
            a.verification_match_score < 80
        )
        setApps(band)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Verification Discrepancy Band</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Applications with field verification match score 50–79% — composite penalised ×0.85
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : apps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-semibold text-slate-700">No discrepancy cases</p>
            <p className="text-slate-400 text-sm mt-1">All verified applications have a match score ≥ 80%</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-600">
                Match 50–79% — Penalty Applied ({apps.length})
              </h2>
            </div>
            {apps.map(app => (
              <div key={app.id} className="bg-white rounded-xl border border-amber-200 p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-semibold text-slate-900">{app.user?.full_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{app.user?.email} · {app.program?.program_name}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                    <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                      Match {app.verification_match_score != null ? Number(app.verification_match_score).toFixed(1) : '—'}%
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600">
                      Composite {app.composite_score != null ? Number(app.composite_score).toFixed(2) : '—'}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-700">
                      Post-verify {app.post_verify_composite != null ? Number(app.post_verify_composite).toFixed(2) : '—'}
                    </span>
                    {app.anomaly_flag && (
                      <span className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        Anomaly flag
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
