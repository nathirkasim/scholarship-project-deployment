'use client'

import { useEffect, useState } from 'react'
import { UserCheck, ClipboardList, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, MapPin, XCircle, ShieldAlert } from 'lucide-react'

interface Assignment {
  id: string
  status: string
  assigned_at: string
  completed_at?: string
  verification_priority?: number
  application: {
    id: string
    anomaly_flag: boolean
    composite_score: number | null
    verification_match_score: number | null
    post_verify_composite: number | null
    user: { full_name: string }
    program: { program_name: string }
  }
  verifier: { id: string; full_name: string }
}

const statusBadge = (s: string) =>
  s === 'complete'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
  s === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'

const matchColor = (score: number | null) =>
  score == null       ? 'text-slate-400' :
  score >= 80         ? 'text-emerald-600 font-bold' :
  score >= 50         ? 'text-amber-600 font-bold' :
                        'text-red-600 font-bold'

const matchLabel = (score: number | null) =>
  score == null ? '—' :
  score >= 80   ? 'Clean' :
  score >= 50   ? 'Partial mismatch' :
                  'Major mismatch'

export default function AdminVerifiersPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/proxy/verification/assignments', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setAssignments(d.assignments ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const total     = assignments.length
  const pending   = assignments.filter(a => a.status === 'pending').length
  const progress  = assignments.filter(a => a.status === 'in_progress').length
  const complete  = assignments.filter(a => a.status === 'complete').length
  const flagged   = assignments.filter(a =>
    a.status === 'complete' &&
    a.application.verification_match_score != null &&
    a.application.verification_match_score < 80
  ).length

  const autoRejected = assignments.filter(a =>
    a.status === 'complete' &&
    a.application.verification_match_score != null &&
    a.application.verification_match_score < 50
  )
  const penalised = assignments.filter(a =>
    a.status === 'complete' &&
    a.application.verification_match_score != null &&
    a.application.verification_match_score >= 50 &&
    a.application.verification_match_score < 80
  )

  const stats = [
    { label: 'Total Assigned',   value: total,    icon: ClipboardList,  cls: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Visit',    value: pending,  icon: Clock,          cls: 'bg-amber-50 text-amber-600' },
    { label: 'In Progress',      value: progress, icon: UserCheck,      cls: 'bg-blue-50 text-blue-600' },
    { label: 'Completed',        value: complete, icon: CheckCircle2,   cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Discrepancies',    value: flagged,  icon: AlertTriangle,  cls: 'bg-red-50 text-red-600' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30">
        <h1 className="text-lg font-bold text-slate-900">Verification Assignments</h1>
        <p className="text-sm text-slate-500 mt-0.5">Verifiers are auto-assigned when "Send to Verification" is triggered. Monitor status and discrepancies here.</p>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-5 gap-4">
          {stats.map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center gap-2 text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls}`}><Icon className="w-5 h-5" /></div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500 font-medium leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Discrepancy Band */}
        {!loading && (autoRejected.length > 0 || penalised.length > 0) && (
          <div className="space-y-3">
            {autoRejected.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-bold text-red-700">Auto-Rejected — Match &lt; 50% ({autoRejected.length})</span>
                </div>
                <div className="space-y-2">
                  {autoRejected.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-white rounded-xl border border-red-100 px-4 py-3">
                      <span className="font-semibold text-slate-900 text-sm">{a.application.user.full_name}</span>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span className="text-red-600">Match {a.application.verification_match_score != null ? Number(a.application.verification_match_score).toFixed(1) : '—'}%</span>
                        <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-700 border border-red-200">Auto-rejected (I-04)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {penalised.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Discrepancy Band — Match 50–79%, Penalty ×0.85 ({penalised.length})</span>
                </div>
                <div className="space-y-2">
                  {penalised.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-white rounded-xl border border-amber-100 px-4 py-3">
                      <span className="font-semibold text-slate-900 text-sm">{a.application.user.full_name}</span>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span className="text-amber-600">Match {a.application.verification_match_score != null ? Number(a.application.verification_match_score).toFixed(1) : '—'}%</span>
                        <span className="text-slate-500">Score {a.application.post_verify_composite != null ? Number(a.application.post_verify_composite).toFixed(1) : (a.application.composite_score != null ? Number(a.application.composite_score).toFixed(1) : '—')}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-200">Penalised (I-03)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">All Assignments</h2>
            <p className="text-xs text-slate-400 mt-0.5">Click a row to see field report details</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              No assignments yet. Verifiers are auto-assigned when applications are sent to verification.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignments.map(a => {
                const isOpen     = expanded === a.id
                const matchScore = a.application.verification_match_score != null ? Number(a.application.verification_match_score) : null
                const hasMismatch = matchScore != null && matchScore < 80

                return (
                  <div key={a.id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : a.id)}
                      className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        a.status === 'complete' ? 'bg-emerald-500' :
                        a.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-400'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{a.application.user.full_name}</span>
                          {a.application.anomaly_flag && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-orange-50 border border-orange-200 text-orange-700">
                              <AlertTriangle className="w-3 h-3" />Anomaly
                            </span>
                          )}
                          {hasMismatch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-red-50 border border-red-200 text-red-700">
                              <AlertTriangle className="w-3 h-3" />Discrepancy
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold capitalize border ${statusBadge(a.status)}`}>
                            {a.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />{a.verifier.full_name}
                          </span>
                          {a.verification_priority && a.status !== 'complete' && (
                            <span className="text-xs text-slate-400">Priority #{a.verification_priority}</span>
                          )}
                          <span className="text-xs text-slate-400">
                            Assigned {new Date(a.assigned_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 flex-shrink-0">
                        {a.application.composite_score != null && (
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">{Number(a.application.post_verify_composite ?? a.application.composite_score ?? 0).toFixed(1)}</div>
                            <div className="text-[11px] text-slate-400">{a.application.post_verify_composite != null ? 'Final Score' : 'TOPSIS'}</div>
                          </div>
                        )}
                        {matchScore != null && (
                          <div className="text-right">
                            <div className={`text-sm ${matchColor(matchScore)}`}>{matchScore != null ? matchScore.toFixed(1) : '—'}%</div>
                            <div className="text-[11px] text-slate-400">{matchLabel(matchScore)}</div>
                          </div>
                        )}
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-5 bg-slate-50 border-t border-slate-100">
                        <FieldReportDetail assignmentId={a.id} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface FieldReport {
  gps_latitude?: number | null
  gps_longitude?: number | null
  match_score?: number | null
  yes_count?: number
  total_fields?: number
  verifier_notes?: string | null
  submitted_at?: string
  sec_a_identity_match?: boolean | null
  sec_b_housing_type_confirmed?: string | null
  sec_b_ownership_confirmed?: string | null
  sec_c_electricity?: boolean | null
  sec_c_water?: boolean | null
  sec_c_toilet?: boolean | null
  sec_c_lpg?: boolean | null
  sec_d_income_doc_present?: boolean | null
  sec_d_occupation_matches?: boolean | null
  sec_e_car_present?: boolean | null
  sec_e_gold_visible?: boolean | null
  sec_f_electronics_present?: boolean | null
  sec_g_land_present?: boolean | null
  sec_h_fd_docs_visible?: boolean | null
  sec_h_savings_visible?: boolean | null
  sec_i_all_docs_present?: boolean | null
}

interface AssignmentDetail {
  assignment: { status: string; field_reports: FieldReport | FieldReport[] | null }
  declared: {
    housing?: { house_type?: string; ownership_type?: string; has_electricity?: boolean; has_piped_water?: boolean; has_toilet?: boolean; has_lpg?: boolean } | null
    financial?: { gold_value_inr?: number | null; fixed_deposit_amount?: number | null } | null
    assets?: { car_value?: number | null; electronics_value?: number | null; land_area_acres?: number | null } | null
  }
}

function FieldReportDetail({ assignmentId }: { assignmentId: string }) {
  const [data, setData]       = useState<AssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/proxy/verification/assignments/${assignmentId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [assignmentId])

  if (loading) return <div className="py-6 flex justify-center"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!data)   return <div className="py-4 text-xs text-slate-400">Could not load report</div>

  // field_reports is a one-to-one relation in Prisma (returns object or null, not array)
  const rawReports = data.assignment.field_reports
  const report: FieldReport | undefined = Array.isArray(rawReports) ? rawReports[0] : (rawReports ?? undefined)

  if (!report) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400">
        Field visit not yet completed by verifier.
      </div>
    )
  }

  const decl = data.declared
  const boolCell = (val: boolean | null | undefined, declared?: boolean) => {
    const obs = val === true ? 'Yes' : val === false ? 'No' : '—'
    const match = declared == null ? null : (val === declared)
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${match === false ? 'text-red-600' : match === true ? 'text-emerald-600' : 'text-slate-500'}`}>
        {obs}
        {match === false && <AlertTriangle className="w-3 h-3" />}
        {match === true  && <CheckCircle2 className="w-3 h-3" />}
      </span>
    )
  }

  const sections: { title: string; rows: { label: string; observed: React.ReactNode; declared?: string }[] }[] = [
    {
      title: 'A — Identity', rows: [
        { label: 'Identity confirmed', observed: boolCell(report.sec_a_identity_match) },
      ],
    },
    {
      title: 'B — Housing', rows: [
        { label: 'House type observed',   observed: <span className="text-xs">{report.sec_b_housing_type_confirmed ?? '—'}</span>, declared: decl.housing?.house_type ?? '—' },
        { label: 'Ownership observed',    observed: <span className="text-xs">{report.sec_b_ownership_confirmed ?? '—'}</span>,    declared: decl.housing?.ownership_type ?? '—' },
      ],
    },
    {
      title: 'C — Utilities', rows: [
        { label: 'Electricity', observed: boolCell(report.sec_c_electricity, decl.housing?.has_electricity), declared: decl.housing?.has_electricity ? 'Yes' : 'No' },
        { label: 'Piped water', observed: boolCell(report.sec_c_water,       decl.housing?.has_piped_water), declared: decl.housing?.has_piped_water ? 'Yes' : 'No' },
        { label: 'Toilet',      observed: boolCell(report.sec_c_toilet,      decl.housing?.has_toilet),      declared: decl.housing?.has_toilet      ? 'Yes' : 'No' },
        { label: 'LPG',         observed: boolCell(report.sec_c_lpg,         decl.housing?.has_lpg),         declared: decl.housing?.has_lpg         ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'D — Income', rows: [
        { label: 'Income docs present',  observed: boolCell(report.sec_d_income_doc_present) },
        { label: 'Occupation matches',   observed: boolCell(report.sec_d_occupation_matches) },
      ],
    },
    {
      title: 'E — Vehicles & Gold', rows: [
        { label: 'Car present', observed: boolCell(report.sec_e_car_present, Number(decl.assets?.car_value ?? 0) > 0), declared: Number(decl.assets?.car_value ?? 0) > 0 ? 'Yes' : 'No' },
        { label: 'Gold visible', observed: boolCell(report.sec_e_gold_visible, Number(decl.financial?.gold_value_inr ?? 0) > 0), declared: Number(decl.financial?.gold_value_inr ?? 0) > 0 ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'F — Electronics', rows: [
        { label: 'Electronics present', observed: boolCell(report.sec_f_electronics_present, Number(decl.assets?.electronics_value ?? 0) > 0), declared: Number(decl.assets?.electronics_value ?? 0) > 0 ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'G — Land', rows: [
        { label: 'Land present', observed: boolCell(report.sec_g_land_present, Number(decl.assets?.land_area_acres ?? 0) > 0), declared: Number(decl.assets?.land_area_acres ?? 0) > 0 ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'H — Financial Assets', rows: [
        { label: 'FD docs visible',    observed: boolCell(report.sec_h_fd_docs_visible, Number(decl.financial?.fixed_deposit_amount ?? 0) > 0), declared: Number(decl.financial?.fixed_deposit_amount ?? 0) > 0 ? 'Yes' : 'No' },
        { label: 'Savings docs visible', observed: boolCell(report.sec_h_savings_visible) },
      ],
    },
    {
      title: 'I — Documents', rows: [
        { label: 'All docs present', observed: boolCell(report.sec_i_all_docs_present) },
      ],
    },
  ]

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-xs text-slate-500 mb-0.5">Match Score</div>
          <div className={`text-xl font-bold ${matchColor(report.match_score ?? null)}`}>
            {report.match_score != null ? `${Number(report.match_score).toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs text-slate-400">{report.yes_count ?? 0} / {report.total_fields ?? 0} fields</div>
        </div>
        {report.gps_latitude && report.gps_longitude && (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">GPS</div>
              <div className="text-xs font-mono text-slate-700">{Number(report.gps_latitude ?? 0).toFixed(5)}, {Number(report.gps_longitude ?? 0).toFixed(5)}</div>
            </div>
          </div>
        )}
        {report.submitted_at && (
          <div className="text-xs text-slate-400">
            Submitted {new Date(report.submitted_at).toLocaleString('en-IN')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map(sec => (
          <div key={sec.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600">{sec.title}</span>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {sec.rows.map(row => (
                  <tr key={row.label} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-500 w-1/2">{row.label}</td>
                    <td className="px-3 py-2">{row.observed}</td>
                    {row.declared !== undefined && (
                      <td className="px-3 py-2 text-slate-400 italic">{row.declared}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {report.verifier_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-bold text-amber-700 mb-1">Verifier Notes</div>
          <p className="text-xs text-amber-800">{report.verifier_notes}</p>
        </div>
      )}
    </div>
  )
}
