import { NextResponse } from 'next/server'
import { readStore } from '@/lib/store'
import { effectiveProfile } from '@/lib/subscriptions'

export const dynamic = 'force-dynamic'
export async function GET() {
  const s = (await readStore())
  const history = s.weeks.filter((m) => m.orders?.length).map((m) => ({ week: m.label, total: m.total, savings: m.savings, suppliers: m.orders!.map((o) => o.shopName) }))
  // The agent shops for what's due in the week that has just started.
  return NextResponse.json({ profile: effectiveProfile(s.profile, s.subscriptions, s.weekIndex), weekIndex: s.weekIndex, history })
}
