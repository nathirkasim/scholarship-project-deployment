'use client'

import { useEffect, useState } from 'react'
import { Brain, RefreshCw, Activity, ShieldAlert, CheckCircle2, Info } from 'lucide-react'

interface MLStatus {
  status: string
  model: string
  model_loaded: boolean
}

interface AnomalyTestResult {
  anomaly_score: number
  is_anomaly: boolean
}

export default function AdminMLPage() {
  const [status, setStatus] = useState<MLStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [testResult, setTestResult] = useState<AnomalyTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  async function load() {
    fetch('/api/proxy/admin/ml/status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setStatus(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  async function runTestAnomaly() {
    setTesting(true)
    setTestResult(null)
    try {
      // Sample test features  low income + high assets (should flag as anomaly)
      const testFeatures = {
        total_annual_income: 80000, income_per_capita: 16000, family_size: 5,
        earning_members: 1, dependents: 4, car_value: 500000, gold_value_inr: 300000,
        fixed_deposit_amount: 200000, electronics_value: 80000, total_asset_value: 1200000,
        land_area_acres: 0, vehicle_count: 2, house_type_encoded: 1,
        has_electricity: 1, has_piped_water: 1, has_toilet: 1, has_lpg: 1,
        caste_encoded: 0, is_differently_abled: 0, has_bpl_card: 1,
        has_aay_card: 0, has_mgnrega: 1, has_ayushman: 0, has_pm_schemes: 0,
        loan_outstanding: 0, hsc_percentage: 75, ug_aggregate_pct: 68,
        active_arrears: 0, is_first_graduate: 1, study_mode_encoded: 1,
        owns_land: 0, father_status_encoded: 0, mother_status_encoded: 0,
        has_chronic_illness: 0, mother_widow_pension: 0, religion_minority: 0,
        enrollment_encoded: 1, residential_encoded: 1, ration_type_encoded: 1,
        loan_to_income_ratio: 0, ownership_encoded: 1,
      }
      const res = await fetch('/api/proxy/admin/ml/test-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ features: Object.values(testFeatures) }),
      })
      const data = await res.json()
      setTestResult(data)
      showToast(data.is_anomaly ? 'Anomaly detected! (expected for contradictory data)' : 'No anomaly detected')
    } catch {
      showToast('ML service unavailable')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h1 className="text-xl font-bold text-slate-900">ML Configuration</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Isolation Forest anomaly detection  scoring is 100% rule-based</p>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !status ? (
          <div className="text-center py-24 text-slate-400">Could not load ML status</div>
        ) : (
          <>
            {/* Architecture Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Pure Rule-Based Scoring</p>
                <p className="text-blue-600 mt-0.5">
                  Need scoring uses 45 domain rules (AF) with no ML blend. Only Isolation Forest (G-08) remains for anomaly detection.
                  Every point in the composite score is traceable to a named rule.
                </p>
              </div>
            </div>

            {/* Isolation Forest Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-orange-500 to-red-500" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Isolation Forest (G-08)</div>
                    <div className="text-xs text-slate-400">40-feature unsupervised anomaly detection</div>
                  </div>
                  <div className="ml-auto">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.model_loaded ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {status.model_loaded ? 'Model Loaded' : 'Not Loaded'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Service Status</span>
                    <span className={`font-semibold ${status.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {status.status === 'ok' ? ' Online' : ' Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Anomaly Threshold</span>
                    <span className="font-semibold text-slate-900"> 0.65  flag + 8 pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Phase</span>
                    <span className="font-semibold text-slate-900">Phase 1 (pre-filter)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Retraining Required</span>
                    <span className="font-semibold text-slate-900">No (unsupervised)</span>
                  </div>
                </div>

                <button
                  onClick={runTestAnomaly}
                  disabled={testing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {testing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Testing</> : <><ShieldAlert className="w-4 h-4" /> Run Test Anomaly Check</>}
                </button>

                {testResult && (
                  <div className={`mt-3 p-3 rounded-xl text-sm ${testResult.is_anomaly ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
                    <div className="font-semibold">{testResult.is_anomaly ? ' Anomaly Detected' : ' Normal'}</div>
                    <div className="mt-1">Score: <span className="font-mono font-bold">{testResult.anomaly_score}</span> (threshold: 0.65)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Composite Formula */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-900 mb-3">Scoring Formula (H-05)</h2>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 font-mono text-center">
                WSM Score = <span className="text-blue-700 font-bold">0.35</span> × merit +{' '}
                <span className="text-green-700 font-bold">0.65</span> × rule_need +{' '}
                <span className="text-red-600 font-bold">integrity_adj</span>
              </div>
              <div className="flex items-start gap-2 mt-3 text-xs text-slate-400">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                WSM score is computed per applicant after rule evaluation. TOPSIS then re-ranks all evaluated applicants cohort-wide to produce the final composite score. 100% rule-based — no ML blend (H-03 deactivated).
              </div>
            </div>

            {/* Pipeline Info */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-slate-900">Scoring Pipeline</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                {[
                  { step: 'Phase 1', desc: 'Isolation Forest runs on every submission. Score  0.65  anomaly_flag + 8 pts (G-08).', color: 'border-orange-200 bg-orange-50' },
                  { step: 'Rule Engine Scoring', desc: '45 SCORE rules (A–F) compute merit + need. 8 G-rules apply integrity deductions. 100% rule-based.', color: 'border-blue-200 bg-blue-50' },
                  { step: 'Verification', desc: 'I-domain multipliers: 1.0 (clean), 0.85 (review), 0.50 (contradicted). Re-rank  top 100.', color: 'border-purple-200 bg-purple-50' },
                ].map(({ step, desc, color }) => (
                  <div key={step} className={`rounded-xl border p-3 ${color}`}>
                    <div className="font-bold text-slate-900 mb-1">{step}</div>
                    <div className="text-xs text-slate-600">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
