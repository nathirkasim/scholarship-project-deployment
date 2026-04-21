'use client'

import { useEffect, useState } from 'react'
import { Building2, Search, Plus, CheckCircle2, X, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Institution {
  id: string
  institution_name: string
  institution_code: string
  institution_type: string
  city: string | null
  state: string | null
  is_recognized: boolean
  is_active: boolean
}

const BLANK = { institution_name: '', institution_code: '', institution_type: 'university', city: '', state: '', is_recognized: true, is_active: true }

export default function AdminInstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    fetch('/api/proxy/admin/institutions', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setInstitutions(d.institutions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    try {
      const url = editing ? `/api/proxy/admin/institutions/${editing}` : '/api/proxy/admin/institutions'
      await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      showToast(editing ? 'Institution updated' : 'Institution added')
      setShowForm(false); setEditing(null); setForm({ ...BLANK })
      load()
    } finally { setSaving(false) }
  }

  async function toggle(inst: Institution) {
    await fetch(`/api/proxy/admin/institutions/${inst.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ is_active: !inst.is_active }),
    })
    setInstitutions(l => l.map(x => x.id === inst.id ? { ...x, is_active: !inst.is_active } : x))
  }

  const filtered = institutions.filter(i =>
    !search ||
    i.institution_name.toLowerCase().includes(search.toLowerCase()) ||
    i.institution_code.toLowerCase().includes(search.toLowerCase()) ||
    (i.city || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-screen">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? 'Edit Institution' : 'Add Institution'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Institution Name', key: 'institution_name', placeholder: 'e.g. Anna University' },
                { label: 'Institution Code', key: 'institution_code', placeholder: 'e.g. AU-CHN' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                  <select value={form.institution_type} onChange={e => setForm((f: any) => ({ ...f, institution_type: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white">
                    {['university', 'college', 'polytechnic', 'school', 'iti'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
                  <input value={form.city} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} placeholder="Chennai"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">State</label>
                  <input value={form.state} onChange={e => setForm((f: any) => ({ ...f, state: e.target.value }))} placeholder="Tamil Nadu"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.is_recognized} onChange={e => setForm((f: any) => ({ ...f, is_recognized: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium text-slate-700">Recognized</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Recognized Institutions</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{institutions.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 w-52" />
          </div>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm({ ...BLANK }) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Institution</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Recognized</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400">No institutions found</td></tr>
              ) : filtered.map(inst => (
                <tr key={inst.id} className={`hover:bg-slate-50 transition-colors ${inst.is_active ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{inst.institution_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{inst.institution_code}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{inst.institution_type}</td>
                  <td className="px-4 py-3 text-slate-500">{[inst.city, inst.state].filter(Boolean).join(', ') || ''}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${inst.is_recognized ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {inst.is_recognized ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setForm({ ...inst }); setEditing(inst.id); setShowForm(true) }} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggle(inst)} className="p-1.5 rounded-lg hover:bg-slate-100">
                        {inst.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-400 flex-shrink-0">
        Showing {filtered.length} of {institutions.length} institutions
      </div>
    </div>
  )
}
