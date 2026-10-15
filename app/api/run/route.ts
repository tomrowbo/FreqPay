import { NextResponse } from 'next/server'
import { PUBLIC_DEMO } from '@/lib/demo'
import { readStore } from '@/lib/store'
import { simulateWeek } from '@/lib/simulate'

// Dashboard "Simulate next week" -> the agent process (local), or an instant week on the public demo.
export async function POST() {
  if (PUBLIC_DEMO) {
    if (!readStore().profile.confirmed) return NextResponse.json({ message: 'Set up a subscription first' })
    simulateWeek()
    return NextResponse.json({ started: true })
  }
  try {
    const r = await fetch('http://localhost:4100/run', { method: 'POST' })
    return NextResponse.json(await r.json(), { status: r.status })
  } catch {
    return NextResponse.json({ error: 'agent process not running (npm run agent)' }, { status: 503 })
  }
}
