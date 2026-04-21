'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, RefreshCw, CheckCircle2, Clock, Info, FileSpreadsheet } from 'lucide-react'

interface Program { id: string; program_code: string; program_name: string; academic_year: string; is_active: boolean }

export default function AdminReportsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [generated, setGenerated] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/proxy/programs', { credentials: 'include' })
      .then(r => r.json()).then(d => { setPrograms(d.programs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function generate(programId: string, format: 'pdf' | 'csv') {
    const k = `${programId}-${format}`
    setGenerating(g => ({ ...g, [k]: true }))
    try {
      await fetch(`/api/proxy/reports/generate/${programId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ format }),
      })
      setGenerated(g => ({ ...g, [k]: true }))
    } finally { setGenerating(g => ({ ...g, [k]: false })) }
  }

  async function download(programId: string) {
    const res = await fetch(`/api/proxy/reports/${programId}/download`, { credentials: 'include' })
    const d = await res.json()
    if (d.url) window.open(d.url, '_blank')
    else alert(d.message || 'Report not ready. Please generate it first.')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30">
        <h1 className="text-lg font-bold text-slate-900">Selection Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Generate and download PDF / CSV reports per program</p>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-5">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-bold mb-1">Report Contents  9 Sections</p>
            <p className="text-blue-600 leading-relaxed">Program summary  Statistics  Approved / Rejected / Waitlisted lists ranked by composite score  Integrity deduction breakdown  Verification summary  Demographics  ML insights</p>
            <p className="mt-2 text-xs text-blue-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Report generation is queued in the background. Large programs may take 12 minutes.</p>
          </div>
        </div>

        {/* Programs */}
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : programs.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">No programs available</div>
        ) : (
          <div className="space-y-4">
            {programs.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-bold text-slate-900">{p.program_name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.is_active ? 'Active' : 'Closed'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{p.program_code}  {p.academic_year}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* PDF */}
                    <button onClick={() => generate(p.id, 'pdf')} disabled={generating[`${p.id}-pdf`]}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors disabled:opacity-50">
                      {generating[`${p.id}-pdf`] ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating</> : <><FileText className="w-4 h-4 text-red-500" />Generate PDF</>}
                    </button>
                    {generated[`${p.id}-pdf`] && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />PDF queued</span>}

                    {/* CSV */}
                    <button onClick={() => generate(p.id, 'csv')} disabled={generating[`${p.id}-csv`]}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors disabled:opacity-50">
                      {generating[`${p.id}-csv`] ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating</> : <><FileSpreadsheet className="w-4 h-4 text-emerald-500" />Generate CSV</>}
                    </button>
                    {generated[`${p.id}-csv`] && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />CSV queued</span>}

                    <div className="h-5 w-px bg-slate-200 mx-1" />

                    {/* Download */}
                    <button onClick={() => download(p.id)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors shadow-sm">
                      <Download className="w-4 h-4" />Download Report
                    </button>

                    {(generated[`${p.id}-pdf`] || generated[`${p.id}-csv`]) && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Clock className="w-3.5 h-3.5" />Processing in background</span>
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
