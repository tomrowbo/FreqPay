import { NextResponse, type NextRequest } from 'next/server'
import { updateStore } from '@/lib/store'
import { FREQUENCIES, type Frequency } from '@/lib/subscriptions'
import type { Profile, RestockLine } from '@/lib/rules'

const freq = (n: unknown): Frequency => (FREQUENCIES.some((f) => f.weeks === Number(n)) ? (Number(n) as Frequency) : 1)

// add: {name, everyWeeks, lines, profile?}: the first subscription also saves the team, budget and
// allergies and turns the agent on. update: {id, name?, everyWeeks?, paused?, qtys?}. remove: {id}.
export async function POST(req: NextRequest) {
  const b = await req.json()
  const out = updateStore((s) => {
    const subs = (s.subscriptions ??= [])
    if (b.action === 'add') {
      const lines = (b.lines as RestockLine[]).filter((l) => l.qty > 0)
      if (!lines.length) return { error: 'This subscription has no items' }
      if (!subs.length && b.profile) {
        const p = b.profile as Profile
        s.profile = { ...s.profile, team: p.team, budgetPence: p.budgetPence, allergies: p.allergies }
      }
      subs.push({ id: `sub_${Date.now().toString(36)}`, name: String(b.name || 'Office restock').slice(0, 60), everyWeeks: freq(b.everyWeeks), startWeek: s.weekIndex + 1, lines })
      s.profile.confirmed = true
      s.profile.lines = lines // kept for older views; the agent uses the subscriptions
      return { ok: true }
    }
    const sub = subs.find((x) => x.id === b.id)
    if (!sub) return { error: 'No such subscription' }
    if (b.action === 'remove') {
      s.subscriptions = subs.filter((x) => x.id !== b.id)
      if (!s.subscriptions.length) s.profile.confirmed = false
      return { ok: true }
    }
    if (b.action === 'update') {
      if (typeof b.name === 'string' && b.name.trim()) sub.name = b.name.trim().slice(0, 60)
      if (b.everyWeeks !== undefined) {
        sub.everyWeeks = freq(b.everyWeeks)
        sub.startWeek = s.weekIndex + 1 // a new rhythm starts with the next delivery
      }
      if (typeof b.paused === 'boolean') sub.paused = b.paused
      if (b.qtys && typeof b.qtys === 'object') {
        for (const l of sub.lines) if (Number(b.qtys[l.id]) >= 0) l.qty = Number(b.qtys[l.id])
        sub.lines = sub.lines.filter((l) => l.qty > 0)
      }
      return { ok: true }
    }
    return { error: 'Unknown action' }
  })
  return NextResponse.json(out, { status: 'error' in out ? 400 : 200 })
}
