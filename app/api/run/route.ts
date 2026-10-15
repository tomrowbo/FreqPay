import { NextResponse, after } from 'next/server'
import { readStore, updateStore, weekLabel, type Week } from '@/lib/store'
import { isDue } from '@/lib/subscriptions'
import { runWeekApi } from '@/lib/agentApi'
import { PUBLIC_DEMO } from '@/lib/demo'

let runs = { n: 0, since: Date.now() } // public demo: cap agent runs per server instance per hour

export const maxDuration = 300 // the agent runs after the response, inside this function

// "Simulate next week". AGENT_MODE=browser hands the week to the local Playwright agent process;
// otherwise (and always on Vercel) the agentic-commerce agent runs here: product feeds, checkout
// APIs and Stripe shared payment tokens, no browser.
export async function POST() {
  if (process.env.AGENT_MODE === 'browser') {
    try {
      const r = await fetch('http://localhost:4100/run', { method: 'POST' })
      return NextResponse.json(await r.json(), { status: r.status })
    } catch {
      return NextResponse.json({ error: 'agent process not running (npm run agent)' }, { status: 503 })
    }
  }
  if (PUBLIC_DEMO) {
    if (Date.now() - runs.since > 3_600_000) runs = { n: 0, since: Date.now() }
    if (++runs.n > 20) return NextResponse.json({ message: 'The demo agent is busy, try again in a few minutes.' })
  }
  const s = (await readStore())
  if (!s.profile.confirmed) return NextResponse.json({ message: 'Set up a subscription first' })
  if (s.agent.running) return NextResponse.json({ message: 'A run is already in progress' })
  const runId = `run_${Date.now().toString(36)}`
  await updateStore((st) => {
    st.weekIndex += 1
    const includes = (st.subscriptions ?? []).filter((x) => isDue(x, st.weekIndex)).map((x) => x.name)
    const w: Week = { index: st.weekIndex, label: weekLabel(st.weekIndex), runId, status: 'running', ...(st.subscriptions?.length ? { includes } : {}) }
    st.weeks.push(w)
    st.agent = { ...st.agent, running: true }
  })
  after(async () => {
    try { await runWeekApi(runId) } finally { await updateStore((st) => { st.agent = { ...st.agent, running: false } }) }
  })
  return NextResponse.json({ started: true })
}
