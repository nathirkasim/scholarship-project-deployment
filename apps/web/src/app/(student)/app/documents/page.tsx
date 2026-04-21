'use client'

import { useEffect, useState } from 'react'
import { Upload, FileText, CheckCircle2, XCircle, Clock, Download, RefreshCw, ChevronRight, Info } from 'lucide-react'
import Link from 'next/link'

interface Doc {
  id: string
  doc_type: string
  original_name: string
  status: string
  created_at: string
  rejection_note?: string
}

const DOC_LABELS: Record<string, { label: string; required: boolean }> = {
  aadhaar:        { label: 'Aadhaar Card (front & back)',                  required: true  },
  income_cert:    { label: 'Income Certificate (current financial year)',   required: true  },
  marksheet_hsc:  { label: 'HSC / 12th Board Marksheet',                  required: true  },
  admission_proof:{ label: 'Admission / Enrolment Proof',                  required: true  },
  bank_passbook:  { label: 'Bank Passbook  first page (with IFSC)',       required: true  },
  caste_cert:     { label: 'Caste Certificate (SC / ST / OBC)',            required: false },
  disability_cert:{ label: 'Disability Certificate (if applicable)',        required: false },
  ug_marksheet:   { label: 'UG Previous Semester / Year Marksheet',        required: false },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: 'Under Review', cls: 'bg-amber-100 text-amber-800 border-amber-300',   icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Accepted',     cls: 'bg-green-100 text-green-800 border-green-400',   icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: 'Rejected',     cls: 'bg-red-100 text-red-800 border-red-300',         icon: <XCircle className="w-3 h-3" /> },
}

export default function DocumentsPage() {
  const [docs,      setDocs]      = useState<Doc[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  async function fetchDocs() {
    const res = await fetch('/api/proxy/documents/my', { credentials: 'include' })
    if (res.ok) { setDocs(await res.json()); setLoading(false) } else setLoading(false)
  }
  useEffect(() => { fetchDocs() }, [])

  async function upload(type: string, file: File) {
    setUploading(p => ({ ...p, [type]: true }))
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('document_type', type)
      const res = await fetch('/api/proxy/documents/upload', { method: 'POST', credentials: 'include', body })
      if (res.ok) { showToast(`${DOC_LABELS[type]?.label ?? type} uploaded successfully`); fetchDocs() }
      else showToast('Upload failed. Max 5 MB, PDF / JPG / PNG only.', false)
    } finally { setUploading(p => ({ ...p, [type]: false })) }
  }

  async function download(docId: string) {
    const res = await fetch(`/api/proxy/documents/${docId}/download`, { credentials: 'include' })
    if (!res.ok) { showToast('Could not download file', false); return }
    const { url } = await res.json()
    window.open(url, '_blank')
  }

  const uploadedMap = new Map(docs.map(d => [d.doc_type, d]))
  const pending  = docs.filter(d => d.status === 'pending').length
  const accepted = docs.filter(d => d.status === 'approved').length
  const rejected = docs.filter(d => d.status === 'rejected').length

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded shadow-lg text-sm font-medium flex items-center gap-2
          ${toast.ok ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <Link href="/app/dashboard" className="hover:underline">My Application</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-medium text-gray-700">Document Upload</span>
      </div>

      {/* Page header */}
      <div className="bg-white border border-gray-300 rounded px-5 py-4">
        <h1 className="text-lg font-bold text-gray-900">Document Upload</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload and manage your supporting documents for the scholarship application</p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-300 rounded px-5 py-4 text-sm text-blue-900">
        <p className="font-semibold mb-1.5 flex items-center gap-1.5"><Info className="w-4 h-4" /> Document Upload Guidelines</p>
        <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
          <li>Documents marked <strong>Mandatory</strong> must be uploaded. Your application will not be processed without them.</li>
          <li>Accepted file formats: <strong>PDF, JPG, JPEG, PNG</strong>  Maximum <strong>5 MB</strong> per file.</li>
          <li>Documents must be clear, legible and not password-protected. Blurred or incomplete documents will be rejected.</li>
          <li>Income certificate must be issued within the current financial year by a competent authority (tehsildar or gazetted officer).</li>
          <li>You may replace a document before your application is under review. Once reviewed, contact the helpdesk.</li>
        </ul>
      </div>

      {/* Summary stats */}
      {!loading && docs.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Uploaded', value: docs.length,        cls: 'text-blue-800 bg-blue-50 border-blue-200' },
            { label: 'Accepted',       value: accepted,           cls: 'text-green-800 bg-green-50 border-green-300' },
            { label: 'Under Review',   value: pending,            cls: 'text-amber-800 bg-amber-50 border-amber-300' },
            { label: 'Rejected',       value: rejected,           cls: rejected > 0 ? 'text-red-800 bg-red-50 border-red-300' : 'text-gray-500 bg-gray-50 border-gray-200' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`rounded border px-4 py-3 text-center ${cls}`}>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs font-semibold mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Document table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-800 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-300 rounded overflow-hidden">
          <div className="px-5 py-3 bg-gray-100 border-b border-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-700" />
            <h2 className="font-semibold text-gray-800 text-sm">Required Documents Checklist</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide w-8">#</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Document</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Required</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Status</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(DOC_LABELS).map(([type, meta], i) => {
                const doc = uploadedMap.get(type)
                const sc  = doc ? STATUS_CONFIG[doc.status] : null
                return (
                  <tr key={type} className={`hover:bg-gray-50 ${doc?.status === 'rejected' ? 'bg-red-50' : ''}`}>
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{meta.label}</div>
                      {doc && <div className="text-xs text-gray-400 mt-0.5">{doc.original_name}</div>}
                      {doc?.rejection_note && (
                        <div className="text-xs text-red-700 mt-0.5 font-medium">Reason: {doc.rejection_note}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {meta.required
                        ? <span className="text-red-600 font-bold text-xs">Mandatory</span>
                        : <span className="text-gray-400 text-xs">If applicable</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sc ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${sc.cls}`}>
                          {sc.icon} {sc.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Not uploaded</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {doc && (
                          <button onClick={() => download(doc.id)}
                            className="p-1.5 rounded border border-gray-300 text-gray-500 hover:text-blue-700 hover:border-blue-300 transition-colors"
                            title="Download">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => e.target.files?.[0] && upload(type, e.target.files[0])}
                            disabled={uploading[type]} />
                          <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded transition-colors
                            ${uploading[type]
                              ? 'bg-gray-100 text-gray-400 border-gray-300'
                              : doc
                              ? 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                              : 'bg-blue-800 text-white border-blue-800 hover:bg-blue-900'}`}>
                            {uploading[type]
                              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Uploading</>
                              : doc
                              ? <><Upload className="w-3 h-3" /> Replace</>
                              : <><Upload className="w-3 h-3" /> Upload</>}
                          </span>
                        </label>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
            Max 5 MB per file &nbsp;&nbsp; Accepted formats: PDF, JPG, PNG
          </div>
        </div>
      )}

      {/* Rejected warning */}
      {rejected > 0 && (
        <div className="bg-red-50 border border-red-400 rounded px-4 py-3 text-sm text-red-800">
          <strong>{rejected} document{rejected > 1 ? 's have' : ' has'} been rejected.</strong>{' '}
          Please re-upload the corrected file(s) at the earliest to avoid delays in processing your application.
        </div>
      )}
    </div>
  )
}
