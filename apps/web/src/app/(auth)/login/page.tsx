'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GraduationCap, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

const ROLE_REDIRECTS: Record<string, string> = {
  student:     '/app/dashboard',
  verifier:    '/verifier/dashboard',
  super_admin: '/admin/applications',
}

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/proxy/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid credentials. Please try again.'); return }
      router.push(ROLE_REDIRECTS[data.user.role] || '/app/dashboard')
    } catch { setError('Network error. Please try again.')
    } finally  { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Top utility bar */}
      <div className="bg-blue-950 text-blue-200 text-xs py-1.5 px-6 flex justify-between">
<<<<<<< HEAD
        <span>Merit-cum-Need Scholarship Programme 2025-26</span>
=======
        <span>Merit-cum-Need Scholarship Programme 202526</span>
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
        <span>Helpline: <strong className="text-white">1800-123-4567</strong></span>
      </div>

      {/* Page header */}
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-white/10 border border-white/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide">Merit-cum-Need Scholarship</div>
<<<<<<< HEAD
              <div className="text-blue-300 text-[10px] tracking-wider uppercase">Student & Staff Login Portal  2025-26</div>
=======
              <div className="text-blue-300 text-[10px] tracking-wider uppercase">Student & Staff Login Portal  202526</div>
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
            </div>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-blue-300 hover:text-white text-xs font-medium transition-colors border border-blue-700 hover:border-blue-400 px-3 py-1.5 rounded">
            ← Back to Home
          </Link>
        </div>
      </header>

      <div className="flex-1 flex">

        {/* Left info panel */}
        <div className="hidden lg:flex lg:w-5/12 bg-blue-900 flex-col justify-between p-12 text-white border-r border-blue-800">
          <div>
            <h2 className="text-2xl font-bold text-white mb-3 leading-snug">
              Supporting Deserving<br />Undergraduate Students
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-8">
              Scholarships of up to 75,000 are awarded annually to meritorious
              undergraduate students from economically weaker sections at recognised institutions.
            </p>
            <div className="space-y-3">
              {[
                'Open to all UG programmes at recognised institutions',
                'Based on academic merit (35%) and financial need (65%)',
                'Annual household income below 8,00,000',
                'Field verification for shortlisted applicants',
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-sm text-blue-100">
                  <CheckCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-blue-700 pt-4 space-y-1 text-xs text-blue-400">
            <p>Results declared after verification is complete.</p>
          </div>
        </div>

        {/* Right login panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 bg-gray-100">
          <div className="w-full max-w-md">

            <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">

              {/* Card header */}
              <div className="bg-gray-100 border-b border-gray-300 px-6 py-3">
                <h1 className="text-base font-bold text-gray-800">Applicant / Staff Login</h1>
                <p className="text-xs text-gray-500 mt-0.5">Enter your registered email address and password</p>
              </div>

              <div className="px-6 py-6">
                {error && (
                  <div className="flex items-center gap-2.5 p-3 mb-5 bg-red-50 border border-red-300 rounded text-red-800 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-600">*</span>
                    </label>
                    <input type="email" required autoComplete="email"
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Registered email address"
                      className="w-full px-3 py-2.5 border border-gray-400 rounded text-sm focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 bg-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2.5 pr-10 border border-gray-400 rounded text-sm focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 bg-white" />
                      <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading || !email || !password}
                    className="w-full py-2.5 mt-1 bg-blue-800 hover:bg-blue-900 disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold rounded transition-colors text-sm">
                    {loading ? 'Signing in' : 'Sign In to Portal'}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-gray-200 text-center space-y-2">
                  <p className="text-sm text-gray-600">
                    New applicant?{' '}
                    <Link href="/register" className="text-blue-800 font-bold hover:underline">Create an account</Link>
                  </p>
                  <p className="text-xs text-gray-400">Staff and verifier accounts are created by administrators only.</p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-5">
              For login issues, contact:{' '}
              <a href="mailto:scholarship@trust.org" className="text-blue-700 hover:underline">scholarship@trust.org</a>
              {' '}or call <strong>1800-123-4567</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-300 py-3 px-6 text-center text-xs text-gray-400">
<<<<<<< HEAD
        Merit-cum-Need Scholarship Programme 2025-26 &nbsp;|&nbsp; All rights reserved
=======
        Merit-cum-Need Scholarship Programme 202526 &nbsp;|&nbsp; All rights reserved
>>>>>>> 723a05af3c40b1ee64fb8321883f8415d77a7b27
      </footer>
    </div>
  )
}
