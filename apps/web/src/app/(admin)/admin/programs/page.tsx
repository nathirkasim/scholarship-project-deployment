'use client'

import { useEffect, useState } from 'react'
import { BookMarked, Plus, CheckCircle2, XCircle, Calendar, Users, Edit2, X } from 'lucide-react'

interface Program {
  id: string
  program_code: string
  program_name: string
  academic_year: string
  total_seats: number
  waitlist_seats: number
  application_deadline: string | null
  is_active: boolean
  created_at: string
}

const EMPTY: Partial<Program> = {
  program_code: '', program_name: '', academic_year: '', total_seats: 50, waitlist_seats: 50, application_deadline: '', is_active: true,
}

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({ ...EMPTY })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    fetch('/api/proxy/programs', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setPrograms(d.programs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    try {
      const url = editing ? `/api/proxy/admin/programs/${editing}` : '/api/proxy/admin/programs'
      await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      showToast(editing ? 'Program updated' : 'Program created')
      setShowForm(false); setEditing(null); setForm({ ...EMPTY })
      load()
    } finally { setSaving(false) }
  }

  function startEdit(p: Program) {
    setForm({ ...p, application_deadline: p.application_deadline?.slice(0, 10) || '' })
    setEditing(p.id)
    setShowForm(true)
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm sticky top-0 z-30 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Scholarship Programs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage programs</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ ...EMPTY }) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Program
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">{editing ? 'Edit Program' : 'New Program'}</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Program Code', key: 'program_code', placeholder: 'e.g. SCH-2025-A' },
                  { label: 'Program Name', key: 'program_name', placeholder: 'e.g. Merit-cum-Means Scholarship 2025' },
                  { label: 'Academic Year', key: 'academic_year', placeholder: 'e.g. 2025-26' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                    <input
                      value={form[key] || ''}
                      onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Total Seats</label>
                    <input type="number" value={form.total_seats || ''} onChange={e => setForm((f: any) => ({ ...f, total_seats: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Waitlist Seats</label>
                    <input type="number" value={form.waitlist_seats || ''} onChange={e => setForm((f: any) => ({ ...f, waitlist_seats: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Application Deadline</label>
                  <input type="date" value={form.application_deadline || ''} onChange={e => setForm((f: any) => ({ ...f, application_deadline: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium text-slate-700">Active (accepting applications)</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-5">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
                  {saving ? 'Saving' : 'Save Program'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <BookMarked className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            No programs yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {programs.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900">{p.program_name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.is_active ? 'Active' : 'Closed'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{p.program_code}  {p.academic_year}</p>
                    </div>
                    <button onClick={() => startEdit(p)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-900">{p.total_seats}</span> seats + {p.waitlist_seats} waitlist
                    </div>
                    {p.application_deadline && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Deadline: {new Date(p.application_deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
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
