'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Plus, Search, CheckCircle2, X, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'

const DOMAIN_META: Record<string, { name: string; color: string; bg: string; border: string }> = {
  A: { name: 'Academic', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  B: { name: 'Income', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  C: { name: 'Family', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  D: { name: 'Assets', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  E: { name: 'Housing', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  F: { name: 'Social', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  G: { name: 'Integrity', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  H: { name: 'Composite', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
  I: { name: 'Thresholds', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  J: { name: 'Awards', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
}

const RULE_TYPES = ['SCORE', 'DEDUCTION', 'COMPOSITE', 'THRESHOLD', 'AWARD', 'CONFIG']
const TYPE_STYLE: Record<string, string> = {
  SCORE: 'bg-teal-100 text-teal-800', DEDUCTION: 'bg-red-100 text-red-800',
  COMPOSITE: 'bg-blue-100 text-blue-800', THRESHOLD: 'bg-indigo-100 text-indigo-800',
  AWARD: 'bg-emerald-100 text-emerald-800', CONFIG: 'bg-slate-100 text-slate-700',
}

const BLANK = { rule_code: '', rule_name: '', rule_description: '', domain: 'A', rule_type: 'SCORE', score_pts: 0, is_active: true, sort_order: 100 }

export default function AdminRulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    fetch('/api/proxy/admin/rules', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setRules(d.rules || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    try {
      const url = editing ? `/api/proxy/admin/rules/${editing}` : '/api/proxy/admin/rules'
      await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, score_pts: Number(form.score_pts) }),
      })
      showToast(editing ? 'Rule updated' : 'Rule created')
      setShowForm(false); setEditing(null); setForm({ ...BLANK })
      load()
    } finally { setSaving(false) }
  }

  async function toggleActive(rule: any) {
    await fetch(`/api/proxy/admin/rules/${rule.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    setRules(r => r.map(x => x.id === rule.id ? { ...x, is_active: !rule.is_active } : x))
    showToast(rule.is_active ? 'Rule deactivated' : 'Rule activated')
  }

  function startEdit(r: any) {
    setForm({ ...r }); setEditing(r.id); setShowForm(true)
  }

  const domains = ['ALL', ...Array.from(new Set(rules.map(r => r.domain))).sort()]
  const filtered = rules
    .filter(r => domain === 'ALL' || r.domain === domain)
    .filter(r => !search || r.rule_name?.toLowerCase().includes(search.toLowerCase()) || r.rule_code?.toLowerCase().includes(search.toLowerCase()))

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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-bold text-slate-900">{editing ? 'Edit Rule' : 'New Rule'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rule Code</label>
                  <input value={form.rule_code} onChange={e => setForm((f: any) => ({ ...f, rule_code: e.target.value }))} placeholder="e.g. A-01"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Domain</label>
                  <select value={form.domain} onChange={e => setForm((f: any) => ({ ...f, domain: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white">
                    {Object.entries(DOMAIN_META).map(([k, v]) => <option key={k} value={k}>{k}  {v.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rule Name</label>
                <input value={form.rule_name} onChange={e => setForm((f: any) => ({ ...f, rule_name: e.target.value }))} placeholder="Human-readable name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.rule_description} onChange={e => setForm((f: any) => ({ ...f, rule_description: e.target.value }))} rows={2} placeholder="Explain the rule logic"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                  <select value={form.rule_type} onChange={e => setForm((f: any) => ({ ...f, rule_type: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white">
                    {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Score Pts</label>
                  <input type="number" step="0.5" value={form.score_pts} onChange={e => setForm((f: any) => ({ ...f, score_pts: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm((f: any) => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
                {saving ? 'Saving' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Rules Config</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{rules.length} rules</span>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditing(null); setForm({ ...BLANK }) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New Rule
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {domains.map(d => {
            const meta = DOMAIN_META[d]
            return (
              <button key={d} onClick={() => setDomain(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border
                  ${domain === d
                    ? (meta ? `${meta.bg} ${meta.color} ${meta.border}` : 'bg-blue-700 text-white border-blue-700')
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                {d === 'ALL' ? 'All Domains' : `${d}  ${meta?.name ?? d}`}
              </button>
            )
          })}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input placeholder="Search rules" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rule</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Pts</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400">No rules found</td></tr>
              ) : filtered.map(rule => {
                const meta = DOMAIN_META[rule.domain]
                const pts = Number(rule.score_pts)
                return (
                  <tr key={rule.id} className={`hover:bg-slate-50 transition-colors ${rule.is_active ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold text-sm ${meta?.color ?? 'text-slate-700'}`}>{rule.rule_code}</span>
                    </td>
                    <td className="px-4 py-3">
                      {meta && (
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>{meta.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{rule.rule_name}</div>
                      {rule.rule_description && <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{rule.rule_description}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TYPE_STYLE[rule.rule_type] ?? 'bg-slate-100 text-slate-600'}`}>{rule.rule_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${pts < 0 ? 'text-red-600' : pts > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {pts > 0 ? '+' : ''}{pts}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => startEdit(rule)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleActive(rule)} className="p-1.5 rounded-lg transition-colors hover:bg-slate-100">
                          {rule.is_active
                            ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                            : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-400 flex-shrink-0">
        Showing {filtered.length} of {rules.length} rules
      </div>
    </div>
  )
}
