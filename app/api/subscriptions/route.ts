import { NextResponse, type NextRequest } from 'next/server'
import { updateStore } from '@/lib/store'
import { dueLines, FREQUENCIES, reanchor, type Frequency, type Subscription } from '@/lib/subscriptions'
import { previewPlan } from '@/lib/onboard'
import { weekLabel } from '@/lib/week'
import type { Profile, RestockLine } from '@/lib/rules'

const freq = (n: unknown): Frequency => (FREQUENCIES.some((f) => f.weeks === Number(n)) ? (Number(n) as Frequency) : 1)

// add: {name, everyWeeks, lines, profile?}: the first subscription also saves the team, budget and
// allergies and turns the agent on. update: {id, name?, everyWeeks?, paused?, qtys?}. remove: {id}.
export async function POST(req: NextRequest) {
  const b = await req.json()
  const out = await updateStore((s) => {
    const subs = (s.subscriptions ??= [])
    if (b.action === 'add') {
      const lines = (b.lines as RestockLine[]).filter((l) => l.qty > 0)
      if (!lines.length) return { error: 'This subscription has no items' }
      if (!s.profile.confirmed && b.profile) { // a brand-new account: the draft sets team, budget and allergies
        const p = b.profile as Profile
        s.profile = { ...s.profile, team: p.team, budgetPence: p.budgetPence, allergies: p.allergies, address: typeof b.address === 'string' ? b.address.trim().slice(0, 200) : s.profile.address }
      }
      const sub: Subscription = { id: `sub_${Date.now().toString(36)}`, name: String(b.name || 'Office restock').slice(0, 60), everyWeeks: freq(b.everyWeeks), startWeek: s.weekIndex + 1, lines }
      // Each list can fit the budget alone and still go over it in a week when they're all due.
      for (let w = s.weekIndex + 1; w <= s.weekIndex + 4; w++) {
        const plan = previewPlan({ ...s.profile, lines: dueLines([...subs, sub], w) }, w)
        if (plan.total > s.profile.budgetPence) return { error: `In ${weekLabel(w)}, when everything is due, the shop would be £${(plan.total / 100).toFixed(2)}, over the £${(s.profile.budgetPence / 100).toFixed(2)} weekly budget. Lower some quantities or raise the budget.` }
      }
      subs.push(sub)
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
        const every = freq(b.everyWeeks)
        sub.startWeek = reanchor(sub, s.weekIndex, every)
        sub.everyWeeks = every
      }
      if (typeof b.paused === 'boolean') sub.paused = b.paused
      if (b.qtys && typeof b.qtys === 'object') {
        for (const l of sub.lines) {
          const q = b.qtys[l.id]
          if (typeof q === 'number' && Number.isFinite(q) && q >= 0) l.qty = q // 0 removes the item; anything else is ignored
        }
        sub.lines = sub.lines.filter((l) => l.qty > 0)
      }
      return { ok: true }
    }
    return { error: 'Unknown action' }
  })
  return NextResponse.json(out, { status: 'error' in out ? 400 : 200 })
}
