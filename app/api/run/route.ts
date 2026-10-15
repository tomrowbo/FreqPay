import { NextResponse } from 'next/server'

// Dashboard "Run next week now" -> the agent process.
export async function POST() {
  try {
    const r = await fetch('http://localhost:4100/run', { method: 'POST' })
    return NextResponse.json(await r.json(), { status: r.status })
  } catch {
    return NextResponse.json({ error: 'agent process not running (npm run agent)' }, { status: 503 })
  }
}
