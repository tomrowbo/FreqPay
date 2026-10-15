import type { Profile, RestockLine } from './rules'

// A subscription is a list of items delivered every N weeks. Each demo week the agent buys
// everything that's due as one shop, so one plan, one budget and the same card rules cover them all.
export type Frequency = 1 | 2 | 4
export const FREQUENCIES: { weeks: Frequency; label: string }[] = [
  { weeks: 1, label: 'Every week' },
  { weeks: 2, label: 'Every 2 weeks' },
  { weeks: 4, label: 'Every 4 weeks' },
]
export const frequencyLabel = (n: number) => FREQUENCIES.find((f) => f.weeks === n)?.label ?? `Every ${n} weeks`

export interface Subscription {
  id: string
  name: string
  everyWeeks: Frequency
  startWeek: number // first demo week it's delivered
  lines: RestockLine[]
  paused?: boolean
}

export const isDue = (s: Subscription, week: number) =>
  !s.paused && week >= s.startWeek && (week - s.startWeek) % s.everyWeeks === 0

// Everything due this week as one restock list: one line per item, shared items added up.
export function dueLines(subs: Subscription[], week: number): RestockLine[] {
  const out = new Map<string, RestockLine>()
  for (const s of subs.filter((x) => isDue(x, week))) {
    for (const l of s.lines) {
      const cur = out.get(l.id)
      out.set(l.id, cur ? { ...cur, qty: cur.qty + l.qty } : { ...l })
    }
  }
  return [...out.values()]
}

// The first week after `week` when it's delivered, or null if paused.
export function nextDue(s: Subscription, week: number): number | null {
  if (s.paused) return null
  if (week < s.startWeek) return s.startWeek
  return s.startWeek + (Math.floor((week - s.startWeek) / s.everyWeeks) + 1) * s.everyWeeks
}

// What the agent shops for in `week`. No subscriptions (the default list) = the profile as it is.
export function effectiveProfile(profile: Profile, subs: Subscription[] | undefined, week: number): Profile {
  return subs?.length ? { ...profile, lines: dueLines(subs, week) } : profile
}
