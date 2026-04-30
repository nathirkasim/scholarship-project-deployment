'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, AlertTriangle, CheckCircle2, ArrowRight, Clock, User } from 'lucide-react'

interface Assignment {
  id: string
  application_id: string
  priority_score: number
  verification_priority: number
  status: string
  assigned_at: string
  due_date: string | null
  application: {
    composite_score: number | null
    anomaly_score: number | null
    anomaly_flag: boolean
    user: { full_name: string; phone?: string }
    program: { program_name: string }
  }
}

export default function VerifierDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<'pending' | 'completed' | 'all'>('pending')

  useEffect(() => {
    fetch('/api/proxy/verification/assignments', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setAssignments(d.assignments || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = assignments.filter(a =>
    filter === 'all' ? true
    : filter === 'pending' ? ['pending', 'in_progress'].includes(a.status)
    : a.status === 'complete'
  )
  const pending = assignments.filter(a => ['pending', 'in_progress'].includes(a.status)).length
  const done    = assignments.filter(a => a.status === 'complete').length

  return (
    <div>
      {/* Page header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Field Verification Assignments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your scheduled home visit schedule  conduct visits in the order shown below</p>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Assigned', value: assignments.length, cls: 'text-blue-800 bg-blue-50 border-blue-200' },
            { label: 'Pending',        value: pending,            cls: 'text-amber-800 bg-amber-50 border-amber-300' },
            { label: 'Completed',      value: done,               cls: 'text-green-800 bg-green-50 border-green-300' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`rounded border px-4 py-4 text-center ${cls}`}>
              <div className="text-3xl font-bold">{value}</div>
              <div className="text-xs font-semibold mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        {pending > 0 && (
          <div className="bg-blue-50 border border-blue-300 rounded px-4 py-3 text-sm text-blue-900">
            <strong>Instructions:</strong> Conduct visits in priority order (lowest number = highest priority).
            Carry your photo ID and authorisation letter. Record GPS location and photographs at each visit.
            For priority review cases, ensure thorough inspection of all declared assets and documents.
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 border-b border-gray-300 pb-0">
          {(['pending', 'completed', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize transition-colors
                ${filter === f
                  ? 'border-blue-800 text-blue-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {f === 'pending' ? `Pending (${pending})` : f === 'completed' ? `Completed (${done})` : `All (${assignments.length})`}
            </button>
          ))}
        </div>

        {/* Assignment list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-blue-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">
              {filter === 'pending' ? 'No pending assignments' : filter === 'completed' ? 'No completed visits yet' : 'No assignments'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...filtered]
              .sort((a, b) => (a.verification_priority ?? 99) - (b.verification_priority ?? 99))
              .map((a, idx) => {
                const app       = a.application
                const isPending = ['pending', 'in_progress'].includes(a.status)

                return (
                  <div key={a.id} className={`bg-white border rounded overflow-hidden
                    ${app.anomaly_flag
                      ? 'border-orange-400 border-l-4 border-l-orange-500'
                      : isPending ? 'border-gray-300' : 'border-green-300'}`}>

                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">

                        {/* Visit number + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border
                            ${isPending
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-green-50 text-green-800 border-green-300'}`}>
                            Visit #{a.verification_priority ?? (idx + 1)}
                          </span>
                          {app.anomaly_flag && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border bg-orange-50 text-orange-800 border-orange-300">
                              <AlertTriangle className="w-3 h-3" />
                              Priority Review Required
                            </span>
                          )}
                          {!isPending && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border bg-green-50 text-green-800 border-green-300">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </span>
                          )}
                        </div>

                        {/* Applicant info */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-bold text-gray-900">{app.user?.full_name}</span>
                          {app.user?.phone && <span className="text-sm text-gray-500"> {app.user.phone}</span>}
                        </div>
                        <p className="text-sm text-gray-500 ml-6">{app.program?.program_name}</p>

                        {/* Due date + assigned date */}
                        <div className="flex items-center gap-5 mt-2 ml-6 text-xs text-gray-500 flex-wrap">
                          {a.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Due: <strong className="text-gray-700">{new Date(a.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            Assigned: {new Date(a.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>

                      {/* CTA */}
                      {isPending ? (
                        <Link href={`/verifier/visit/${a.id}`}
                          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold text-sm rounded transition-colors">
                          Begin Visit <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700 px-3 py-2 bg-green-50 border border-green-300 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
