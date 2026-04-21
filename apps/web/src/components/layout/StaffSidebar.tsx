'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GraduationCap, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

interface NavItem  { href: string; label: string; icon: React.ElementType; badge?: number }
interface NavGroup { group: string; items: NavItem[] }

interface Props {
  nav: NavItem[] | NavGroup[]
  role: string
  children: React.ReactNode
}

function isGrouped(nav: NavItem[] | NavGroup[]): nav is NavGroup[] {
  return nav.length > 0 && 'group' in nav[0]
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link href={item.href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors
        ${active
          ? 'bg-blue-800 text-white'
          : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-yellow-300' : 'text-gray-400'}`} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

export default function StaffSidebar({ nav, role, children }: Props) {
  const pathname   = usePathname()
  const router     = useRouter()
  const [open, setOpen] = useState(false)

  async function logout() {
    await fetch('/api/proxy/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  const grouped = isGrouped(nav)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-8 h-8 rounded bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-xs leading-tight">Merit-cum-Need Scholarship</div>
            <div className="text-[10px] text-blue-300 mt-0.5 truncate tracking-wider uppercase">{role}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {grouped ? (
          (nav as NavGroup[]).map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4 pt-4 border-t border-white/10' : ''}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(item.href + '/')} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-0.5">
            {(nav as NavItem[]).map(item => (
              <NavLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(item.href + '/')} />
            ))}
          </div>
        )}
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/10 p-3 flex-shrink-0">
        <button onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-blue-950 flex-shrink-0 border-r border-white/5">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative z-10 w-56 bg-blue-950 shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between bg-blue-900 text-white px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            <span className="font-bold text-sm">Scholarship Portal</span>
          </div>
          <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded hover:bg-white/10 text-white">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <main className="flex-1 overflow-auto bg-gray-100">{children}</main>
      </div>
    </div>
  )
}
