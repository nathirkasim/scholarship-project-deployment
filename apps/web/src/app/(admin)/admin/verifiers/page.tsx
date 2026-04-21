'use client'

import { useEffect, useState } from 'react'
import { UserCheck, Search, ClipboardList, CheckCircle2, Clock, AlertTriangle, Plus } from 'lucide-react'

interface Verifier { id: string; full_name: string; email: string; phone?: string }
interface Assignment {
  id: string; status: string; assigned_at: string
  application: { id: string; anomaly_flag: boolean; composite_score: number | null; user: { full_name: string }; program: { program_name: string } }
  verifier: { id: string; full_name: string }
}

export default function AdminVerifiersPage() {
  const [verifiers, setVerifiers] = useState<Verifier[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [pendingApps, setPendingApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedVerifier, setSelectedVerifier] = useState('')
  const [selectedApp, setSelectedApp] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    const [v, a, s] = await Promise.all([
      fetch('/api/proxy/verifiers', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/proxy/verification/assignments', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/proxy/officer/applications?status=verification_pending', { credentials: 'include' }).then(r => r.json()),
    ])
    setVerifiers(v.verifiers || [])
    setAssignments(a.assignments || [])
    const assigned = new Set((a.assignments || []).map((x: Assignment) => x.application.id))
    setPendingApps((s.applications || []).filter((x: any) => !assigned.has(x.id)))
    setLoading(false)
  }

  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  async function assign() {
    if (!selectedVerifier || !selectedApp) return
    setAssigning(true)
    await fetch('/api/proxy/verification/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ verifier_id: selectedVerifier, application_id: selectedApp }),
    })
    setToast('Verifier assigned'); setTimeout(() => setToast(''), 3000)
    setSelectedVerifier(''); setSelectedApp('')
    await load()
    setAssigning(false)
  }

  const filtered = assignments.filter(a =>
    !search || a.application.user.full_name.toLowerCase().includes(search.toLowerCase()) || a.verifier.full_name.toLowerCase().includes(search.toLowerCase())
  )
  const pending = assignments.filter(a => a.status === 'pending').length
  const completed = assignments.filter(a => a.status === 'complete').length
  const selCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="min-h-screen bg-slate-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />{toast}
        </div>
      )}
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30">
        <h1 className="text-lg font-bold text-slate-900">Field Verifiers</h1>
        <p className="text-sm text-slate-500 mt-0.5">Assign verifiers to applications awaiting field verification</p>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Assignments', value: assignments.length, icon: ClipboardList, cls: 'bg-blue-50 text-blue-600' },
            { label: 'Pending Visits', value: pending, icon: Clock, cls: 'bg-amber-50 text-amber-600' },
            { label: 'Completed', value: completed, icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}><Icon className="w-5 h-5" /></div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Plus className="w-4 h-4 text-blue-600" /></div>
            <h2 className="font-bold text-slate-900">New Assignment</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Field Verifier</label>
              <select value={selectedVerifier} onChange={e => setSelectedVerifier(e.target.value)} className={selCls}>
                <option value="">Select verifier</option>
                {verifiers.map(v => <option key={v.id} value={v.id}>{v.full_name}  {v.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Application <span className="text-slate-400 font-normal normal-case">(awaiting verification)</span>
              </label>
              <select value={selectedApp} onChange={e => setSelectedApp(e.target.value)} className={selCls}>
                <option value="">Select application</option>
                {pendingApps.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.user?.full_name}  TOPSIS {a.composite_score?.toFixed(1) ?? ''}{a.anomaly_flag ? ' ' : ''}
                  </option>
                ))}
              </select>
              {pendingApps.length === 0 && !loading && (
                <p className="text-xs text-amber-600 mt-1">No unassigned apps pending verification. Use "Trigger Verification" in Applications first.</p>
              )}
            </div>
          </div>
          <button onClick={assign} disabled={assigning || !selectedVerifier || !selectedApp}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
            <UserCheck className="w-4 h-4" />{assigning ? 'Assigning' : 'Assign Verifier'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">All Assignments <span className="text-slate-400 font-normal ml-1">({assignments.length})</span></h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No assignments yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(a => (
                <div key={a.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.status === 'complete' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{a.application.user.full_name}</span>
                      {a.application.anomaly_flag && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-orange-50 border border-orange-200 text-orange-700">
                          <AlertTriangle className="w-3 h-3" />Anomaly
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold capitalize ${a.status === 'complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{a.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{a.application.program.program_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><UserCheck className="w-3 h-3" />{a.verifier.full_name}</p>
                  </div>
                  {a.application.composite_score != null && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-slate-900">{Number(a.application.composite_score).toFixed(1)}</div>
                      <div className="text-[11px] text-slate-400">TOPSIS score</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
