'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap, Eye, EyeOff, AlertCircle, CheckCircle2, Info } from 'lucide-react'

const inp = 'w-full px-3 py-2.5 border border-gray-400 rounded text-sm focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 bg-white'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' })
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const passwordOk    = form.password.length >= 8
  const passwordMatch = form.password === form.confirm && form.confirm.length > 0

  const strength = (() => {
    const p = form.password; let s = 0
    if (p.length >= 8)   s++
    if (p.length >= 12)  s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^a-zA-Z0-9]/.test(p)) s++
    return s
  })()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][Math.min(strength, 5)]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-amber-400', 'bg-green-500', 'bg-green-600'][Math.min(strength, 5)]

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordOk)    { setError('Password must be at least 8 characters.'); return }
    if (!passwordMatch) { setError('Passwords do not match.');                  return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/proxy/auth/register', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email, phone: form.phone, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration failed. Please try again.'); return }
      router.push('/app/dashboard')
    } catch { setError('Network error. Please try again.')
    } finally  { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Top utility bar */}
      <div className="bg-blue-950 text-blue-200 text-xs py-1.5 px-6 flex justify-between">
        <span>Merit-cum-Need Scholarship Programme 202526</span>
        <span>Helpline: <strong className="text-white">1800-123-4567</strong></span>
      </div>

      {/* Header */}
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-white/10 border border-white/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide">Merit-cum-Need Scholarship</div>
            <div className="text-blue-300 text-[10px] tracking-wider uppercase">New Applicant Registration  202526</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">

        {/* Left info panel */}
        <div className="hidden lg:flex lg:w-5/12 bg-blue-900 flex-col justify-between p-12 text-white border-r border-blue-800">
          <div>
            <h2 className="text-2xl font-bold mb-3 leading-snug">How to Apply</h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-8">
              Create a free account and complete the online application.
              You can save your progress at any step and return later.
            </p>
            <ol className="space-y-5">
              {[
                ['Create Account',    'Register with your name, email and mobile number'],
                ['Fill Application',  'Complete all 9 sections including personal, academic, family and financial details'],
                ['Upload Documents',  'Aadhaar, income certificate, marksheets, bank passbook and other supporting proofs'],
                ['Submit & Track',    'Submit your application and track your status online'],
              ].map(([label, sub], i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-yellow-400 text-blue-900 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="text-xs text-blue-300 mt-0.5">{sub}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="border-t border-blue-700 pt-4 text-xs text-blue-400 space-y-1">
            <p>Results declared after verification is complete.</p>
          </div>
        </div>

        {/* Right registration form */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 bg-gray-100 overflow-y-auto">
          <div className="w-full max-w-md">

            <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">

              <div className="bg-gray-100 border-b border-gray-300 px-6 py-3">
                <h1 className="text-base font-bold text-gray-800">Create Applicant Account</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Already registered?{' '}
                  <Link href="/login" className="text-blue-800 font-semibold hover:underline">Sign in here</Link>
                </p>
              </div>

              <div className="px-6 py-6">

                {error && (
                  <div className="flex items-center gap-2.5 p-3 mb-5 bg-red-50 border border-red-300 rounded text-red-800 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-5 flex items-start gap-2 text-xs text-amber-800">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Use your <strong>full name as per Aadhaar</strong> and a valid email address. These details cannot be changed after registration.</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name (as per Aadhaar) <span className="text-red-600">*</span>
                    </label>
                    <input type="text" required autoComplete="name"
                      placeholder="Enter full legal name"
                      value={form.full_name} onChange={set('full_name')}
                      className={inp} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-600">*</span>
                    </label>
                    <input type="email" required autoComplete="email"
                      placeholder="Active email address"
                      value={form.email} onChange={set('email')}
                      className={inp} />
                    <p className="text-xs text-gray-500 mt-0.5">All correspondence will be sent to this email</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input type="tel" autoComplete="tel"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      value={form.phone} onChange={set('phone')}
                      className={inp} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} required autoComplete="new-password"
                        placeholder="Minimum 8 characters"
                        value={form.password} onChange={set('password')}
                        className={`${inp} pr-10`} />
                      <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {form.password.length > 0 && (
                      <div className="mt-1.5">
                        <div className="flex gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? strengthColor : 'bg-gray-200'}`} />
                          ))}
                        </div>
                        <p className={`text-xs ${strength >= 3 ? 'text-green-700' : 'text-gray-400'}`}>
                          Password strength: {strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password <span className="text-red-600">*</span>
                    </label>
                    <input type="password" required autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={form.confirm} onChange={set('confirm')}
                      className={inp} />
                    {form.confirm.length > 0 && (
                      <div className={`flex items-center gap-1.5 mt-1 text-xs ${passwordMatch ? 'text-green-700' : 'text-red-600'}`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {passwordMatch ? 'Passwords match' : 'Passwords do not match'}
                      </div>
                    )}
                  </div>

                  <button type="submit"
                    disabled={loading || !form.full_name || !form.email || !passwordOk || !passwordMatch}
                    className="w-full py-2.5 mt-1 bg-blue-800 hover:bg-blue-900 disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold rounded transition-colors text-sm">
                    {loading ? 'Creating Account' : 'Create Account & Continue'}
                  </button>
                </form>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              For assistance: <a href="mailto:scholarship@trust.org" className="text-blue-700 hover:underline">scholarship@trust.org</a>
              {' '}| <strong>1800-123-4567</strong>
            </p>
          </div>
        </div>
      </div>

      <footer className="bg-white border-t border-gray-300 py-3 px-6 text-center text-xs text-gray-400">
        Merit-cum-Need Scholarship Programme 202526 &nbsp;|&nbsp; All rights reserved
      </footer>
    </div>
  )
}
