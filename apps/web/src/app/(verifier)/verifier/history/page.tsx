'use client'

import { useEffect, useState } from 'react'
import { History, CheckCircle2, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

interface Report {
  id: string
  submitted_at: string
  match_score: number | null
  verifier_notes: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  assignment: {
    application: {
      user: { full_name: string }
      program: { program_name: string }
    }
  }
}

export default function VerifierHistoryPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/proxy/verification/my-reports', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setReports(d.reports || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const avgMatch = reports.length > 0
    ? (reports.reduce((s, r) => s + Number(r.match_score ?? 0), 0) / reports.length).toFixed(1)
    : ''

  return (
    <div>
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Visit History</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{reports.length} reports</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">All field verification reports you have submitted</p>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Visits', value: reports.length, cls: 'text-blue-700 bg-blue-50' },
            { label: 'Avg Match Score', value: `${avgMatch}%`, cls: 'text-emerald-700 bg-emerald-50' },
            { label: 'With GPS', value: reports.filter(r => r.gps_latitude != null).length, cls: 'text-purple-700 bg-purple-50' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`rounded-2xl border border-slate-200 shadow-sm p-4 text-center ${cls.split(' ')[1]} border-transparent`}>
              <div className={`text-2xl font-bold ${cls.split(' ')[0]}`}>{value}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            No reports submitted yet
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const app = r.assignment.application
              const match = Number(r.match_score ?? 0)
              const matchColor = match >= 80 ? 'text-emerald-600' : match >= 50 ? 'text-amber-600' : 'text-red-600'
              const matchBar = match >= 80 ? 'bg-emerald-500' : match >= 50 ? 'bg-amber-500' : 'bg-red-500'
              const isOpen = expanded === r.id
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{app.user.full_name}</span>
                        <span className="text-sm text-slate-400">{app.program.program_name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-xs">
                          <div className={`h-full rounded-full ${matchBar}`} style={{ width: `${match}%` }} />
                        </div>
                        <span className={`text-sm font-bold ${matchColor}`}>{match.toFixed(0)}% match</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 mt-2 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 mt-2 ml-auto" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50">
                      {r.gps_latitude && (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                          <MapPin className="w-3.5 h-3.5" />
                          GPS: {Number(r.gps_latitude ?? 0).toFixed(5)}, {Number(r.gps_longitude ?? 0).toFixed(5)}
                        </div>
                      )}

                      {r.verifier_notes && (
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="text-xs font-semibold text-slate-500 mb-1">Notes</div>
                          <p className="text-sm text-slate-700">{r.verifier_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
