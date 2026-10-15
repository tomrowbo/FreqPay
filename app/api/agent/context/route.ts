import { NextResponse } from 'next/server'
import { readStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export function GET() {
  const s = readStore()
  const history = s.weeks.filter((m) => m.orders?.length).map((m) => ({ week: m.label, total: m.total, savings: m.savings, suppliers: m.orders!.map((o) => o.shopName) }))
  return NextResponse.json({ profile: s.profile, weekIndex: s.weekIndex, history })
}
