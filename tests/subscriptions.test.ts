import { describe, expect, it } from 'vitest'
import { dueLines, effectiveProfile, isDue, nextDue, type Subscription } from '../lib/subscriptions'
import { DEFAULT_PROFILE } from '../lib/store'

const line = (id: string, qty: number) => ({ id, name: id, category: id as never, qty, unit: 'x' })
const kitchen: Subscription = { id: 'a', name: 'Kitchen', everyWeeks: 1, startWeek: 1, lines: [line('bananas', 60), line('tea-bags', 600)] }
const cleaning: Subscription = { id: 'b', name: 'Cleaning', everyWeeks: 2, startWeek: 1, lines: [line('toilet-roll', 96), line('bananas', 12)] }

describe('subscriptions', () => {
  it('a fortnightly subscription is due every other week from its start', () => {
    expect([1, 2, 3, 4, 5].map((w) => isDue(cleaning, w))).toEqual([true, false, true, false, true])
    expect(isDue({ ...cleaning, startWeek: 3 }, 1)).toBe(false)
  })
  it('a paused subscription is never due', () => {
    expect(isDue({ ...kitchen, paused: true }, 1)).toBe(false)
  })
  it('merges what is due into one list, adding up shared items', () => {
    expect(dueLines([kitchen, cleaning], 1).map((l) => [l.id, l.qty])).toEqual([['bananas', 72], ['tea-bags', 600], ['toilet-roll', 96]])
    expect(dueLines([kitchen, cleaning], 2).map((l) => [l.id, l.qty])).toEqual([['bananas', 60], ['tea-bags', 600]])
  })
  it('next delivery is the next due week after the current one', () => {
    expect(nextDue(cleaning, 1)).toBe(3)
    expect(nextDue(cleaning, 2)).toBe(3)
    expect(nextDue({ ...cleaning, startWeek: 6 }, 2)).toBe(6)
    expect(nextDue({ ...cleaning, paused: true }, 2)).toBeNull()
  })
  it('without subscriptions the profile is used as it is (deterministic replay)', () => {
    expect(effectiveProfile(DEFAULT_PROFILE, undefined, 1).lines).toHaveLength(22)
    expect(effectiveProfile(DEFAULT_PROFILE, [kitchen, cleaning], 2).lines.map((l) => l.id)).toEqual(['bananas', 'tea-bags'])
  })
})
