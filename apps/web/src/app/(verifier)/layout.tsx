'use client'

import StaffSidebar from '@/components/layout/StaffSidebar'
import { LayoutDashboard, MapPin, History } from 'lucide-react'

const VERIFIER_NAV = [
  { href: '/verifier/dashboard', label: 'My Assignments', icon: LayoutDashboard },
  { href: '/verifier/history', label: 'Visit History', icon: History },
]

export default function VerifierLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffSidebar nav={VERIFIER_NAV} role="Field Verifier">
      {children}
    </StaffSidebar>
  )
}
