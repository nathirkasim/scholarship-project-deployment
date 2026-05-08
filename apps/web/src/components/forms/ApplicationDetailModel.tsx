'use client'
import { useEffect, useState } from 'react'
import { X, User, GraduationCap, Users, Wallet, Car, Home, Shield, FileText, AlertTriangle, Activity } from 'lucide-react'

interface Props { appId: string; onClose: () => void }

const RULE_LABELS: Record<string, string> = {
  'G-01': 'Income vs Vehicle Asset', 'G-02': 'Income vs Electronics Asset',
  'G-03': 'Income vs Gold / Jewellery', 'G-04': 'Income vs Fixed Deposit / Savings',
  'G-05': 'Housing Condition vs Total Asset Value', 'G-06': 'Rented Housing vs Land Ownership',
  'G-07': 'Govt Benefits vs High Income', 'G-08': 'ML Anomaly Detection (Isolation Forest)',
}

function fmtINR(v: unknown) { const n = Number(v ?? 0); return n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}` }
function fmt(v: unknown) { return v != null && v !== '' ? String(v) : '—' }
function fmtBool(v: unknown) { return v === true ? 'Yes' : v === false ? 'No' : '—' }
function fmtDate(v: unknown) { if (!v) return '—'; try { return new Date(String(v)).toLocaleDateString('en-IN') } catch { return '—' } }

function Section({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 ${color}`}>
        <Icon className="w-4 h-4" /><span className="text-sm font-bold">{title}</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-slate-400 block">{label}</span><span className="font-medium text-slate-800">{value}</span></div>
}

export default function ApplicationDetailModal({ appId, onClose }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    fetch(`/api/proxy/officer/application/${appId}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [appId])

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-10"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
    </div>
  )

  const app = data?.application
  const p = data?.profile ?? {}
  if (!app) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-red-600 font-semibold">Failed to load application</p>
        <button onClick={onClose} className="mt-3 px-4 py-2 bg-slate-100 rounded-lg text-sm">Close</button>
      </div>
    </div>
  )

  const anomalyReasons = (app.anomaly_reasons ?? {}) as { g_rules_fired?: string[]; ml_flag?: boolean }
  const gRules = anomalyReasons.g_rules_fired ?? []
  const mlFlag = anomalyReasons.ml_flag ?? false
  const docs = app.documents ?? []

  const TABS = ['Profile', 'Scores & Anomaly', 'Documents']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{app.user?.full_name}</h3>
            <p className="text-sm text-slate-500">{app.user?.email} · {app.program?.program_name} · {app.program?.academic_year}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-slate-100 flex-shrink-0">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${tab === i ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {tab === 0 && (
            <>
              {/* Step 1: Personal */}
              <Section icon={User} title="Step 1 — Personal Details" color="bg-blue-50 text-blue-800">
                <Field label="Gender" value={fmt(p.personal?.gender)} />
                <Field label="Date of Birth" value={fmtDate(p.personal?.date_of_birth)} />
                <Field label="Caste Category" value={fmt(p.personal?.caste_category)} />
                <Field label="Religion Minority" value={fmtBool(p.personal?.religion_minority_status)} />
                <Field label="Differently Abled" value={fmtBool(p.personal?.is_differently_abled)} />
                <Field label="Enrollment Status" value={fmt(p.personal?.enrollment_status)} />
                <Field label="State" value={fmt(p.personal?.state)} />
                <Field label="District" value={fmt(p.personal?.district)} />
                <Field label="Pincode" value={fmt(p.personal?.pincode)} />
              </Section>

              {/* Step 2: Academic */}
              <Section icon={GraduationCap} title="Step 2 — Academic Details" color="bg-purple-50 text-purple-800">
                <Field label="Institution" value={fmt(p.academic?.institution?.name)} />
                <Field label="Course" value={fmt(p.academic?.course_name)} />
                <Field label="Course Type" value={fmt(p.academic?.course_type)} />
                <Field label="Study Mode" value={fmt(p.academic?.study_mode)} />
                <Field label="Year of Study" value={fmt(p.academic?.current_year_of_study)} />
                <Field label="HSC %" value={fmt(p.academic?.hsc_percentage)} />
                <Field label="UG Aggregate %" value={fmt(p.academic?.ug_aggregate_pct)} />
                <Field label="Active Arrears" value={fmt(p.academic?.active_arrears)} />
                <Field label="First Graduate" value={fmtBool(p.personal?.is_first_graduate)} />
                <Field label="Other Scholarship" value={fmtBool(p.academic?.receiving_other_scholarship)} />
                <Field label="Prev Awarded by Trust" value={fmtBool(p.academic?.prev_awarded_by_trust)} />
              </Section>

              {/* Step 3: Family */}
              <Section icon={Users} title="Step 3 — Family Details" color="bg-teal-50 text-teal-800">
                <Field label="Father Status" value={fmt(p.personal?.father_status)} />
                <Field label="Mother Status" value={fmt(p.personal?.mother_status)} />
                <Field label="Single Parent" value={fmtBool(p.personal?.is_single_parent)} />
                <Field label="Orphan" value={fmtBool(p.personal?.is_orphan)} />
                <Field label="Family Size" value={fmt(p.family?.family_size)} />
                <Field label="Earning Members" value={fmt(p.family?.earning_members)} />
                <Field label="Dependents" value={fmt(p.family?.dependents)} />
                <Field label="Siblings in Education" value={fmt(p.family?.siblings_in_education)} />
                <Field label="Chronic Illness" value={fmtBool(p.family?.has_chronic_illness)} />
                <Field label="Mother Widow Pension" value={fmtBool(p.family?.mother_widow_pension)} />
              </Section>

              {/* Step 4: Financial */}
              <Section icon={Wallet} title="Step 4 — Financial Details" color="bg-amber-50 text-amber-800">
                <Field label="Annual Income" value={fmtINR(p.financial?.total_annual_income)} />
                <Field label="Loan Outstanding" value={fmtINR(p.financial?.loan_outstanding)} />
                <Field label="Gold Value" value={fmtINR(p.financial?.gold_value_inr)} />
                <Field label="Fixed Deposit" value={fmtINR(p.financial?.fixed_deposit_amount)} />
                <Field label="Ration Card" value={fmt(p.financial?.ration_card_type)} />
                <Field label="Annual Expenses" value={p.financial?.annual_expenses ? fmtINR(p.financial.annual_expenses) : '—'} />
              </Section>

              {/* Step 5: Assets */}
              <Section icon={Car} title="Step 5 — Assets" color="bg-orange-50 text-orange-800">
                <Field label="Total Asset Value" value={fmtINR(p.assets?.total_asset_value)} />
                <Field label="Car Value" value={fmtINR(p.assets?.car_value)} />
                <Field label="Vehicle Count" value={fmt(p.assets?.vehicle_count)} />
                <Field label="Electronics Value" value={fmtINR(p.assets?.electronics_value)} />
                <Field label="Land (acres)" value={fmt(p.assets?.land_area_acres)} />
                <Field label="Owns Land" value={fmtBool(p.assets?.owns_land)} />
                <Field label="Property Count" value={fmt(p.assets?.property_count)} />
              </Section>

              {/* Step 6: Housing */}
              <Section icon={Home} title="Step 6 — Housing" color="bg-sky-50 text-sky-800">
                <Field label="House Type" value={fmt(p.housing?.house_type)} />
                <Field label="Ownership" value={fmt(p.housing?.ownership_type)} />
                <Field label="Total Rooms" value={fmt(p.housing?.total_rooms)} />
                <Field label="Electricity" value={fmtBool(p.housing?.has_electricity)} />
                <Field label="Piped Water" value={fmtBool(p.housing?.has_piped_water)} />
                <Field label="Toilet" value={fmtBool(p.housing?.has_toilet)} />
                <Field label="LPG" value={fmtBool(p.housing?.has_lpg)} />
                <Field label="Residential Type" value={fmt(p.personal?.residential_type)} />
              </Section>

              {/* Step 7: Govt Benefits */}
              <Section icon={Shield} title="Step 7 — Government Benefits" color="bg-emerald-50 text-emerald-800">
                <Field label="Active Benefits" value={fmtBool(p.govtBenefits?.has_active_benefits)} />
                <Field label="BPL Card" value={fmtBool(p.govtBenefits?.has_bpl_card)} />
                <Field label="AAY Card" value={fmtBool(p.govtBenefits?.has_aay_card)} />
                <Field label="MGNREGA" value={fmtBool(p.govtBenefits?.has_mgnrega)} />
                <Field label="Ayushman Bharat" value={fmtBool(p.govtBenefits?.has_ayushman)} />
                <Field label="PM Schemes" value={fmtBool(p.govtBenefits?.has_pm_schemes)} />
                <Field label="Benefit Details" value={fmt(p.govtBenefits?.benefit_details)} />
              </Section>
            </>
          )}

          {tab === 1 && (
            <>
              {/* Scores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Composite Score', value: app.composite_score, color: 'bg-slate-900 text-white' },
                  { label: 'Merit Score', value: app.merit_score, color: 'bg-blue-600 text-white' },
                  { label: 'Need Score', value: app.rule_need_score, color: 'bg-emerald-600 text-white' },
                  { label: 'Integrity Adj', value: app.integrity_adj, color: 'bg-purple-600 text-white' },
                ].map(s => (
                  <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                    <div className="text-2xl font-bold tabular-nums">{s.value != null ? Number(s.value).toFixed(1) : '—'}</div>
                    <div className="text-xs mt-1 opacity-80">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-xl font-bold text-slate-700">{app.composite_rank ? `#${app.composite_rank}` : '—'}</div>
                  <div className="text-xs text-slate-400 mt-1">TOPSIS Rank</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-xl font-bold text-teal-700">{app.post_verify_composite != null ? Number(app.post_verify_composite).toFixed(2) : '—'}</div>
                  <div className="text-xs text-slate-400 mt-1">Post-Verify Composite</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-xl font-bold text-amber-700">{app.verification_match_score != null ? `${Number(app.verification_match_score).toFixed(1)}%` : '—'}</div>
                  <div className="text-xs text-slate-400 mt-1">Verification Match</div>
                </div>
              </div>

              {/* Anomaly Section */}
              <div className={`rounded-xl border p-5 ${app.anomaly_flag ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {app.anomaly_flag ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <Activity className="w-5 h-5 text-emerald-600" />}
                  <span className={`font-bold ${app.anomaly_flag ? 'text-red-800' : 'text-emerald-800'}`}>
                    {app.anomaly_flag ? 'Anomaly Flagged' : 'No Anomaly Detected'}
                  </span>
                </div>
                {app.anomaly_score != null && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-slate-600 uppercase">ML Anomaly Score</span>
                    <span className="font-mono text-lg font-bold text-orange-600">{Number(app.anomaly_score).toFixed(3)}</span>
                    <span className="text-xs text-slate-500">{Number(app.anomaly_score) >= 0.65 ? '≥ 0.65 threshold — flagged' : 'below threshold'}</span>
                  </div>
                )}
                {(gRules.length > 0 || mlFlag) && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-xs font-bold text-red-700 uppercase">Integrity Rules Fired</p>
                    {gRules.map((code: string) => (
                      <div key={code} className="flex items-center gap-2 text-sm text-red-800">
                        <span className="font-mono text-[11px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-bold">{code}</span>
                        <span>{RULE_LABELS[code] ?? code}</span>
                      </div>
                    ))}
                    {mlFlag && (
                      <div className="flex items-center gap-2 text-sm text-red-800">
                        <span className="font-mono text-[11px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-bold">G-08</span>
                        <span>{RULE_LABELS['G-08']}</span>
                      </div>
                    )}
                  </div>
                )}
                {app.rejection_reason && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Rejection Reason</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{app.rejection_reason}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 2 && (
            <>
              {/* Step 8: Documents */}
              {docs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No documents uploaded</div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{doc.original_name}</div>
                          <div className="text-xs text-slate-400">{doc.doc_type} · {doc.file_size_kb} KB · {fmtDate(doc.created_at)}</div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        doc.status === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                        doc.status === 'rejected' ? 'bg-red-50 text-red-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>{doc.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Timeline */}
              {(app.status_logs ?? []).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Status Timeline</h4>
                  <div className="space-y-2">
                    {app.status_logs.map((log: any, i: number) => (
                      <div key={log.id ?? i} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-700">{log.from_status ?? '—'} → {log.to_status}</span>
                          {log.reason && <span className="text-slate-400 ml-2">— {log.reason}</span>}
                          <div className="text-xs text-slate-400">{fmtDate(log.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}
