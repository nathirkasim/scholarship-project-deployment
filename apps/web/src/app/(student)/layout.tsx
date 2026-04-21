'use client'

import StudentNav from '@/components/layout/StudentNav'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentNav>{children}</StudentNav>
}
