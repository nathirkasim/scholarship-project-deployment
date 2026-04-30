'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Users, ShieldAlert, CheckCircle2, BarChart3, Activity, ChevronDown } from 'lucide-react'

interface AnalyticsData {
  statusCounts: Array<{ status: string; _count: number }>
  scoreStats: { _avg: { merit_score: string | number | null; rule_need_score: string | number | null; composite_score: string | number | null; integrity_adj: string | number | null }; _max: { composite_score: string | number | null }; _min: { composite_score: string | number | null } }
  anomalyStats: { _count: { id: number }; _avg: { anomaly_score: number | null } }
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#ec4899','#14b8a6','#f97316']
const STATUS_LABEL: Record<string, string> = {
  draft:'Draft', submitted:'Submitted', evaluating:'Under Review', anomaly_flagged:'Flagged',
  not_shortlisted:'Ineligible', evaluated:'Evaluated', scored:'Ranked',
  verification_pending:'Verif. Pending', verification_complete:'Verified',
  approved:'Approved', waitlisted:'Waitlisted', rejected:'Rejected',
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: any; sub: string; color: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600', emerald: 'bg-emerald-50 text-emerald-600' }
  const textColors: Record<string, string> = { blue: 'text-blue-700', purple: 'text-purple-700', orange: 'text-orange-700', emerald: 'text-emerald-700' }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}><Icon className="w-5 h-5" /></div>
      <div className={`text-3xl font-bold tabular-nums ${textColors[color]}`}>{value}</div>
      <div className="text-sm font-semibold text-slate-700 mt-1">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [programs, setPrograms] = useState<Array<{ id: string; program_name: string }>>([])
  const [programId, setProgramId] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/proxy/programs', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.programs || []; setPrograms(list); if (list.length > 0) setProgramId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!programId) return
    setLoading(true)
    fetch(`/api/proxy/officer/analytics/${programId}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [programId])

  const totalApps = data?.statusCounts?.reduce((s, x) => s + (x._count || 0), 0) ?? 0
  const approvedCount = data?.statusCounts?.find(s => s.status === 'approved')?._count ?? 0
  const anomalyCount = data?.anomalyStats?._count?.id ?? 0
  const anomalyRate = totalApps > 0 ? ((anomalyCount / totalApps) * 100).toFixed(1) : '0.0'
  const chartData = (data?.statusCounts ?? []).map(s => ({ name: STATUS_LABEL[s.status] ?? s.status, count: s._count }))
  const pieData = chartData.filter(d => d.count > 0)

  const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: 12 }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-30 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Program insights and application pipeline analytics</p>
        </div>
        <div className="relative">
          <select value={programId} onChange={e => setProgramId(e.target.value)}
            className="pl-4 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none font-medium text-slate-700 min-w-52">
            {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : !data ? (
          <div className="text-center py-32 text-slate-400">Select a program to view analytics</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Applications" value={totalApps} sub="across all statuses" color="blue" />
              <StatCard icon={TrendingUp} label="Avg TOPSIS Score" value={data.scoreStats._avg.composite_score ? Number(data.scoreStats._avg.composite_score).toFixed(1) : ''} sub="TOPSIS composite / 100" color="purple" />
              <StatCard icon={ShieldAlert} label="Anomaly Rate" value={`${anomalyRate}%`} sub={`${anomalyCount} flagged`} color="orange" />
              <StatCard icon={CheckCircle2} label="Approved" value={approvedCount} sub={`of ${totalApps} applications`} color="emerald" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Avg Merit', value: data.scoreStats._avg.merit_score ? Number(data.scoreStats._avg.merit_score).toFixed(1) : '', sub: 'Academic score', cls: 'text-blue-700' },
                { label: 'Avg Need', value: data.scoreStats._avg.rule_need_score ? Number(data.scoreStats._avg.rule_need_score).toFixed(1) : '', sub: 'Financial need', cls: 'text-emerald-700' },
                { label: 'Max TOPSIS Score', value: data.scoreStats._max.composite_score ? Number(data.scoreStats._max.composite_score).toFixed(1) : '', sub: 'Highest ranked applicant', cls: 'text-purple-700' },
                { label: 'Min TOPSIS Score', value: data.scoreStats._min.composite_score != null ? Number(data.scoreStats._min.composite_score).toFixed(1) : '', sub: 'Lowest ranked applicant', cls: 'text-slate-700' },
              ].map(({ label, value, sub, cls }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
                  <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
                  <div className="text-sm font-semibold text-slate-700 mt-1">{label}</div>
                  <div className="text-xs text-slate-400">{sub}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Application Status Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-30} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Status Breakdown</h3>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-sm">Anomaly Detection Summary</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Applications Flagged', value: anomalyCount, cls: 'text-orange-700' },
                  { label: 'Anomaly Rate', value: `${anomalyRate}%`, cls: 'text-orange-700' },
                  { label: 'Avg Anomaly Score', value: data.anomalyStats._avg.anomaly_score != null ? Number(data.anomalyStats._avg.anomaly_score).toFixed(3) : '', cls: 'text-orange-700' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
                    <div className="text-sm text-slate-600 mt-1">{label}</div>
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
