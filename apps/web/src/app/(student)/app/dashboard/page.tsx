'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, FileText, Award, ChevronRight, CheckCircle, Clock, AlertCircle, XCircle, Info } from 'lucide-react'

interface Application {
  id: string
  status: string
  composite_score: number | null
  post_verify_composite: number | null
  merit_score: number | null
  rule_need_score: number | null
  composite_rank: number | null
  anomaly_flag: boolean
  rejection_reason: string | null
  final_decision: string | null
  submitted_at: string | null
  program: { program_name: string; academic_year: string }
}

const STATUS_CONFIG: Record<string, { label: string; desc: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  draft:                 { label: 'Draft — Not Submitted',              desc: 'Your application has not been submitted. Please complete all sections and submit.',                                                                                                                    color: 'text-gray-600',   bg: 'bg-gray-50',    border: 'border-gray-300',   icon: <FileText className="w-4 h-4" /> },
  submitted:             { label: 'Submitted — Queued for Processing',  desc: 'Your application has been received and is queued for automated processing. This usually takes a few minutes.',                                                                                               color: 'text-blue-800',   bg: 'bg-blue-50',    border: 'border-blue-300',   icon: <Clock className="w-4 h-4" /> },
  evaluating:            { label: 'Under Evaluation',                   desc: 'Our system is currently running automated checks on your application — anomaly detection, eligibility review, and scoring. No action is required from you.',                                                 color: 'text-amber-800',  bg: 'bg-amber-50',   border: 'border-amber-300',  icon: <Clock className="w-4 h-4" /> },
  anomaly_flagged:       { label: 'Not Processed — Inconsistency Found',desc: 'Our automated review found inconsistencies between the details provided in your application. Your application could not be processed further. Please see the reason below or contact the helpdesk.',         color: 'text-red-800',    bg: 'bg-red-50',     border: 'border-red-300',    icon: <XCircle className="w-4 h-4" /> },
  not_shortlisted:       { label: 'Not Eligible for This Programme',    desc: 'Your application did not satisfy one or more eligibility conditions for this programme. The specific reason is shown below. You may be eligible to apply in a future cycle.',                                color: 'text-red-800',    bg: 'bg-red-50',     border: 'border-red-300',    icon: <XCircle className="w-4 h-4" /> },
  evaluated:             { label: 'Evaluated — Awaiting Final Ranking', desc: 'Your application has been scored successfully. The final composite ranking will be computed once the application window closes. You will be notified when rankings are published.',                           color: 'text-teal-800',   bg: 'bg-teal-50',    border: 'border-teal-300',   icon: <CheckCircle className="w-4 h-4" /> },
  scored:                { label: 'Ranked — Awaiting Verification',     desc: 'Composite scoring and ranking are complete. If you are among the top-ranked candidates, you will be contacted for field verification shortly.',                                                               color: 'text-purple-800', bg: 'bg-purple-50',  border: 'border-purple-300', icon: <CheckCircle className="w-4 h-4" /> },
  verification_pending:  { label: 'Selected for Field Verification',    desc: 'You have been shortlisted for a field verification visit. An authorised verifier will contact you on your registered phone number to schedule the visit. Please keep your documents ready.',                 color: 'text-indigo-800', bg: 'bg-indigo-50',  border: 'border-indigo-300', icon: <Clock className="w-4 h-4" /> },
  verification_complete: { label: 'Verification Complete',              desc: 'Field verification has been completed for your application. Final results will be declared shortly. You will be notified via this portal.',                                                                   color: 'text-teal-800',   bg: 'bg-teal-50',    border: 'border-teal-300',   icon: <CheckCircle className="w-4 h-4" /> },
  approved:              { label: 'Selected — Scholarship Awarded',     desc: 'Congratulations! You have been selected for the Merit-cum-Need Scholarship 2025–26. The award letter and disbursement details will be sent to your registered address.',                                     color: 'text-green-800',  bg: 'bg-green-50',   border: 'border-green-400',  icon: <Award className="w-4 h-4" /> },
  waitlisted:            { label: 'Waitlisted (Reserve List)',          desc: 'You are on the reserve list. If any selected candidate declines or is found ineligible, the next candidate on the waitlist will be offered the scholarship. You will be notified if a seat becomes available.',color: 'text-amber-800',  bg: 'bg-amber-50',   border: 'border-amber-300',  icon: <Clock className="w-4 h-4" /> },
  rejected:              { label: 'Not Selected — Apply Next Year',      desc: 'Your application was reviewed but could not be selected in this cycle. You are welcome to apply again when the next academic year programme opens.',                                              color: 'text-red-800',    bg: 'bg-red-50',     border: 'border-red-300',    icon: <XCircle className="w-4 h-4" /> },
}

const PIPELINE_STEPS = [
  { key: 'submitted',             label: 'Submitted' },
  { key: 'evaluated',             label: 'Evaluated' },
  { key: 'scored',                label: 'Ranked' },
  { key: 'verification_pending',  label: 'Verification' },
  { key: 'approved',              label: 'Result' },
]

const STEP_ORDER = ['submitted','evaluating','evaluated','scored','verification_pending','verification_complete','approved','waitlisted','rejected']

function pipelineIndex(status: string) {
  const pos = STEP_ORDER.indexOf(status)
  if (pos <= 1) return 0   // submitted, evaluating
  if (pos === 2) return 1  // evaluated
  if (pos === 3) return 2  // scored
  if (pos <= 5) return 3   // verification_pending, verification_complete
  return 4                 // approved, waitlisted, rejected
}

export default function StudentDashboard() {
  const [apps,    setApps]    = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/proxy/applications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setApps(d.applications || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <span className="text-gray-400">Home</span>
        <ChevronRight className="w-3 h-3" />
        <span className="font-medium text-gray-700">My Application</span>
      </div>

      {/* Page header */}
      <div className="bg-white border border-gray-300 rounded px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">My Application Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Merit-cum-Need Scholarship Programme 202526</p>
        </div>
        {apps.length === 0 && (
          <Link href="/app/apply"
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded text-sm transition-colors">
            Apply Now <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {apps.length === 0 ? (
        /* No application yet */
        <div className="bg-white border border-gray-300 rounded p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-blue-700" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">No Application Found</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            You have not yet applied for the current scholarship cycle.<br />
            Start your application now.
          </p>
          <Link href="/app/apply"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded text-sm transition-colors">
            Start Application <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {apps.map(app => {
            const cfg      = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.draft
            const pStep    = pipelineIndex(app.status)
            const terminal = ['approved','rejected','not_shortlisted','waitlisted','anomaly_flagged'].includes(app.status)
            const refNo    = `SCH-2025-${app.id.slice(0, 8).toUpperCase()}`

            return (
              <div key={app.id} className="bg-white border border-gray-300 rounded overflow-hidden">

                {/* Status colour header */}
                <div className={`px-5 py-3 border-b ${cfg.bg} ${cfg.border} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
                  <div className="flex items-center gap-2">
                    <span className={`${cfg.color}`}>{cfg.icon}</span>
                    <span className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Ref No: <strong className="text-gray-800 font-mono">{refNo}</strong></span>
                    {app.submitted_at && (
                      <span>Submitted: <strong className="text-gray-700">{new Date(app.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4">

                  {/* Programme info */}
                  <table className="w-full text-sm mb-4 border border-gray-200 rounded overflow-hidden">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50">
                        <td className="px-4 py-2 w-40 font-medium text-gray-600 text-xs uppercase tracking-wide">Programme</td>
                        <td className="px-4 py-2 font-semibold text-gray-900">{app.program?.program_name}</td>
                        <td className="px-4 py-2 w-32 font-medium text-gray-600 text-xs uppercase tracking-wide">Academic Year</td>
                        <td className="px-4 py-2 font-semibold text-gray-900">{app.program?.academic_year}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Status message */}
                  <div className={`flex items-start gap-2.5 px-4 py-3 rounded border text-sm mb-4 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    <span className="flex-shrink-0 mt-0.5">{cfg.icon}</span>
                    <span>{cfg.desc}</span>
                  </div>

                  {/* Pipeline tracker */}
                  {!terminal && app.status !== 'draft' && (
                    <div className="mb-4 overflow-x-auto">
                      <div className="flex items-center min-w-max">
                        {PIPELINE_STEPS.map((s, i) => {
                          const done   = pStep > i
                          const active = pStep === i
                          return (
                            <div key={s.key} className="flex items-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                  ${done   ? 'bg-blue-800 border-blue-800 text-white'
                                  : active ? 'bg-white border-blue-800 text-blue-800'
                                           : 'bg-white border-gray-300 text-gray-400'}`}>
                                  {done ? '' : i + 1}
                                </div>
                                <span className={`text-[10px] font-semibold whitespace-nowrap
                                  ${done || active ? 'text-gray-800' : 'text-gray-400'}`}>
                                  {s.label}
                                </span>
                              </div>
                              {i < PIPELINE_STEPS.length - 1 && (
                                <div className={`w-16 h-0.5 mx-1 mb-4 ${done ? 'bg-blue-800' : 'bg-gray-200'}`} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Score summary */}
                  {app.composite_score != null && (
                    <table className="w-full text-sm border border-gray-200 rounded overflow-hidden mb-4">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Score Component</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Score</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="px-4 py-2.5 text-gray-700">Academic Merit</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{Number(app.merit_score ?? 0).toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">100</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 text-gray-700">Financial Need</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{Number(app.rule_need_score ?? 0).toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">100</td>
                        </tr>
                        <tr className="bg-blue-50 font-semibold">
                          <td className="px-4 py-2.5 text-blue-900 font-bold">Total Score</td>
                          <td className="px-4 py-2.5 text-right text-blue-900 font-bold">{Number(app.post_verify_composite ?? app.composite_score).toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right text-blue-700">100</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* Rank */}
                  {app.composite_rank && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 rounded text-sm mb-4">
                      <span className="text-gray-500">Programme Rank:</span>
                      <span className="font-bold text-gray-900 text-base">#{app.composite_rank}</span>
                    </div>
                  )}

                  {/* Rejection reason */}
                  {app.rejection_reason && (
                    <div className="px-4 py-3 bg-red-50 border border-red-300 rounded text-sm text-red-800 mb-4 whitespace-pre-line leading-relaxed">
                      {app.rejection_reason}
                    </div>
                  )}

                  {/* Approved banner */}
                  {app.status === 'approved' && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-400 rounded mb-4">
                      <Award className="w-5 h-5 text-green-700 flex-shrink-0" />
                      <span className="text-sm font-semibold text-green-900">
                        Congratulations! Your scholarship has been awarded. The disbursement letter will be sent to your registered address.
                      </span>
                    </div>
                  )}

                  {/* Action links */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 mt-2">
                    {app.status === 'draft' ? (
                      <Link href="/app/apply"
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-blue-800 hover:bg-blue-900 text-white rounded transition-colors">
                        Continue Application <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <Link href="/app/apply"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 rounded transition-colors">
                        View Application Form <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                    {app.composite_score != null && (
                      <Link href={`/app/status?id=${app.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-blue-300 text-blue-800 hover:bg-blue-50 rounded transition-colors">
                        View Score Card <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                    <Link href="/app/documents"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 rounded transition-colors">
                      Manage Documents <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Help box */}
      <div className="bg-blue-50 border border-blue-200 rounded px-5 py-4 text-sm">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-blue-800">
            <strong>Need assistance?</strong> Contact our scholarship helpdesk:{' '}
            <a href="tel:18001234567" className="text-blue-900 font-bold hover:underline">1800-123-4567</a>{' '}
            (MonSat, 9 AM  6 PM) or email{' '}
            <a href="mailto:scholarship@trust.org" className="text-blue-900 font-bold hover:underline">scholarship@trust.org</a>
          </div>
        </div>
      </div>
    </div>
  )
}
