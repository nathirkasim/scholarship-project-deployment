'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Brain, RefreshCw, Activity, ShieldAlert, CheckCircle2, XCircle,
  Info, Save, ToggleLeft, ToggleRight, AlertTriangle, BarChart3, Settings2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MLStatus { status: string; model: string; model_loaded: boolean }

interface AnomalyStats {
  flagged_count: number; total_evaluated: number; flag_rate: string
  avg_score: number | null; max_score: number | null
  recent_flagged: Array<{
    id: string; anomaly_score: number | null; anomaly_reasons: any
    created_at: string
    user: { full_name: string }; program: { program_name: string }
  }>
}

interface RuleRow {
  id: string; rule_code: string; rule_name: string; rule_description: string
  domain: string; is_active: boolean; score_pts: number; default_value: Record<string, unknown>
}

// ─── Per-rule edit state ──────────────────────────────────────────────────────

interface RuleEdit {
  is_active: boolean
  score_pts: number
  default_value: Record<string, unknown>
}

// ─── G-01..G-07 UI metadata ───────────────────────────────────────────────────
// Describes which fields inside default_value are numeric-editable and their labels.

interface ThresholdField {
  key: string           // key inside default_value e.g. 'field1_lte'
  label: string
  min: number; max: number; step: number
  formatSuffix?: string
}

interface GRuleMeta {
  shortCondition: string   // one-liner shown in the card
  thresholds: ThresholdField[]
}

const G_META: Record<string, GRuleMeta> = {
  'G-01': {
    shortCondition: 'Annual income ≤ ceiling  AND  car value ≥ floor',
    thresholds: [
      { key: 'field1_lte', label: 'Max annual income (₹)', min: 50000, max: 800000, step: 10000 },
      { key: 'field2_gte', label: 'Min car value (₹)',     min: 50000, max: 2000000, step: 50000 },
    ],
  },
  'G-02': {
    shortCondition: 'Annual income ≤ ceiling  AND  electronics value ≥ floor',
    thresholds: [
      { key: 'field1_lte', label: 'Max annual income (₹)',       min: 50000, max: 800000, step: 10000 },
      { key: 'field2_gte', label: 'Min electronics value (₹)',   min: 10000, max: 500000, step: 10000 },
    ],
  },
  'G-03': {
    shortCondition: 'Annual income ≤ ceiling  AND  gold / jewellery ≥ floor',
    thresholds: [
      { key: 'field1_lte', label: 'Max annual income (₹)',   min: 50000, max: 800000, step: 10000 },
      { key: 'field2_gte', label: 'Min gold value (₹)',      min: 50000, max: 1000000, step: 50000 },
    ],
  },
  'G-04': {
    shortCondition: 'Annual income ≤ ceiling  AND  fixed deposits / savings ≥ floor',
    thresholds: [
      { key: 'field1_lte', label: 'Max annual income (₹)',        min: 50000, max: 800000, step: 10000 },
      { key: 'field2_gte', label: 'Min fixed deposit amount (₹)', min: 10000, max: 500000, step: 10000 },
    ],
  },
  'G-05': {
    shortCondition: 'House type = kutcha  AND  total assets ≥ floor',
    thresholds: [
      { key: 'field2_gte', label: 'Min total asset value (₹)', min: 10000, max: 1000000, step: 10000 },
    ],
  },
  'G-06': {
    shortCondition: 'Ownership type = rented  AND  owns land = true',
    thresholds: [],   // both fields are boolean/enum — no numeric threshold to expose
  },
  'G-07': {
    shortCondition: 'Has active govt benefits = true  AND  annual income ≥ floor',
    thresholds: [
      { key: 'field2_gte', label: 'Min income to flag (₹)', min: 100000, max: 2000000, step: 50000 },
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

const DEDUCTION_COLORS: Record<string, string> = {
  'G-01': 'border-l-red-500',
  'G-02': 'border-l-orange-500',
  'G-03': 'border-l-amber-500',
  'G-04': 'border-l-rose-500',
  'G-05': 'border-l-purple-500',
  'G-06': 'border-l-indigo-500',
  'G-07': 'border-l-pink-500',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminMLPage() {
  const [mlStatus,   setMlStatus]   = useState<MLStatus | null>(null)
  const [stats,      setStats]      = useState<AnomalyStats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  // G-08 state
  const [g08,        setG08]        = useState<RuleRow | null>(null)
  const [g08Saving,  setG08Saving]  = useState(false)
  const [threshold,  setThreshold]  = useState(0.65)
  const [deduction,  setDeduction]  = useState(-8)
  const [active,     setActive]     = useState(true)

  // G-01..G-07 state
  const [gRules,     setGRules]     = useState<RuleRow[]>([])
  const [gEdits,     setGEdits]     = useState<Record<string, RuleEdit>>({})
  const [gSaving,    setGSaving]    = useState<Record<string, boolean>>({})

  // Test panel
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<{ anomaly_score: number; is_anomaly: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [statusRes, statsRes, rulesRes] = await Promise.all([
      fetch('/api/proxy/admin/ml/status',        { credentials: 'include' }),
      fetch('/api/proxy/admin/ml/anomaly-stats',  { credentials: 'include' }),
      fetch('/api/proxy/admin/rules',             { credentials: 'include' }),
    ])
    const [statusData, statsData, rulesData] = await Promise.all([
      statusRes.ok ? statusRes.json() : null,
      statsRes.ok  ? statsRes.json()  : null,
      rulesRes.ok  ? rulesRes.json()  : null,
    ])

    if (statusData) setMlStatus(statusData)
    if (statsData)  setStats(statsData)

    if (rulesData?.rules) {
      const allRules: RuleRow[] = rulesData.rules

      // G-08
      const rule08 = allRules.find((r: RuleRow) => r.rule_code === 'G-08')
      if (rule08) {
        setG08(rule08)
        setThreshold(Number((rule08.default_value as any)?.threshold ?? 0.65))
        setDeduction(Number(rule08.score_pts))
        setActive(rule08.is_active)
      }

      // G-01..G-07
      const gList = allRules
        .filter((r: RuleRow) => r.domain === 'G' && r.rule_code !== 'G-08')
        .sort((a: RuleRow, b: RuleRow) => a.rule_code.localeCompare(b.rule_code))
      setGRules(gList)

      // Initialise edit state from DB values
      const edits: Record<string, RuleEdit> = {}
      for (const r of gList) {
        edits[r.id] = {
          is_active:     r.is_active,
          score_pts:     Number(r.score_pts),
          default_value: { ...(r.default_value as Record<string, unknown>) },
        }
      }
      setGEdits(edits)
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── G-08 save ──────────────────────────────────────────────────────────────

  async function saveG08() {
    if (!g08) return
    setG08Saving(true)
    const res = await fetch(`/api/proxy/admin/rules/${g08.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        is_active:     active,
        score_pts:     deduction,
        default_value: { ...(g08.default_value ?? {}), threshold },
      }),
    })
    const data = await res.json()
    if (res.ok) { setG08(data.rule); showToast('G-08 configuration saved') }
    else showToast(data.error || 'Save failed', false)
    setG08Saving(false)
  }

  const g08Dirty = g08 && (
    threshold !== Number((g08.default_value as any)?.threshold ?? 0.65) ||
    deduction !== Number(g08.score_pts) ||
    active    !== g08.is_active
  )

  // ── G-01..G-07 helpers ─────────────────────────────────────────────────────

  function updateGEdit(ruleId: string, patch: Partial<RuleEdit>) {
    setGEdits(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], ...patch } }))
  }

  function updateGThreshold(ruleId: string, key: string, value: number) {
    setGEdits(prev => ({
      ...prev,
      [ruleId]: {
        ...prev[ruleId],
        default_value: { ...prev[ruleId].default_value, [key]: value },
      },
    }))
  }

  function isGDirty(rule: RuleRow): boolean {
    const e = gEdits[rule.id]
    if (!e) return false
    if (e.is_active !== rule.is_active) return true
    if (e.score_pts !== Number(rule.score_pts)) return true
    const orig = rule.default_value as Record<string, unknown>
    for (const key of Object.keys(e.default_value)) {
      if (e.default_value[key] !== orig[key]) return true
    }
    return false
  }

  async function saveGRule(rule: RuleRow) {
    const e = gEdits[rule.id]
    if (!e) return
    setGSaving(prev => ({ ...prev, [rule.id]: true }))
    const res = await fetch(`/api/proxy/admin/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        is_active:     e.is_active,
        score_pts:     e.score_pts,
        default_value: e.default_value,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setGRules(prev => prev.map(r => r.id === rule.id ? data.rule : r))
      setGEdits(prev => ({
        ...prev,
        [rule.id]: {
          is_active:     data.rule.is_active,
          score_pts:     Number(data.rule.score_pts),
          default_value: { ...(data.rule.default_value as Record<string, unknown>) },
        },
      }))
      showToast(`${rule.rule_code} saved`)
    } else {
      showToast(data.error || 'Save failed', false)
    }
    setGSaving(prev => ({ ...prev, [rule.id]: false }))
  }

  // ── Test anomaly ───────────────────────────────────────────────────────────

  async function runTestAnomaly() {
    setTesting(true); setTestResult(null)
    try {
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ features: Object.values(testFeatures) }),
      })
      const data = await res.json()
      setTestResult(data)
      showToast(data.is_anomaly ? 'Anomaly detected — model working correctly' : 'No anomaly — model is running', !data.is_anomaly)
    } catch {
      showToast('ML service unavailable', false)
    } finally { setTesting(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2
          ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30 flex items-center gap-3">
        <Brain className="w-5 h-5 text-purple-600" />
        <div>
          <h1 className="text-lg font-bold text-slate-900">ML Configuration</h1>
          <p className="text-sm text-slate-500 mt-0.5">Isolation Forest anomaly detection — G-08 model and G-01–G-07 rule thresholds</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Service status banner */}
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border text-sm font-medium
              ${mlStatus?.status === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${mlStatus?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>
                ML Service: <strong>{mlStatus?.status === 'ok' ? 'Online' : 'Offline'}</strong>
                {mlStatus?.model_loaded !== undefined && (
                  <> &nbsp;·&nbsp; Model: <strong>{mlStatus.model_loaded ? 'Loaded' : 'Not Loaded'}</strong></>
                )}
              </span>
              {mlStatus?.status !== 'ok' && (
                <span className="ml-auto text-xs">Anomaly detection will be skipped until the ML service is reachable</span>
              )}
            </div>

            {/* ── G-08 Configuration ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-400 via-red-500 to-rose-500" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">G-08 — Isolation Forest (ML Model)</div>
                    <div className="text-xs text-slate-400 mt-0.5">40-feature unsupervised anomaly detection · Phase 1 pre-filter · Auto-rejects on fire</div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm text-slate-500 font-medium">Enabled</span>
                    <button onClick={() => setActive(v => !v)} type="button" className="focus:outline-none">
                      {active
                        ? <ToggleRight className="w-9 h-9 text-emerald-500" />
                        : <ToggleLeft  className="w-9 h-9 text-slate-300" />}
                    </button>
                  </div>
                </div>

                {!active && (
                  <div className="mb-5 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <span><strong>G-08 is disabled.</strong> Isolation Forest will not run. Rule-based G-01–G-07 checks still apply.</span>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Threshold */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Anomaly Score Threshold</label>
                      <p className="text-xs text-slate-400 mb-3">
                        Applications with Isolation Forest score ≥ this value are flagged and auto-rejected in Phase 1.
                        Lower = stricter. Higher = more permissive.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min={0.40} max={0.95} step={0.01} value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        className="flex-1 accent-orange-500" disabled={!active} />
                      <input type="number" min={0.40} max={0.95} step={0.01} value={threshold}
                        onChange={e => setThreshold(Math.min(0.95, Math.max(0.40, Number(e.target.value))))}
                        className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
                        disabled={!active} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>0.40 strict</span>
                      <span className={`font-semibold text-sm ${threshold < 0.55 ? 'text-red-600' : threshold < 0.70 ? 'text-orange-500' : 'text-emerald-600'}`}>
                        {threshold < 0.55 ? 'Very Strict' : threshold < 0.70 ? 'Balanced' : 'Permissive'}
                      </span>
                      <span>0.95 permissive</span>
                    </div>
                  </div>

                  {/* Deduction */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Integrity Deduction (pts)</label>
                      <p className="text-xs text-slate-400 mb-3">
                        Points subtracted from integrity_adj when G-08 fires. Must be negative. Capped at −40 total.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min={-20} max={-1} step={1} value={deduction}
                        onChange={e => setDeduction(Number(e.target.value))}
                        className="flex-1 accent-red-500" disabled={!active} />
                      <input type="number" min={-20} max={-1} step={1} value={deduction}
                        onChange={e => setDeduction(Math.min(-1, Math.max(-20, Number(e.target.value))))}
                        className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-slate-50"
                        disabled={!active} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>−20 severe</span>
                      <span className={`font-semibold text-sm ${deduction <= -15 ? 'text-red-600' : deduction <= -8 ? 'text-orange-500' : 'text-slate-500'}`}>
                        {deduction} pts
                      </span>
                      <span>−1 mild</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 mb-2">Effective behaviour:</div>
                  {active ? (
                    <>
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />Runs on every submitted application (40-feature vector)</div>
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />Score ≥ <strong>{threshold}</strong> → anomaly_flagged → rejected in Phase 1</div>
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" /><strong>{deduction} pts</strong> deducted from integrity_adj when fired</div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      Disabled — only G-01–G-07 rule checks apply
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <button onClick={saveG08} disabled={g08Saving || !g08Dirty}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-colors">
                    {g08Saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {g08Saving ? 'Saving…' : 'Save G-08 Config'}
                  </button>
                  <span className={`text-xs font-medium ${g08Dirty ? 'text-amber-600' : 'text-slate-400'}`}>
                    {g08Dirty ? 'Unsaved changes' : 'No unsaved changes'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── G-01..G-07 Rule Configuration ──────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-slate-400 via-orange-400 to-red-400" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Settings2 className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">G-01 to G-07 — Rule-Based Integrity Checks</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Cross-field consistency rules. Any that fire push the application to anomaly_flagged in Phase 1.
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-5 ml-13">
                  Each rule uses an AND_COMPOUND condition — both fields must satisfy their condition simultaneously for the rule to fire.
                  Adjust thresholds and deduction points below. Changes take effect on the next application submission.
                </p>

                <div className="space-y-4">
                  {gRules.map(rule => {
                    const meta   = G_META[rule.rule_code]
                    const edit   = gEdits[rule.id]
                    const dirty  = isGDirty(rule)
                    const saving = gSaving[rule.id]
                    const borderColor = DEDUCTION_COLORS[rule.rule_code] ?? 'border-l-slate-400'

                    if (!edit || !meta) return null

                    return (
                      <div key={rule.id}
                        className={`rounded-xl border border-slate-200 border-l-4 ${borderColor} bg-slate-50 p-5`}>

                        {/* Row header */}
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-bold font-mono">
                              {rule.rule_code}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{rule.rule_name}</span>
                              {!edit.is_active && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">DISABLED</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{rule.rule_description}</p>
                            <p className="text-xs text-slate-400 mt-1 font-mono">{meta.shortCondition}</p>
                          </div>
                          {/* Enable toggle */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-slate-500">Active</span>
                            <button onClick={() => updateGEdit(rule.id, { is_active: !edit.is_active })} type="button" className="focus:outline-none">
                              {edit.is_active
                                ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                                : <ToggleLeft  className="w-8 h-8 text-slate-300" />}
                            </button>
                          </div>
                        </div>

                        {/* Threshold + deduction editors */}
                        <div className={`mt-4 grid gap-4 ${(meta.thresholds.length > 0 ? meta.thresholds.length + 1 : 1) > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>

                          {/* Threshold fields */}
                          {meta.thresholds.map(tf => {
                            const val = Number(edit.default_value[tf.key] ?? 0)
                            return (
                              <div key={tf.key} className="bg-white rounded-xl border border-slate-200 p-4">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">{tf.label}</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range" min={tf.min} max={tf.max} step={tf.step}
                                    value={val}
                                    onChange={e => updateGThreshold(rule.id, tf.key, Number(e.target.value))}
                                    disabled={!edit.is_active}
                                    className="flex-1 accent-slate-700 disabled:opacity-40"
                                  />
                                  <input
                                    type="number" min={tf.min} max={tf.max} step={tf.step}
                                    value={val}
                                    onChange={e => updateGThreshold(rule.id, tf.key, Math.min(tf.max, Math.max(tf.min, Number(e.target.value))))}
                                    disabled={!edit.is_active}
                                    className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                                  />
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">{fmtINR(val)}</div>
                              </div>
                            )
                          })}

                          {/* G-06 has no numeric thresholds — show info pill instead */}
                          {meta.thresholds.length === 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-2 text-xs text-slate-400 italic">
                              <Info className="w-3.5 h-3.5 flex-shrink-0" />
                              Both conditions are fixed (housing type = rented, owns land = true). No numeric thresholds to configure.
                            </div>
                          )}

                          {/* Deduction pts */}
                          <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Deduction (pts) <span className="text-slate-400 font-normal">— subtracted from integrity_adj</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="range" min={-20} max={-1} step={1}
                                value={edit.score_pts}
                                onChange={e => updateGEdit(rule.id, { score_pts: Number(e.target.value) })}
                                disabled={!edit.is_active}
                                className="flex-1 accent-red-500 disabled:opacity-40"
                              />
                              <input
                                type="number" min={-20} max={-1} step={1}
                                value={edit.score_pts}
                                onChange={e => updateGEdit(rule.id, { score_pts: Math.min(-1, Math.max(-20, Number(e.target.value))) })}
                                disabled={!edit.is_active}
                                className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            </div>
                            <div className={`text-[11px] mt-1 ${edit.score_pts <= -8 ? 'text-red-500' : 'text-slate-400'}`}>
                              {edit.score_pts} pts
                            </div>
                          </div>
                        </div>

                        {/* Save row */}
                        <div className="mt-4 flex items-center gap-3">
                          <button onClick={() => saveGRule(rule)} disabled={saving || !dirty}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg transition-colors">
                            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? 'Saving…' : `Save ${rule.rule_code}`}
                          </button>
                          <span className={`text-xs font-medium ${dirty ? 'text-amber-600' : 'text-slate-400'}`}>
                            {dirty ? 'Unsaved changes' : 'Saved'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Anomaly Detection Stats ─────────────────────────────────── */}
            {stats && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <h2 className="font-bold text-slate-900">Anomaly Detection Statistics</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Flagged',     value: stats.flagged_count,                                              cls: 'text-orange-700 bg-orange-50 border-orange-100' },
                    { label: 'Flag Rate',          value: `${stats.flag_rate}%`,                                            cls: 'text-red-700 bg-red-50 border-red-100' },
                    { label: 'Avg Anomaly Score',  value: stats.avg_score != null ? Number(stats.avg_score).toFixed(3) : '—', cls: 'text-purple-700 bg-purple-50 border-purple-100' },
                    { label: 'Max Score Seen',     value: stats.max_score != null ? Number(stats.max_score).toFixed(3) : '—', cls: 'text-rose-700 bg-rose-50 border-rose-100' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`rounded-xl border p-4 text-center ${cls}`}>
                      <div className="text-2xl font-bold tabular-nums">{value}</div>
                      <div className="text-xs font-semibold mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                {stats.recent_flagged.length > 0 && (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Recent Flagged Applications</div>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                      {stats.recent_flagged.map(app => {
                        const reasons = (app.anomaly_reasons as any) ?? {}
                        const gFired  = (reasons.g_rules_fired ?? []) as string[]
                        const mlFlag  = reasons.ml_flag === true
                        return (
                          <div key={app.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-800 text-sm">{app.user.full_name}</div>
                              <div className="text-xs text-slate-400">{app.program.program_name}</div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {gFired.map(r => (
                                <span key={r} className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[11px] font-bold">{r}</span>
                              ))}
                              {mlFlag && (
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-bold">G-08 ML</span>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-bold text-red-700 tabular-nums">
                                {app.anomaly_score != null ? Number(app.anomaly_score).toFixed(3) : '—'}
                              </div>
                              <div className="text-[11px] text-slate-400">IF score</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {stats.flagged_count === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">No anomaly-flagged applications yet</div>
                )}
              </div>
            )}

            {/* ── Test Anomaly ────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-orange-500" />
                <h2 className="font-bold text-slate-900">Test Anomaly Detection</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Sends a synthetic contradictory profile (income ₹80K, car ₹5L, gold ₹3L, FD ₹2L) to the Isolation Forest model.
                This should reliably produce a high anomaly score above the current threshold.
              </p>
              <button onClick={runTestAnomaly} disabled={testing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-colors">
                {testing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running…</> : <><ShieldAlert className="w-4 h-4" /> Run Test</>}
              </button>
              {testResult && (
                <div className={`mt-4 p-4 rounded-xl border text-sm ${testResult.is_anomaly ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  <div className="font-bold mb-1">{testResult.is_anomaly ? '⚠ Anomaly Detected' : '✓ Normal — no anomaly'}</div>
                  <div>Score: <span className="font-mono font-bold text-base">{Number(testResult.anomaly_score).toFixed(4)}</span></div>
                  <div className="text-xs mt-1 opacity-75">
                    Current threshold: <strong>{threshold}</strong> — score is {testResult.anomaly_score >= threshold ? 'above' : 'below'} threshold
                  </div>
                </div>
              )}
            </div>

            {/* ── Architecture note ───────────────────────────────────────── */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-500 space-y-1">
                  <p><strong className="text-slate-700">Phase 1 rejection order:</strong> G-01–G-07 rule checks run first, then G-08 Isolation Forest. Any rule or model firing sets <code className="text-xs bg-slate-200 px-1 rounded">anomaly_flagged</code> and the application is auto-rejected with a specific rejection reason per fired rule.</p>
                  <p><strong className="text-slate-700">Scoring is 100% rule-based.</strong> Need scoring uses 45 domain rules (A–F). ML blend (H-03 / XGBoost) is deactivated. G-08 is the only active ML module.</p>
                  <p>Rule-based scoring thresholds for domains A–F can be configured in <strong>Admin → Rules</strong>.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
