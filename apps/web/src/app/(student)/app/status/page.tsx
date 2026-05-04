'use client'

import { useEffect, useState } from 'react'
import { Award, CheckCircle2, XCircle, Info, ChevronRight, Printer } from 'lucide-react'
import Link from 'next/link'

interface ScoreData {
  merit_score: number | null
  rule_need_score: number | null
  integrity_adj: number | null
  composite_score: number | null
  post_verify_composite: number | null
  final_decision: string | null
  status: string
  rank: number | null
}

export default function StatusPage() {
  const [data,    setData]    = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/proxy/applications/my/score-breakdown', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.composite_score) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Link href="/app/dashboard" className="hover:underline">My Application</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-medium text-gray-700">Score Card</span>
        </div>
        <div className="bg-white border border-gray-300 rounded p-10 text-center">
          <Info className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-800 font-semibold text-base">Score Card Not Yet Available</p>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            Your score card will be available once your application has been evaluated.
            You will be notified when results are declared.
          </p>
          <Link href="/app/dashboard"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors">
            Back to My Application <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  const finalScore   = data.post_verify_composite ?? data.composite_score
  const isApproved   = data.final_decision === 'approved'
  const isRejected   = data.final_decision === 'rejected'
  const isWaitlisted = data.final_decision === 'waitlisted'
  const issueDate    = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <Link href="/app/dashboard" className="hover:underline">My Application</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-medium text-gray-700">Score Card</span>
      </div>

      {/* Decision banner */}
      {data.final_decision && (
        <div className={`flex items-center gap-4 px-5 py-4 rounded border
          ${isApproved   ? 'bg-green-50 border-green-400'
          : isWaitlisted ? 'bg-amber-50 border-amber-400'
                         : 'bg-red-50 border-red-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
            ${isApproved ? 'bg-green-100' : isWaitlisted ? 'bg-amber-100' : 'bg-red-100'}`}>
            {isApproved
              ? <Award        className="w-5 h-5 text-green-700" />
              : isWaitlisted
              ? <CheckCircle2 className="w-5 h-5 text-amber-600" />
              : <XCircle      className="w-5 h-5 text-red-600" />}
          </div>
          <div>
            <div className={`font-bold text-base
              ${isApproved ? 'text-green-900' : isWaitlisted ? 'text-amber-900' : 'text-red-900'}`}>
              {isApproved ? 'Scholarship Awarded' : isWaitlisted ? 'Waitlisted' : 'Not Selected'}
            </div>
            <p className={`text-sm mt-0.5
              ${isApproved ? 'text-green-800' : isWaitlisted ? 'text-amber-800' : 'text-red-800'}`}>
              {isApproved
                ? 'Congratulations! You have been selected for the Merit-cum-Need Scholarship Programme 2025-26.'
                : isWaitlisted
                ? 'You are on the reserve list. You will be notified if a vacancy arises due to any withdrawal by a selected candidate.'
                : 'Your score did not meet the selection threshold for this cycle. You are welcome to apply again when the next academic year programme opens.'}
            </p>
          </div>
        </div>
      )}

      {/* Score card  government certificate style */}
      <div className="bg-white border-2 border-gray-400 rounded overflow-hidden print:border-black">

        {/* Certificate header */}
        <div className="bg-blue-900 text-white px-6 py-4 text-center border-b-4 border-yellow-400">
          <p className="text-xs text-blue-300 tracking-widest uppercase mb-0.5">Merit-cum-Need Scholarship Programme</p>
          <h2 className="text-lg font-bold tracking-wide">EVALUATION SCORE CARD</h2>
          <p className="text-blue-300 text-xs mt-0.5">Academic Year 2025-26</p>
        </div>

        {/* Reference row */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-300 text-xs text-gray-600">
          <div>
            <span className="text-gray-400 uppercase tracking-wide">Date of Issue: </span>
            <strong className="text-gray-800">{issueDate}</strong>
          </div>
          <div className="flex items-center gap-4">
            {data.rank && (
              <div className="text-center">
                <div className="text-gray-400 uppercase tracking-wide text-[10px]">Programme Rank</div>
                <div className="text-xl font-bold text-blue-900">#{data.rank}</div>
              </div>
            )}
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-100 transition-colors print:hidden">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {/* Total score highlight */}
        <div className="px-6 py-4 bg-blue-50 border-b border-gray-300 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Total Score (out of 100)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.post_verify_composite
                ? 'Adjusted score after field verification'
                : 'Composite score  0.35×academic merit + 0.65×financial need + integrity adjustment'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-blue-900 tabular-nums">
              {Number(finalScore).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">/ 100.00</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-gray-200">
          <div className="h-full bg-blue-800 transition-all duration-700"
            style={{ width: `${Math.min(100, Number(finalScore))}%` }} />
        </div>

        {/* Detailed breakdown table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="text-left px-6 py-2.5 font-semibold text-gray-600 uppercase tracking-wide text-xs">Score Component</th>
              <th className="text-left px-6 py-2.5 font-semibold text-gray-600 uppercase tracking-wide text-xs">Basis</th>
              <th className="text-left px-6 py-2.5 font-semibold text-gray-600 uppercase tracking-wide text-xs">Weightage</th>
              <th className="text-right px-6 py-2.5 font-semibold text-gray-600 uppercase tracking-wide text-xs">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 font-semibold text-gray-800">Academic Merit</td>
              <td className="px-6 py-3 text-gray-500 text-xs">12th marks, UG performance, arrears, mode of study, institution recognition</td>
              <td className="px-6 py-3 text-gray-500 text-xs">35%</td>
              <td className="px-6 py-3 text-right font-bold text-gray-900">{Number(data.merit_score ?? 0).toFixed(2)}</td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 font-semibold text-gray-800">Financial Need</td>
              <td className="px-6 py-3 text-gray-500 text-xs">Family income, assets, housing conditions, family composition, social vulnerability</td>
              <td className="px-6 py-3 text-gray-500 text-xs">65%</td>
              <td className="px-6 py-3 text-right font-bold text-gray-900">{Number(data.rule_need_score ?? 0).toFixed(2)}</td>
            </tr>
            {data.integrity_adj != null && Number(data.integrity_adj) < 0 && (
              <tr className="bg-red-50">
                <td className="px-6 py-3 font-semibold text-red-700">Integrity Deduction</td>
                <td className="px-6 py-3 text-red-600 text-xs">Applied when inconsistencies are found between declared information and supporting documents</td>
                <td className="px-6 py-3 text-red-600 text-xs"></td>
                <td className="px-6 py-3 text-right font-bold text-red-700">{Number(data.integrity_adj).toFixed(2)}</td>
              </tr>
            )}
            {data.post_verify_composite && (
              <tr className="bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-700">Verification Adjustment</td>
                <td className="px-6 py-3 text-gray-500 text-xs">Applied based on field verification match score</td>
                <td className="px-6 py-3 text-gray-500 text-xs"></td>
                <td className="px-6 py-3 text-right font-semibold text-gray-700">Applied</td>
              </tr>
            )}
            <tr className="bg-blue-900 text-white">
              <td className="px-6 py-3.5 font-bold text-sm">TOTAL SCORE</td>
              <td className="px-6 py-3.5 text-blue-300 text-xs">0.35×merit + 0.65×need + integrity adjustment</td>
              <td className="px-6 py-3.5 text-blue-300 text-xs">100%</td>
              <td className="px-6 py-3.5 text-right font-bold text-lg tabular-nums">{Number(finalScore).toFixed(2)} / 100</td>
            </tr>
          </tbody>
        </table>

        {/* Status row */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-300 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Application Status: <strong className="text-gray-800 capitalize">{data.status?.replace(/_/g, ' ')}</strong>
          </span>
          <span className="text-xs text-gray-400 italic">This is a system-generated score card</span>
        </div>
      </div>

      {/* Notice */}
      <div className="border border-amber-300 bg-amber-50 rounded px-4 py-3 text-sm text-amber-900 print:hidden">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Note:</strong> Scores are computed by an automated evaluation system based on information declared in the application
            and verified during field inspection. For any queries regarding your score, contact the helpdesk at{' '}
            <strong>1800-123-4567</strong>.
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/app/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors">
          Back to My Application
        </Link>
      </div>
    </div>
  )
}
