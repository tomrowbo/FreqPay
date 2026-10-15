import { NextResponse, type NextRequest } from 'next/server'
import { weekLabel, updateStore, type Week } from '@/lib/store'
import { isDue } from '@/lib/subscriptions'

// action "start": advance the demo clock and open a new week. action "update": merge fields.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const week = await updateStore((s) => {
    if (body.action === 'start') {
      s.weekIndex += 1
      const includes = (s.subscriptions ?? []).filter((x) => isDue(x, s.weekIndex)).map((x) => x.name)
      const m: Week = { index: s.weekIndex, label: weekLabel(s.weekIndex), runId: body.runId, status: 'running', ...(s.subscriptions?.length ? { includes } : {}) }
      s.weeks.push(m)
      return m
    }
    const m = s.weeks.find((x) => x.runId === body.runId)!
    Object.assign(m, body.fields)
    return m
  })
  return NextResponse.json(week)
}
