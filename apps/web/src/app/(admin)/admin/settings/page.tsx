'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, CheckCircle2, Bell, Shield, Globe, Clock } from 'lucide-react'

interface AppSettings {
  app_name: string
  support_email: string
  max_applications_per_user: number
  enable_notifications: boolean
  require_doc_upload: boolean
  verification_gps_required: boolean
  session_timeout_minutes: number
  maintenance_mode: boolean
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    app_name: 'Scholarship Selection Platform',
    support_email: 'support@scholarship.org',
    max_applications_per_user: 3,
    enable_notifications: true,
    require_doc_upload: true,
    verification_gps_required: false,
    session_timeout_minutes: 60,
    maintenance_mode: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/proxy/admin/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.settings) setSettings(d.settings); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/proxy/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      })
      showToast('Settings saved successfully')
    } finally { setSaving(false) }
  }

  const sections = [
    {
      title: 'General', icon: Globe, fields: [
        { label: 'Application Name', key: 'app_name', type: 'text', placeholder: 'Scholarship Selection Platform' },
        { label: 'Support Email', key: 'support_email', type: 'email', placeholder: 'support@scholarship.org' },
        { label: 'Max Applications per Student', key: 'max_applications_per_user', type: 'number', placeholder: '3' },
      ],
    },
    {
      title: 'Session & Security', icon: Shield, fields: [
        { label: 'Session Timeout (minutes)', key: 'session_timeout_minutes', type: 'number', placeholder: '60' },
      ],
      toggles: [
        { label: 'Require Document Upload', sub: 'Students must upload documents before submission', key: 'require_doc_upload' },
        { label: 'GPS Required for Verification', sub: 'Field verifiers must have GPS enabled to submit reports', key: 'verification_gps_required' },
      ],
    },
    {
      title: 'Notifications', icon: Bell, fields: [],
      toggles: [
        { label: 'Enable Email Notifications', sub: 'Send status updates to students automatically', key: 'enable_notifications' },
      ],
    },
    {
      title: 'Maintenance', icon: Clock, fields: [],
      toggles: [
        { label: 'Maintenance Mode', sub: 'Disable student access while performing system updates', key: 'maintenance_mode' },
      ],
    },
  ]

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">System Settings</h1>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving' : 'Save Settings'}
        </button>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          sections.map(({ title, icon: Icon, fields, toggles }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
                <Icon className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900">{title}</h2>
              </div>
              <div className="p-6 space-y-4">
                {fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{f.label}</label>
                    <input
                      type={f.type}
                      value={(settings as any)[f.key]}
                      onChange={e => setSettings(s => ({ ...s, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                ))}
                {(toggles || []).map(t => (
                  <div key={t.key} className="flex items-center justify-between gap-4 py-1">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{t.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{t.sub}</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, [t.key]: !(s as any)[t.key] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0
                        ${(settings as any)[t.key] ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full shadow transition-transform
                        ${(settings as any)[t.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
