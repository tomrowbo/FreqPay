import { NextResponse, type NextRequest } from 'next/server'
import { updateStore, type RunEvent } from '@/lib/store'

export async function POST(req: NextRequest) {
  const e = (await req.json()) as RunEvent & { nextRunAt?: number; running?: boolean }
  await updateStore((s) => {
    if (e.text) s.events.push({ runId: e.runId, t: Date.now(), kind: e.kind, text: e.text })
    if (e.nextRunAt !== undefined) s.agent.nextRunAt = e.nextRunAt
    if (e.running !== undefined) s.agent.running = e.running
  })
  return NextResponse.json({ ok: true })
}
