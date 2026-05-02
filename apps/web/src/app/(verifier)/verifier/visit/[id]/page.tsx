'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, CheckCircle2, XCircle, ChevronRight, AlertTriangle, Send, FileText, ExternalLink, ArrowLeft, AlertCircle } from 'lucide-react'

type FieldDef =
  | { key: string; label: string; type?: 'boolean' }
  | { key: string; label: string; type: 'housing_type' }
  | { key: string; label: string; type: 'ownership_type' }
  | { key: string; label: string; type: 'number' }

const SECTIONS: { key: string; title: string; fields: FieldDef[] }[] = [
  { key: 'sec_a', title: 'Section A — Identity Verification', fields: [
    { key: 'sec_a_identity_match', label: 'Student photo matches Aadhaar / ID presented?' },
  ]},
  { key: 'sec_b', title: 'Section B — Housing', fields: [
    { key: 'sec_b_housing_type_confirmed', label: 'Observed house type', type: 'housing_type' },
    { key: 'sec_b_ownership_confirmed',   label: 'Observed ownership type', type: 'ownership_type' },
  ]},
  { key: 'sec_c', title: 'Section C — Utilities', fields: [
    { key: 'sec_c_electricity', label: 'Electricity connection present and functional?' },
    { key: 'sec_c_water',       label: 'Piped water supply connection present?' },
    { key: 'sec_c_toilet',      label: 'Toilet / sanitation facility present in premises?' },
    { key: 'sec_c_lpg',         label: 'LPG cylinder or gas connection present?' },
  ]},
  { key: 'sec_d', title: 'Section D — Income Evidence', fields: [
    { key: 'sec_d_income_doc_present',  label: 'Income certificate present and matches declared figure?' },
    { key: 'sec_d_occupation_matches',  label: 'Stated occupation / employer matches observation?' },
  ]},
  { key: 'sec_e', title: 'Section E — Vehicles & Assets', fields: [
    { key: 'sec_e_car_present',              label: 'Four-wheeler / car present in premises or garage?' },
    { key: 'sec_e_vehicle_count_confirmed',  label: 'Actual vehicle count observed', type: 'number' },
    { key: 'sec_e_gold_visible',             label: 'Gold jewellery visibly present (worn / in locker)?' },
  ]},
  { key: 'sec_f', title: 'Section F — Electronics', fields: [
    { key: 'sec_f_electronics_present', label: 'Major electronics present (AC, large TV, etc.)?' },
  ]},
  { key: 'sec_g', title: 'Section G — Land', fields: [
    { key: 'sec_g_land_present', label: 'Land ownership evidence present (patta / documents)?' },
  ]},
  { key: 'sec_h', title: 'Section H — Financial Assets', fields: [
    { key: 'sec_h_fd_docs_visible',   label: 'Fixed deposit receipts or bank passbook present?' },
    { key: 'sec_h_savings_visible',   label: 'Savings account passbook / balance evidence visible?' },
  ]},
  { key: 'sec_i', title: 'Section I — Documents', fields: [] },
]

const HOUSING_OPTIONS = [
  { value: 'kuccha',        label: 'Kuccha (mud / bamboo)' },
  { value: 'semi_pucca',    label: 'Semi-Pucca (mixed)' },
  { value: 'pucca_rented',  label: 'Pucca — Rented' },
  { value: 'pucca_owned',   label: 'Pucca — Self Owned' },
  { value: 'flat_apartment',label: 'Flat / Apartment' },
  { value: 'homeless',      label: 'No permanent shelter' },
]

const OWNERSHIP_OPTIONS = [
  { value: 'owned',        label: 'Self Owned' },
  { value: 'rented',       label: 'Rented' },
  { value: 'govt_allotted',label: 'Government Allotted' },
  { value: 'homeless',     label: 'No permanent shelter' },
]

type DocStatus = 'accurate' | 'inaccurate' | 'not_present'

// Doc types treated as mandatory for Section I scoring
const MANDATORY_DOC_TYPES = new Set([
  'aadhaar', 'aadhaar_card',
  'income_cert', 'income_certificate',
  'marksheet_hsc',
  'admission_proof',
])

export default function VerifierVisitPage() {
  const { id } = useParams()
  const router  = useRouter()

  const [assignment,      setAssignment]      = useState<any>(null)
  const [declared,        setDeclared]        = useState<any>(null)
  const [documents,       setDocuments]       = useState<any[]>([])
  const [docLoading,      setDocLoading]      = useState<string | null>(null)
  const [docVerifications,setDocVerifications]= useState<Record<string, DocStatus>>({})
  const [answers,         setAnswers]         = useState<Record<string, boolean | string | number>>({})
  const [notes,           setNotes]           = useState('')
  const [gps,             setGps]             = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError,        setGpsError]        = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [submitError,     setSubmitError]     = useState('')
  const [loading,         setLoading]         = useState(true)
  const [activeSection,   setActiveSection]   = useState(0)
  const [submittedScore,  setSubmittedScore]  = useState<number | null>(null)

  const allFields       = SECTIONS.flatMap(s => s.fields)
  const mandatoryDocs   = documents.filter(d => MANDATORY_DOC_TYPES.has(d.doc_type))
  const optionalDocs    = documents.filter(d => !MANDATORY_DOC_TYPES.has(d.doc_type))

  // Section I is complete when every mandatory doc has a status set
  const sectionIComplete = mandatoryDocs.length === 0 ||
    mandatoryDocs.every(d => d.id in docVerifications)

  const regularAnswered = allFields.filter(f => f.key in answers && answers[f.key] !== '').length
  const docAnswered     = mandatoryDocs.filter(d => d.id in docVerifications).length
  const answered        = regularAnswered + docAnswered
  const totalFields     = allFields.length + mandatoryDocs.length

  useEffect(() => {
    fetch(`/api/proxy/verification/assignments/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setAssignment(d.assignment)
        setDeclared(d.declared)
        setDocuments(d.documents ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()  => setGpsError(true),
      )
    }
  }, [id])

  async function openDocument(docId: string) {
    setDocLoading(docId)
    try {
      const res = await fetch(`/api/proxy/documents/${docId}/download`, { credentials: 'include' })
      if (res.ok) {
        const { url } = await res.json()
        window.open(url, '_blank', 'noopener')
      } else {
        alert('Could not open document. Please try again.')
      }
    } catch {
      alert('Network error — could not open document.')
    } finally {
      setDocLoading(null)
    }
  }

  async function handleSubmit() {
    const unanswered = allFields.filter(f => !(f.key in answers) || answers[f.key] === '')
    if (unanswered.length > 0) {
      alert(`Please answer all questions before submitting.\n\nMissing:\n${unanswered.map(f => `- ${f.label}`).join('\n')}`)
      return
    }
    if (!sectionIComplete) {
      alert(`Please mark the status for all mandatory documents in Section I before submitting.`)
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/proxy/verification/assignments/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...answers,
          doc_verifications: docVerifications,
          verifier_notes:    notes,
          gps_latitude:      gps?.lat,
          gps_longitude:     gps?.lng,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(data.error || `Submission failed (${res.status}). Please try again.`)
        setSubmitting(false)
        return
      }
      setSubmittedScore(Number(data.match_score))
    } catch {
      setSubmitError('Network error — check your connection and try again.')
      setSubmitting(false)
    }
  }

  // Per-field declared-vs-observed hint label
  function getDeclaredHint(fieldKey: string): string | null {
    if (!declared) return null
    const fmt    = (v: unknown) => v == null ? null : String(v)
    const fmtBool= (v: unknown) => v == null ? null : (v ? 'Yes' : 'No')
    const fmtCur = (v: unknown) => v == null ? null : `Rs ${Number(v).toLocaleString('en-IN')}`
    switch (fieldKey) {
      case 'sec_b_housing_type_confirmed':
        return fmt(declared.housing?.house_type)?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) ?? null
      case 'sec_b_ownership_confirmed':
        return fmt(declared.housing?.ownership_type)?.replace(/_/g, ' ') ?? null
      case 'sec_c_electricity':          return fmtBool(declared.housing?.has_electricity)
      case 'sec_c_water':                return fmtBool(declared.housing?.has_piped_water)
      case 'sec_c_toilet':               return fmtBool(declared.housing?.has_toilet)
      case 'sec_c_lpg':                  return declared.housing?.has_lpg != null ? (declared.housing.has_lpg ? 'Yes (LPG)' : 'No LPG') : null
      case 'sec_d_income_doc_present':   return declared.financial?.total_annual_income != null ? fmtCur(declared.financial.total_annual_income) + '/yr' : null
      case 'sec_d_occupation_matches':   return fmt(declared.financial?.income_source) ?? null
      case 'sec_e_car_present':          return declared.assets?.car_value > 0 ? fmtCur(declared.assets.car_value) : 'None declared'
      case 'sec_e_vehicle_count_confirmed': return declared.assets?.vehicle_count != null ? `${declared.assets.vehicle_count} declared` : null
      case 'sec_e_gold_visible':         return declared.financial?.gold_value_inr > 0 ? fmtCur(declared.financial.gold_value_inr) : 'None declared'
      case 'sec_f_electronics_present':  return declared.assets?.electronics_value > 0 ? fmtCur(declared.assets.electronics_value) : 'None declared'
      case 'sec_g_land_present':         return declared.assets?.land_area_acres > 0 ? `${declared.assets.land_area_acres} acres declared` : 'None declared'
      case 'sec_h_fd_docs_visible':      return declared.financial?.fixed_deposit_amount > 0 ? fmtCur(declared.financial.fixed_deposit_amount) : 'None declared'
      default: return null
    }
  }

  // Per-field match badge — only shown once the field is answered
  function getFieldMatch(fieldKey: string): boolean | null {
    if (!declared || !(fieldKey in answers) || answers[fieldKey] === '') return null
    const h = declared.housing   ?? {}
    const f = declared.financial ?? {}
    const a = declared.assets    ?? {}
    switch (fieldKey) {
      case 'sec_b_housing_type_confirmed': return !answers[fieldKey] || answers[fieldKey] === (h.house_type ?? null)
      case 'sec_b_ownership_confirmed':   return !answers[fieldKey] || answers[fieldKey] === (h.ownership_type ?? null)
      case 'sec_c_electricity':  return (answers[fieldKey] === true) === !!h.has_electricity
      case 'sec_c_water':        return (answers[fieldKey] === true) === !!h.has_piped_water
      case 'sec_c_toilet':       return (answers[fieldKey] === true) === !!h.has_toilet
      case 'sec_c_lpg':          return (answers[fieldKey] === true) === !!h.has_lpg
      case 'sec_e_car_present':  return (answers[fieldKey] === true) === (Number(a.car_value ?? 0) > 0)
      case 'sec_e_vehicle_count_confirmed': return Math.abs(Number(answers[fieldKey] ?? 0) - Number(a.vehicle_count ?? 0)) <= 1
      case 'sec_e_gold_visible': return (answers[fieldKey] === true) === (Number(f.gold_value_inr ?? 0) > 0)
      case 'sec_f_electronics_present': return (answers[fieldKey] === true) === (Number(a.electronics_value ?? 0) > 0)
      case 'sec_g_land_present': return (answers[fieldKey] === true) === (Number(a.land_area_acres ?? 0) > 0)
      case 'sec_h_fd_docs_visible': return (answers[fieldKey] === true) === (Number(f.fixed_deposit_amount ?? 0) > 0)
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Read-only report view for already-completed assignments ──────────────────
  if (assignment?.status === 'complete' && submittedScore === null) {
    const report  = Array.isArray(assignment.field_reports) ? assignment.field_reports[0] ?? null : assignment.field_reports ?? null
    const app     = assignment.application
    const score   = report ? Number(report.match_score) : null
    const isHigh  = score !== null && score >= 80
    const isMid   = score !== null && score >= 50 && score < 80
    const scoreColor = score === null ? 'text-slate-500' : isHigh ? 'text-emerald-700' : isMid ? 'text-amber-700' : 'text-red-700'
    const scoreBg    = score === null ? 'bg-slate-50 border-slate-200' : isHigh ? 'bg-emerald-50 border-emerald-300' : isMid ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'
    const effect     = score === null ? '' : isHigh ? 'Composite score unchanged (×1.0)' : isMid ? 'Composite score reduced by 15% (×0.85)' : 'Composite score reduced by 50% (×0.50)'

    // Map each section field to its observed value from the report
    const reportValue = (key: string): string => {
      if (!report) return '—'
      const v = (report as any)[key]
      if (v === null || v === undefined) return '—'
      if (typeof v === 'boolean') return v ? 'Yes' : 'No'
      if (key === 'sec_b_housing_type_confirmed' || key === 'sec_b_ownership_confirmed')
        return String(v).replace(/_/g, ' ')
      return String(v)
    }

    return (
      <div className="pb-10">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-bold text-slate-900">{app?.user?.full_name}</h1>
              <p className="text-sm text-slate-500">{app?.program?.program_name}</p>
              {app?.user?.phone && <p className="text-xs text-slate-400 mt-0.5">{app.user.phone}</p>}
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-50 border border-green-300 text-green-800 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          </div>
        </div>

        <div className="p-6 max-w-2xl mx-auto space-y-5">

          {/* Match score card */}
          {score !== null && (
            <div className={`rounded-2xl border-2 p-6 text-center ${scoreBg}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Verification Match Score</p>
              <div className={`text-5xl font-black mb-2 ${scoreColor}`}>{score.toFixed(2)}%</div>
              <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full ${isHigh ? 'bg-emerald-500' : isMid ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${score}%` }} />
              </div>
              <p className="text-sm font-medium text-slate-600">{effect}</p>
              {report?.yes_count != null && (
                <p className="text-xs text-slate-400 mt-1">{report.yes_count} matched out of {report.total_fields} fields</p>
              )}
            </div>
          )}

          {/* GPS */}
          {report?.gps_latitude && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3">
              <MapPin className="w-4 h-4 text-blue-500" />
              GPS recorded: {Number(report.gps_latitude).toFixed(5)}, {Number(report.gps_longitude).toFixed(5)}
            </div>
          )}

          {/* Uploaded documents */}
          {documents.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Student Documents ({documents.length})
              </p>
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {String(doc.doc_type).replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{doc.original_name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openDocument(doc.id)}
                      disabled={docLoading === doc.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg flex-shrink-0 transition-colors"
                    >
                      {docLoading === doc.id
                        ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        : <ExternalLink className="w-3 h-3" />}
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applicant declared context */}
          {declared && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Declared by Applicant</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Income',       declared.financial?.total_annual_income != null ? `Rs ${Number(declared.financial.total_annual_income).toLocaleString('en-IN')}/yr` : null],
                  ['Family size',  declared.family?.family_size],
                  ['House type',   declared.housing?.house_type?.replace(/_/g, ' ')],
                  ['Ownership',    declared.housing?.ownership_type?.replace(/_/g, ' ')],
                  ['Electricity',  declared.housing?.has_electricity != null ? (declared.housing.has_electricity ? 'Yes' : 'No') : null],
                  ['Piped water',  declared.housing?.has_piped_water != null ? (declared.housing.has_piped_water ? 'Yes' : 'No') : null],
                  ['Toilet',       declared.housing?.has_toilet != null ? (declared.housing.has_toilet ? 'Yes' : 'No') : null],
                  ['LPG',          declared.housing?.has_lpg != null ? (declared.housing.has_lpg ? 'Yes' : 'No') : null],
                  ['Car value',    declared.assets?.car_value > 0 ? `Rs ${Number(declared.assets.car_value).toLocaleString('en-IN')}` : 'None'],
                  ['Vehicles',     declared.assets?.vehicle_count],
                  ['Gold value',   declared.financial?.gold_value_inr > 0 ? `Rs ${Number(declared.financial.gold_value_inr).toLocaleString('en-IN')}` : 'None'],
                  ['Electronics',  declared.assets?.electronics_value > 0 ? `Rs ${Number(declared.assets.electronics_value).toLocaleString('en-IN')}` : 'None'],
                  ['Land',         declared.assets?.land_area_acres > 0 ? `${declared.assets.land_area_acres} acres` : 'None'],
                  ['Fixed deposit',declared.financial?.fixed_deposit_amount > 0 ? `Rs ${Number(declared.financial.fixed_deposit_amount).toLocaleString('en-IN')}` : 'None'],
                ].filter(([, v]) => v != null).map(([label, value]) => (
                  <div key={label as string} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-slate-400 font-medium">{label}</p>
                    <p className="text-slate-700 font-semibold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filled form values per section */}
          {report && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Observed Values (Field Report)</p>
              </div>
              <div className="divide-y divide-slate-50">
                {SECTIONS.flatMap(s => s.fields).map(field => {
                  const observed = reportValue(field.key)
                  const hint     = getDeclaredHint(field.key)
                  return (
                    <div key={field.key} className="px-5 py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{field.label}</p>
                        {hint && <p className="text-xs text-blue-600 mt-0.5">Declared: {hint}</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded flex-shrink-0
                        ${observed === 'Yes' ? 'bg-emerald-50 text-emerald-700'
                          : observed === 'No' ? 'bg-red-50 text-red-700'
                          : observed === '—' ? 'text-slate-400'
                          : 'bg-slate-100 text-slate-700'}`}>
                        {observed}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Verifier notes */}
          {report?.verifier_notes && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-700 mb-1">Verifier Notes</p>
              <p className="text-sm text-slate-600">{report.verifier_notes}</p>
            </div>
          )}

        </div>
      </div>
    )
  }

  // ── Result screen shown after successful submission ──────────────────────────
  if (submittedScore !== null) {
    const score = submittedScore
    const isHigh = score >= 80
    const isMid  = score >= 50 && score < 80
    const color  = isHigh ? 'text-emerald-700' : isMid ? 'text-amber-700' : 'text-red-700'
    const bg     = isHigh ? 'bg-emerald-50 border-emerald-300' : isMid ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'
    const effect = isHigh
      ? 'Declarations verified — composite score unchanged.'
      : isMid
      ? 'Partial mismatch — composite score reduced by 15%.'
      : 'Significant mismatch — composite score reduced by 50%.'

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <div className={`w-full max-w-sm rounded-2xl border-2 p-8 text-center ${bg}`}>
          <CheckCircle2 className={`w-12 h-12 mx-auto mb-4 ${color}`} />
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Field Report Submitted</p>
          <p className="text-slate-700 font-medium mb-6">{assignment?.application?.user?.full_name}</p>

          <div className={`text-6xl font-black mb-2 ${color}`}>{score.toFixed(2)}%</div>
          <p className="text-sm font-semibold text-slate-600 mb-1">Verification Match Score</p>
          <p className="text-xs text-slate-500 mb-6">{effect}</p>

          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-6">
            <div
              className={`h-full rounded-full transition-all ${isHigh ? 'bg-emerald-500' : isMid ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>

          <button
            onClick={() => router.push('/verifier/dashboard')}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const app = assignment?.application

  return (
    <div className="pb-32">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-bold text-slate-900">{app?.user?.full_name}</h1>
              <p className="text-sm text-slate-500">{app?.program?.program_name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-semibold text-slate-500">{answered}/{totalFields}</div>
              <div className="text-xs text-slate-400">answered</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${totalFields > 0 ? (answered / totalFields) * 100 : 0}%` }}
            />
          </div>

          {/* GPS status */}
          <div className={`flex items-center gap-1.5 mt-2 text-xs ${gps ? 'text-emerald-600' : gpsError ? 'text-amber-600' : 'text-slate-400'}`}>
            <MapPin className="w-3.5 h-3.5" />
            {gps
              ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
              : gpsError
              ? 'GPS unavailable — location not recorded'
              : 'Acquiring GPS location…'}
          </div>

          {/* Applicant context strip */}
          {declared && (
            <div className="mt-2 flex flex-wrap gap-2">
              {declared.financial?.total_annual_income != null && (
                <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-1">
                  Income: Rs {Number(declared.financial.total_annual_income).toLocaleString('en-IN')}/yr
                </span>
              )}
              {declared.family?.family_size != null && (
                <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-1">
                  Family: {declared.family.family_size} members
                </span>
              )}
              {declared.housing?.house_type && (
                <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-1">
                  House: {String(declared.housing.house_type).replace(/_/g, ' ')}
                </span>
              )}
              {declared.financial?.income_source && (
                <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-1">
                  {declared.financial.income_source}
                </span>
              )}
            </div>
          )}

          {/* Priority review warning */}
          {app?.anomaly_flag && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Priority review — check all documents and declarations carefully
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div className="px-6 flex gap-2 overflow-x-auto pb-3 border-t border-slate-100">
          {SECTIONS.map((s, i) => {
            const sAnswered = i === 8
              ? sectionIComplete
              : s.fields.every(f => f.key in answers && answers[f.key] !== '')
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors
                  ${activeSection === i
                    ? 'bg-blue-700 text-white'
                    : sAnswered
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {sAnswered && <CheckCircle2 className="w-3 h-3" />}
                Sec {String.fromCharCode(65 + i)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section forms */}
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {SECTIONS.map((section, si) => (
          <div
            key={section.key}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
              ${activeSection === si ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}
          >
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              onClick={() => setActiveSection(activeSection === si ? -1 : si)}
            >
              <div>
                <div className="font-semibold text-slate-900 text-sm">{section.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {section.fields.length} question{section.fields.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(si === 8 ? sectionIComplete : section.fields.every(f => f.key in answers && answers[f.key] !== '')) && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                )}
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${activeSection === si ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {activeSection === si && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">

                {/* Section I — per-document verification */}
                {si === 8 && (
                  <div className="px-5 py-4 space-y-5">
                    {documents.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        No documents uploaded for this application.
                      </div>
                    ) : (
                      <>
                        {/* Mandatory documents */}
                        {mandatoryDocs.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                              Mandatory Documents ({mandatoryDocs.length}) — mark each as Accurate, Inaccurate, or Not Present
                            </p>
                            <div className="space-y-3">
                              {mandatoryDocs.map((doc: any) => {
                                const status = docVerifications[doc.id]
                                return (
                                  <div key={doc.id} className={`rounded-xl border p-3 transition-colors
                                    ${status === 'accurate'    ? 'border-emerald-300 bg-emerald-50'
                                    : status === 'inaccurate'  ? 'border-amber-300 bg-amber-50'
                                    : status === 'not_present' ? 'border-red-300 bg-red-50'
                                    : 'border-slate-200 bg-white'}`}>
                                    <div className="flex items-start justify-between gap-3 mb-2.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-slate-700 capitalize">
                                            {String(doc.doc_type).replace(/_/g, ' ')}
                                          </p>
                                          <p className="text-xs text-slate-400 truncate">{doc.original_name}</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => openDocument(doc.id)}
                                        disabled={docLoading === doc.id}
                                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg flex-shrink-0 transition-colors"
                                      >
                                        {docLoading === doc.id
                                          ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                          : <ExternalLink className="w-3 h-3" />}
                                        View
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      {([
                                        { value: 'accurate',    label: 'Accurate',     icon: '✓', active: 'bg-emerald-600 border-emerald-600 text-white', inactive: 'border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50' },
                                        { value: 'inaccurate',  label: 'Inaccurate',   icon: '⚠', active: 'bg-amber-500 border-amber-500 text-white',   inactive: 'border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50' },
                                        { value: 'not_present', label: 'Not Present',  icon: '✗', active: 'bg-red-600 border-red-600 text-white',       inactive: 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50' },
                                      ] as const).map(opt => (
                                        <button
                                          key={opt.value}
                                          onClick={() => setDocVerifications(v => ({ ...v, [doc.id]: opt.value }))}
                                          className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all
                                            ${status === opt.value ? opt.active : opt.inactive}`}
                                        >
                                          <span>{opt.icon}</span> {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                    {status === 'inaccurate' && (
                                      <p className="mt-2 text-xs text-amber-700 font-medium">
                                        Document present but has discrepancies — will reduce match score
                                      </p>
                                    )}
                                    {status === 'not_present' && (
                                      <p className="mt-2 text-xs text-red-700 font-medium">
                                        Document not found at location — will reduce match score
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Optional documents */}
                        {optionalDocs.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                              Supporting Documents ({optionalDocs.length}) — optional, view only
                            </p>
                            <div className="space-y-2">
                              {optionalDocs.map((doc: any) => (
                                <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-slate-700 capitalize truncate">
                                        {String(doc.doc_type).replace(/_/g, ' ')}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate">{doc.original_name}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => openDocument(doc.id)}
                                    disabled={docLoading === doc.id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg flex-shrink-0 transition-colors"
                                  >
                                    {docLoading === doc.id
                                      ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                      : <ExternalLink className="w-3 h-3" />}
                                    View
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {section.fields.map(field => {
                  const hint = getDeclaredHint(field.key)
                  const fm   = getFieldMatch(field.key)
                  return (
                    <div key={field.key} className="px-5 py-4">
                      <p className="text-sm text-slate-700 font-medium mb-2">{field.label}</p>

                      {hint && (
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                            Declared: {hint}
                          </span>
                          {fm === true  && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">Match</span>}
                          {fm === false && <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">Mismatch</span>}
                        </div>
                      )}

                      {'type' in field && field.type === 'housing_type' ? (
                        <select
                          value={(answers[field.key] as string) || ''}
                          onChange={e => setAnswers(a => ({ ...a, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                        >
                          <option value="">Select observed house type</option>
                          {HOUSING_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : 'type' in field && field.type === 'ownership_type' ? (
                        <select
                          value={(answers[field.key] as string) || ''}
                          onChange={e => setAnswers(a => ({ ...a, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                        >
                          <option value="">Select observed ownership type</option>
                          {OWNERSHIP_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : 'type' in field && field.type === 'number' ? (
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={(answers[field.key] as number) ?? ''}
                          onChange={e => setAnswers(a => ({ ...a, [field.key]: parseInt(e.target.value) || 0 }))}
                          placeholder="Count observed (0 if none)"
                          className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                        />
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setAnswers(a => ({ ...a, [field.key]: true }))}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all
                              ${answers[field.key] === true
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'}`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> Yes
                          </button>
                          <button
                            onClick={() => setAnswers(a => ({ ...a, [field.key]: false }))}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all
                              ${answers[field.key] === false
                                ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                : 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50'}`}
                          >
                            <XCircle className="w-4 h-4" /> No
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {/* Verifier notes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Verifier Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Discrepancies, observations, or additional context"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
      </div>

      {/* Fixed submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4 md:pl-64">
        <div className="max-w-2xl mx-auto">
          {submitError && (
            <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {submitError}
            </div>
          )}
          <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
            <span>{answered} of {totalFields} fields completed</span>
            {answered === totalFields && (
              <span className="text-emerald-600 font-semibold">All sections complete</span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || answered < totalFields}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            {submitting
              ? 'Submitting report…'
              : answered < totalFields
              ? `Complete ${totalFields - answered} more field${totalFields - answered !== 1 ? 's' : ''}`
              : 'Submit Field Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
