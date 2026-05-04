'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { GraduationCap, LayoutDashboard, FileText, Upload, ClipboardList, LogOut, Menu, X } from 'lucide-react'

const SCORE_VISIBLE_STATUSES = new Set([
  'scored', 'verification_pending', 'verification_complete',
  'approved', 'waitlisted', 'rejected',
])

const BASE_NAV = [
  { href: '/app/dashboard', label: 'My Application', icon: LayoutDashboard },
  { href: '/app/apply',     label: 'Apply',           icon: FileText },
  { href: '/app/documents', label: 'Documents',       icon: Upload },
]

export default function StudentNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [showScoreCard, setShowScoreCard] = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)

  useEffect(() => {
    fetch('/api/proxy/applications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const apps: { status: string }[] = d.applications || []
        if (apps.some(a => SCORE_VISIBLE_STATUSES.has(a.status))) setShowScoreCard(true)
      })
      .catch(() => {})
  }, [])

  async function logout() {
    await fetch('/api/proxy/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  const nav = showScoreCard
    ? [...BASE_NAV, { href: '/app/status', label: 'Score Card', icon: ClipboardList }]
    : BASE_NAV

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Top utility bar */}
      <div className="bg-blue-950 text-blue-200 text-xs py-1.5 px-4 hidden sm:block">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <span>Merit-cum-Need Scholarship Programme 2025-26 &nbsp;|&nbsp; Last date to apply: 31 July 2025</span>
          <span>Helpline: <strong className="text-white">1800-123-4567</strong> (Mon-Sat, 9 AM - 6 PM)</span>
        </div>
      </div>

      {/* Main header */}
      <header className="bg-blue-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">

            {/* Brand */}
            <Link href="/app/dashboard" className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded bg-white/10 border border-white/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="text-sm font-bold tracking-wide">Merit-cum-Need Scholarship</div>
                <div className="text-blue-300 text-[10px] tracking-wider uppercase">Student Portal  2025-26</div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center border-l border-white/10 ml-4 pl-4 gap-0.5">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap border-b-2
                      ${active
                        ? 'border-yellow-400 text-white bg-white/10'
                        : 'border-transparent text-blue-200 hover:text-white hover:bg-white/10'}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-2">
              {/* Sign out  desktop */}
              <button onClick={logout}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:text-white border border-blue-600 hover:border-blue-400 rounded transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
              {/* Hamburger  mobile */}
              <button onClick={() => setMenuOpen(v => !v)} className="md:hidden p-2 text-blue-200 hover:text-white">
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {menuOpen && (
            <div className="md:hidden border-t border-white/10 pb-3 pt-2 space-y-0.5">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors
                      ${active ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                    <Icon className="w-4 h-4" /> {label}
                  </Link>
                )
              })}
              <button onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-gray-300 bg-white py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500">
          <span>Merit-cum-Need Scholarship Programme 2025-26</span>
          <span>
            For queries: <strong className="text-gray-700">scholarship@trust.org</strong> &nbsp;|&nbsp;
            Helpline: <strong className="text-gray-700">1800-123-4567</strong> (Mon-Sat, 9 AM - 6 PM)
          </span>
        </div>
      </footer>
    </div>
  )
}
