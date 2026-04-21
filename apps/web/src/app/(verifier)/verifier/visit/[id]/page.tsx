'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, CheckCircle2, XCircle, ChevronRight, AlertTriangle, Send } from 'lucide-react'

type FieldDef =
  | { key: string; label: string; type?: 'boolean' }
  | { key: string; label: string; type: 'housing_type' }
  | { key: string; label: string; type: 'ownership_type' }
  | { key: string; label: string; type: 'number' }

const SECTIONS: { key: string; title: string; icon: string; fields: FieldDef[] }[] = [
  { key: 'sec_a', title: 'Section A  Identity Verification', icon: '', fields: [
    { key: 'sec_a_identity_match', label: 'Student photo matches Aadhaar / ID presented?' },
  ]},
  { key: 'sec_b', title: 'Section B  Housing', icon: '', fields: [
    { key: 'sec_b_housing_type_confirmed', label: 'Observed house type', type: 'housing_type' },
    { key: 'sec_b_ownership_confirmed', label: 'Observed ownership type', type: 'ownership_type' },
  ]},
  { key: 'sec_c', title: 'Section C  Utilities', icon: '', fields: [
    { key: 'sec_c_electricity', label: 'Electricity connection present and functional?' },
    { key: 'sec_c_water', label: 'Piped water supply connection present?' },
    { key: 'sec_c_toilet', label: 'Toilet / sanitation facility present in premises?' },
    { key: 'sec_c_lpg', label: 'LPG cylinder or gas connection present?' },
  ]},
  { key: 'sec_d', title: 'Section D  Income Evidence', icon: '', fields: [
    { key: 'sec_d_income_doc_present', label: 'Income certificate present and matches declared figure?' },
    { key: 'sec_d_occupation_matches', label: 'Stated occupation / employer matches observation?' },
  ]},
  { key: 'sec_e', title: 'Section E  Vehicles & Assets', icon: '', fields: [
    { key: 'sec_e_car_present', label: 'Four-wheeler / car present in premises or garage?' },
    { key: 'sec_e_vehicle_count_confirmed', label: 'Actual vehicle count observed', type: 'number' },
    { key: 'sec_e_gold_visible', label: 'Gold jewellery visibly present (worn / in locker)?' },
  ]},
  { key: 'sec_f', title: 'Section F  Electronics', icon: '', fields: [
    { key: 'sec_f_electronics_present', label: 'Major electronics present (AC, large TV, etc.)?' },
  ]},
  { key: 'sec_g', title: 'Section G  Land', icon: '', fields: [
    { key: 'sec_g_land_present', label: 'Land ownership evidence present (patta / documents)?' },
  ]},
  { key: 'sec_h', title: 'Section H  Financial Assets', icon: '', fields: [
    { key: 'sec_h_fd_docs_visible', label: 'Fixed deposit receipts or bank passbook present?' },
    { key: 'sec_h_savings_visible', label: 'Savings account passbook / balance evidence visible?' },
  ]},
  { key: 'sec_i', title: 'Section I  Documents', icon: '', fields: [
    { key: 'sec_i_all_docs_present', label: 'All uploaded documents physically present at location?' },
  ]},
]

const HOUSING_OPTIONS = [
  { value: 'kuccha', label: 'Kuccha (mud / bamboo)' },
  { value: 'semi_pucca', label: 'Semi-Pucca (mixed)' },
  { value: 'pucca_rented', label: 'Pucca - Rented' },
  { value: 'pucca_owned', label: 'Pucca - Self Owned' },
  { value: 'flat_apartment', label: 'Flat / Apartment' },
  { value: 'homeless', label: 'No permanent shelter' },
]

const OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Self Owned' },
  { value: 'rented', label: 'Rented' },
  { value: 'govt_allotted', label: 'Government Allotted' },
  { value: 'homeless', label: 'No permanent shelter' },
]

export default function VerifierVisitPage() {
  const { id } = useParams()
  const router = useRouter()
  const [assignment, setAssignment] = useState<any>(null)
  const [declared,   setDeclared]   = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, boolean | string | number>>({
    sec_e_vehicle_count_confirmed: 0,
  })
  const [notes, setNotes] = useState('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(0)

  const allFields = SECTIONS.flatMap(s => s.fields)
  const answered = allFields.filter(f => f.key in answers && answers[f.key] !== '').length

  // Comparison-based match preview — mirrors backend logic
  function computeMatchPreview(): number {
    if (!declared) return 0
    const h = declared.housing   ?? {}
    const f = declared.financial ?? {}
    const a = declared.assets    ?? {}
    const decl = {
      hasElectricity: !!h.has_electricity,
      hasPipedWater:  !!h.has_piped_water,
      hasToilet:      !!h.has_toilet,
      hasLpg:         !!h.has_lpg,
      houseType:      h.house_type   ?? null,
      ownershipType:  h.ownership_type ?? null,
      hasCar:         Number(a.car_value    ?? 0) > 0,
      vehicleCount:   Number(a.vehicle_count ?? 0),
      hasGold:        Number(f.gold_value_inr        ?? 0) > 0,
      hasElectronics: Number(a.electronics_value     ?? 0) > 0,
      hasLand:        Number(a.land_area_acres        ?? 0) > 0,
      hasFD:          Number(f.fixed_deposit_amount   ?? 0) > 0,
    }
    const checks = [
      answers.sec_a_identity_match === true,
      !answers.sec_b_housing_type_confirmed || answers.sec_b_housing_type_confirmed === decl.houseType,
      !answers.sec_b_ownership_confirmed    || answers.sec_b_ownership_confirmed    === decl.ownershipType,
      (answers.sec_c_electricity === true) === decl.hasElectricity,
      (answers.sec_c_water       === true) === decl.hasPipedWater,
      (answers.sec_c_toilet      === true) === decl.hasToilet,
      (answers.sec_c_lpg         === true) === decl.hasLpg,
      answers.sec_d_income_doc_present === true,
      answers.sec_d_occupation_matches === true,
      (answers.sec_e_car_present  === true) === decl.hasCar,
      Math.abs(Number(answers.sec_e_vehicle_count_confirmed ?? 0) - decl.vehicleCount) <= 1,
      (answers.sec_e_gold_visible === true) === decl.hasGold,
      (answers.sec_f_electronics_present === true) === decl.hasElectronics,
      (answers.sec_g_land_present === true) === decl.hasLand,
      (answers.sec_h_fd_docs_visible === true) === decl.hasFD,
      answers.sec_h_savings_visible === true,
      answers.sec_i_all_docs_present === true,
    ]
    const matched = checks.filter(Boolean).length
    return Math.round((matched / checks.length) * 100)
  }
  const matchPreview = computeMatchPreview()

  useEffect(() => {
    fetch(`/api/proxy/verification/assignments/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setAssignment(d.assignment); setDeclared(d.declared); setLoading(false) })
      .catch(() => setLoading(false))

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGpsError(true)
      )
    }
  }, [id])

  async function handleSubmit() {
    if (answered < allFields.length) {
      const unanswered = allFields
        .filter(f => !(f.key in answers) || answers[f.key] === '')
        .map(f => f.label)
      alert(`Please answer all questions before submitting.\n\nMissing:\n${unanswered.map(l => `- ${l}`).join('\n')}`)
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/proxy/verification/assignments/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...answers, verifier_notes: notes, gps_latitude: gps?.lat, gps_longitude: gps?.lng }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSubmitError(err.error || `Submission failed (${res.status}). Please try again.`)
        setSubmitting(false)
        return
      }
      router.push('/verifier/dashboard')
    } catch {
      setSubmitError('Network error — check your connection and try again.')
      setSubmitting(false)
    }
  }

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

  function getDeclaredHint(fieldKey: string): string | null {
    if (!declared) return null
    const fmt = (v: unknown) => v == null ? null : String(v)
    const fmtBool = (v: unknown) => v == null ? null : (v ? 'Yes' : 'No')
    const fmtCur = (v: unknown) => v == null ? null : `Rs ${Number(v).toLocaleString('en-IN')}`
    switch (fieldKey) {
      case 'sec_a_identity_match':       return null
      case 'sec_b_housing_type_confirmed': return fmt(declared.housing?.house_type)?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) ?? null
      case 'sec_b_ownership_confirmed':  return fmt(declared.housing?.ownership_type)?.replace(/_/g, ' ') ?? null
      case 'sec_c_electricity':          return fmtBool(declared.housing?.has_electricity)
      case 'sec_c_water':                return fmtBool(declared.housing?.has_piped_water)
      case 'sec_c_toilet':               return fmtBool(declared.housing?.has_toilet)
      case 'sec_c_lpg':                  return declared.housing?.has_lpg != null ? (declared.housing.has_lpg ? 'Yes (LPG)' : 'No LPG') : null
      case 'sec_d_income_doc_present':   return declared.financial?.total_annual_income != null ? `Declared: ${fmtCur(declared.financial.total_annual_income)}/yr` : null
      case 'sec_d_occupation_matches':   return fmt(declared.personal?.occupation) ?? null
      case 'sec_e_car_present':          return declared.assets?.car_value > 0 ? `Declared: ${fmtCur(declared.assets.car_value)}` : 'Declared: None'
      case 'sec_e_vehicle_count_confirmed': return declared.assets?.vehicle_count != null ? `Declared: ${declared.assets.vehicle_count}` : null
      case 'sec_e_gold_visible':         return declared.financial?.gold_value_inr > 0 ? `Declared: ${fmtCur(declared.financial.gold_value_inr)}` : 'Declared: None'
      case 'sec_f_electronics_present':  return declared.assets?.electronics_value > 0 ? `Declared: ${fmtCur(declared.assets.electronics_value)}` : 'Declared: None'
      case 'sec_g_land_present':         return declared.assets?.land_area_acres > 0 ? `Declared: ${declared.assets.land_area_acres} acres` : 'Declared: None'
      case 'sec_h_fd_docs_visible':      return declared.financial?.fixed_deposit_amount > 0 ? `Declared: ${fmtCur(declared.financial.fixed_deposit_amount)}` : 'Declared: None'
      case 'sec_h_savings_visible':      return null
      case 'sec_i_all_docs_present':     return null
      default:                           return null
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  const app = assignment?.application
  const matchColor = matchPreview >= 80 ? 'text-emerald-600' : matchPreview >= 50 ? 'text-amber-600' : 'text-red-600'
  const matchBg = matchPreview >= 80 ? 'bg-emerald-500' : matchPreview >= 50 ? 'bg-amber-500' : 'bg-red-500'

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
              <div className={`text-2xl font-bold ${matchColor}`}>{matchPreview}%</div>
              <div className="text-xs text-slate-400">match preview</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(answered / allFields.length) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-500 font-medium flex-shrink-0">{answered}/{allFields.length} answered</span>
          </div>

          {/* GPS status */}
          <div className={`flex items-center gap-1.5 mt-2 text-xs ${gps ? 'text-emerald-600' : gpsError ? 'text-amber-600' : 'text-slate-400'}`}>
            <MapPin className="w-3.5 h-3.5" />
            {gps ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
              : gpsError ? 'GPS unavailable  location not recorded'
              : 'Acquiring GPS location'}
          </div>

          {/* Priority review warning */}
          {app?.anomaly_flag && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              This applicant requires thorough verification  please check all documents and declarations carefully
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div className="px-6 flex gap-2 overflow-x-auto pb-3 border-t border-slate-100">
          {SECTIONS.map((s, i) => {
            const sAnswered = s.fields.every(f => f.key in answers && answers[f.key] !== '')
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors
                  ${activeSection === i ? 'bg-blue-700 text-white'
                    : sAnswered ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {sAnswered && <CheckCircle2 className="w-3 h-3" />}
                {s.icon} Sec {String.fromCharCode(65 + i)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section form */}
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {SECTIONS.map((section, si) => (
          <div key={section.key} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
            ${activeSection === si ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              onClick={() => setActiveSection(activeSection === si ? -1 : si)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{section.icon}</span>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{section.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{section.fields.length} question{section.fields.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {section.fields.every(f => f.key in answers && answers[f.key] !== '') && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                )}
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${activeSection === si ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {activeSection === si && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {section.fields.map(field => {
                  const hint = getDeclaredHint(field.key)
                  return (
                  <div key={field.key} className="px-5 py-4">
                    <p className="text-sm text-slate-700 font-medium mb-1">{field.label}</p>
                    {hint && (() => {
                      const fm = getFieldMatch(field.key)
                      return (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                            Declared: {hint}
                          </span>
                          {fm === true  && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">Match</span>}
                          {fm === false && <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">Mismatch</span>}
                        </div>
                      )
                    })()}
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
                          <CheckCircle2 className="w-4 h-4" />
                          Yes
                        </button>
                        <button
                          onClick={() => setAnswers(a => ({ ...a, [field.key]: false }))}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all
                            ${answers[field.key] === false
                              ? 'bg-red-600 border-red-600 text-white shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50'}`}
                        >
                          <XCircle className="w-4 h-4" />
                          No
                        </button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        ))}

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Verifier Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any discrepancies, observations, or additional context"
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${matchBg}`} style={{ width: `${matchPreview}%` }} />
              </div>
              <span className={`text-sm font-bold ${matchColor}`}>{matchPreview}% match</span>
            </div>
            <span className="text-xs text-slate-400">{answered}/{allFields.length} answered</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || answered < allFields.length}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting report' : answered < allFields.length ? `Answer ${allFields.length - answered} more question${allFields.length - answered !== 1 ? 's' : ''}` : 'Submit Field Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
