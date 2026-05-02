'use client'

import StaffSidebar from '@/components/layout/StaffSidebar'
import {
  ClipboardList, ShieldAlert, UserCheck2, CheckSquare2,
  BarChart3, FileDown, BookMarked, Users, BookOpen,
  Brain, Settings2
} from 'lucide-react'

const ADMIN_NAV = [
  {
    group: 'Operations',
    items: [
      { href: '/admin/applications', label: 'Applications',     icon: ClipboardList },
      { href: '/admin/verifiers',    label: 'Verification',     icon: UserCheck2 },
      { href: '/admin/decisions',    label: 'Decisions',        icon: CheckSquare2 },
      { href: '/admin/analytics',    label: 'Analytics',        icon: BarChart3 },
      { href: '/admin/reports',      label: 'Reports',          icon: FileDown },
    ],
  },
  {
    group: 'Administration',
    items: [
      { href: '/admin/programs',     label: 'Programs',        icon: BookMarked },
      { href: '/admin/users',        label: 'Users',           icon: Users },
      { href: '/admin/rules',        label: 'Rules',    icon: BookOpen },
      { href: '/admin/ml',           label: 'ML Config', icon: Brain },
      { href: '/admin/settings',     label: 'Settings',        icon: Settings2 },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffSidebar nav={ADMIN_NAV} role="Super Admin">
      {children}
    </StaffSidebar>
  )
}
