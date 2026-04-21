'use client'

import { useEffect, useState } from 'react'
import { Users, Search, UserCog, GraduationCap, ClipboardCheck, CheckCircle2 } from 'lucide-react'

interface User {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  created_at: string
}

const ROLE_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  student:     { label: 'Student',     cls: 'bg-blue-100 text-blue-700 border-blue-200',      icon: <GraduationCap className="w-3 h-3" /> },
  verifier:    { label: 'Verifier',    cls: 'bg-purple-100 text-purple-700 border-purple-200', icon: <ClipboardCheck className="w-3 h-3" /> },
  super_admin: { label: 'Super Admin', cls: 'bg-red-100 text-red-700 border-red-200',         icon: <UserCog className="w-3 h-3" /> },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/proxy/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleActive(userId: string, current: boolean) {
    await fetch(`/api/proxy/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_active: !current }),
    })
    setUsers(u => u.map(x => x.id === userId ? { ...x, is_active: !current } : x))
    setToast(current ? 'User deactivated' : 'User activated')
    setTimeout(() => setToast(''), 3000)
  }

  async function changeRole(userId: string, role: string) {
    await fetch(`/api/proxy/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    })
    setUsers(u => u.map(x => x.id === userId ? { ...x, role } : x))
    setToast('Role updated')
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !search || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchR = roleFilter === 'all' || u.role === roleFilter
    return matchQ && matchR
  })

  const roles = ['all', 'student', 'verifier', 'super_admin']

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{users.length} users</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Manage roles, access, and account status</p>
      </div>

      <div className="flex flex-col h-[calc(100vh-73px)]">
        {/* Filters */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              placeholder="Search by name or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors
                  ${roleFilter === r ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {r === 'all' ? 'All Roles' : ROLE_CONFIG[r]?.label ?? r}
              </button>
            ))}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">Joined</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-slate-400">No users found</td></tr>
                ) : filtered.map(u => {
                  const rc = ROLE_CONFIG[u.role]
                  return (
                    <tr key={u.id} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{u.full_name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                        {u.phone && <div className="text-xs text-slate-400">{u.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                        >
                          {Object.keys(ROLE_CONFIG).map(r => (
                            <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${u.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border
                            ${u.is_active
                              ? 'text-red-600 border-red-200 hover:bg-red-50'
                              : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-400">
          Showing {filtered.length} of {users.length} users
        </div>
      </div>
    </div>
  )
}
