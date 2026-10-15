import { describe, expect, it } from 'vitest'
import { checkProduct } from '../lib/rules'
import { findProduct, inStock, SHOPS } from '../lib/shops'
import { DEFAULT_PROFILE } from '../lib/store'
import { buildPlan, CARD_LIMIT_PENCE, MAX_DELIVERIES, offersFor } from '../lib/plan'

const profile = DEFAULT_PROFILE
const p = (id: string) => findProduct(id)!.product
const allIds = SHOPS.flatMap((s) => s.products.map((x) => x.id))

describe('checkProduct', () => {
  it('matches a product to its restock line', () => {
    expect(checkProduct(p('ic-fanta-24'), profile)).toEqual({ pass: true, lineId: 'fanta', reasons: [] })
  })
  it('enforces brand-locked lines', () => {
    const r = checkProduct(p('ic-pepsi-max-24'), profile)
    expect(r.pass).toBe(false)
    expect(r.reasons[0]).toBe('the list asks for Coca-Cola only, this is Pepsi')
    expect(checkProduct(p('as-oat-1l'), profile).pass).toBe(false)
    expect(checkProduct(p('co-plenish-8'), profile).pass).toBe(false)
  })
  it('allows own-brand where the line has no brand', () => {
    expect(checkProduct(p('as-tea-240'), profile).pass).toBe(true)
    expect(checkProduct(p('ic-little-duck-24'), profile).pass).toBe(true)
  })
  it('rejects nuts: contains, may contain, and ingredients', () => {
    expect(checkProduct(p('as-snickers-9'), profile).reasons.join()).toContain('contains peanuts')
    expect(checkProduct(p('as-double-snap-8'), profile).reasons.join()).toContain('may contain peanuts')
    expect(checkProduct(p('ic-blue-riband-12'), profile).reasons.join()).toContain('may contain tree nuts')
    expect(checkProduct(p('oc-ms-cookies'), profile).pass).toBe(false)
    const fake = { ...p('as-dig-300'), contains: [], ingredients: 'wheat flour, crushed cashews' }
    expect(checkProduct(fake, profile).reasons.join()).toContain('ingredients mention cashew')
  })
  it('rejects things not on the list, with a hint for UHT milk', () => {
    expect(checkProduct(p('vk-a4-paper'), profile).reasons).toEqual(['not on the restock list'])
    expect(checkProduct(p('vk-uht-12'), profile).reasons[0]).toContain('fresh milk')
  })
})

describe('catalogue plans (what the demo will show)', () => {
  const plans = [1, 2, 3].map((w) => buildPlan(profile, offersFor(allIds, profile, w)))

  it('can buy every line every week, under the weekly budget', () => {
    for (const plan of plans) {
      expect(plan.missing).toEqual([])
      expect(plan.total).toBeGreaterThan(0)
      expect(plan.total).toBeLessThanOrEqual(profile.budgetPence)
    }
  })
  it('splits across shops (never more than 3 deliveries) and beats one supermarket + Viking every week', () => {
    for (const plan of plans) {
      expect(plan.orders.length).toBeGreaterThanOrEqual(2)
      expect(plan.orders.length).toBeLessThanOrEqual(MAX_DELIVERIES)
      expect(plan.savings).toBeGreaterThan(0)
    }
  })
  it('only lists shops that deliver to the office (no Lidl, no Aldi in London)', () => {
    expect(SHOPS.map((s) => s.slug)).toEqual(['tesco', 'sainsburys', 'asda', 'ocado', 'iceland', 'costco', 'viking'])
    expect(SHOPS.every((s) => s.orderable && s.delivery.tiers.length > 0)).toBe(true)
  })
  it('buys around stock-outs: Asda is out of Oatly in week 2, Iceland out of toilet roll in week 3', () => {
    expect(inStock('as-oatly-1l', 1)).toBe(true)
    expect(inStock('as-oatly-1l', 2)).toBe(false)
    const bought = (i: number) => plans[i].orders.flatMap((o) => o.items.map((x) => x.id))
    expect(bought(0)).toContain('as-oatly-1l')
    expect(bought(1)).not.toContain('as-oatly-1l')
    expect(plans[1].comparison.find((c) => c.lineId === 'oat-barista')!.chosenShop).not.toBe('')
    expect(bought(2)).not.toContain('ic-little-duck-24')
    expect(plans[2].comparison.find((c) => c.lineId === 'toilet-roll')!.chosenShop).not.toBe('')
  })
  it('re-plans as promotions change: no two weeks have the same split', () => {
    const shape = (i: number) => JSON.stringify(plans[i].orders.map((o) => [o.shop, o.items.map((x) => x.id).sort()]).sort())
    expect(new Set([0, 1, 2].map(shape)).size).toBe(3)
  })
  it('every single supplier charge fits the card limit', () => {
    for (const plan of plans) for (const o of plan.orders) expect(o.total).toBeLessThanOrEqual(CARD_LIMIT_PENCE)
  })
  it('skips lines set to 0 (otherwise the basket could never match the plan)', () => {
    const p0 = { ...profile, lines: profile.lines.map((l) => (l.id === 'bananas' ? { ...l, qty: 0 } : l)) }
    const plan = buildPlan(p0, offersFor(allIds, p0, 1))
    expect(plan.orders.flatMap((o) => o.items).some((i) => i.packs === 0)).toBe(false)
    expect(plan.comparison.some((c) => c.lineId === 'bananas')).toBe(false)
  })
  it('prints the plans', () => {
    plans.forEach((plan, i) => {
      console.log(`week ${i + 1}: total £${(plan.total / 100).toFixed(2)} vs single ${plan.bestSingleShop?.shop} £${((plan.bestSingleShop?.total ?? 0) / 100).toFixed(2)} saved £${((plan.savings ?? 0) / 100).toFixed(2)}`)
      for (const o of plan.orders) console.log(`  ${o.shop} £${(o.subtotal / 100).toFixed(2)} + ${(o.delivery / 100).toFixed(2)}: ${o.items.map((x) => `${x.packs}x ${x.id}`).join(', ')}`)
    })
  })
})
