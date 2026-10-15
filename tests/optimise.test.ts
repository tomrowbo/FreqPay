import { describe, expect, it } from 'vitest'
import { planOrder, type DeliveryTerms, type Line, type Offer } from '../lib/optimise'

// fee from `min`, free from `freeOver`
const T = (min: number, fee: number, freeOver?: number): DeliveryTerms => ({ tiers: [{ from: min, fee }, ...(freeOver ? [{ from: freeOver, fee: 0 }] : [])] })
const terms: Record<string, DeliveryTerms> = { super: T(2500, 450, 5000), bulk: T(4000, 999, 15000), office: T(0, 0) }
const L = (id: string, qty: number): Line => ({ id, name: id, qty, unit: 'unit' })
const O = (lineId: string, shop: string, price: number, packSize = 1, productId = `${shop}-${lineId}`): Offer => ({ lineId, shop, productId, name: productId, packSize, price })

describe('planOrder', () => {
  it('rounds up to whole packs', () => {
    const r = planOrder([L('cans', 30)], [O('cans', 'office', 900, 24)], terms)
    expect(r.best!.orders[0].items[0]).toMatchObject({ packs: 2, cost: 1800 })
  })

  it('splits across shops when the saving beats the extra delivery', () => {
    const lines = [L('coffee', 1), L('milk', 1)]
    const offers = [O('coffee', 'bulk', 4000), O('coffee', 'office', 6000), O('milk', 'office', 200), O('milk', 'super', 150)]
    // bulk coffee £40 (meets its £40 minimum) + £9.99 delivery + office milk £2 = £51.99 vs all-office £62
    const r = planOrder(lines, offers, terms)
    expect(r.best!.total).toBe(5199)
    expect(r.best!.orders.map((o) => o.shop).sort()).toEqual(['bulk', 'office'])
    expect(r.bestSingleShop!.total).toBe(6200)
  })

  it('does not split when delivery eats the saving', () => {
    const lines = [L('coffee', 1), L('milk', 1)]
    const offers = [O('coffee', 'bulk', 4200), O('coffee', 'office', 4500), O('milk', 'office', 200)]
    expect(planOrder(lines, offers, terms).best!.orders.map((o) => o.shop)).toEqual(['office'])
  })

  it('respects minimum order values', () => {
    // super is cheapest for tea but £10 is under its £25 minimum, so it can't be used alone for tea
    const r = planOrder([L('tea', 1), L('milk', 1)], [O('tea', 'super', 1000), O('tea', 'office', 1100), O('milk', 'office', 200)], terms)
    expect(r.best!.orders.map((o) => o.shop)).toEqual(['office'])
  })

  it('moves items to a shop to reach its free-delivery threshold when that is cheaper overall', () => {
    // super: £48 of goods + £4.50 delivery = £52.50. Adding the £2.10 milk (vs £2 at office) crosses £50 → free delivery
    const lines = [L('big', 1), L('milk', 1)]
    const offers = [O('big', 'super', 4800), O('big', 'office', 6000), O('milk', 'super', 210), O('milk', 'office', 200)]
    const r = planOrder(lines, offers, terms)
    expect(r.best!.orders).toHaveLength(1)
    expect(r.best!.orders[0]).toMatchObject({ shop: 'super', subtotal: 5010, delivery: 0 })
  })

  it('uses the cheapest offer per shop (e.g. own-brand vs branded)', () => {
    const offers = [O('tea', 'office', 600, 1, 'pg-tips'), O('tea', 'office', 350, 1, 'own-brand')]
    expect(planOrder([L('tea', 1)], offers, terms).best!.orders[0].items[0].productId).toBe('own-brand')
  })

  it('keeps every supplier order under the per-charge card limit', () => {
    // all-office would be one £120 charge; with a £100 cap it must split
    const lines = [L('a', 1), L('b', 1)]
    const offers = [O('a', 'office', 6000), O('b', 'office', 6000), O('a', 'bulk', 6100), O('b', 'super', 6100)]
    expect(planOrder(lines, offers, terms).best!.orders).toHaveLength(1)
    const capped = planOrder(lines, offers, terms, { maxOrder: 10000 }).best!
    expect(capped.orders.every((o) => o.total <= 10000)).toBe(true)
    expect(capped.orders).toHaveLength(2)
  })

  it('reports lines nobody sells', () => {
    const r = planOrder([L('tea', 1), L('unicorn', 1)], [O('tea', 'office', 100)], terms)
    expect(r.best).toBeNull()
    expect(r.missing).toEqual(['unicorn'])
  })

  it('takes a small basket for a surcharge when the shop allows it (Tesco-style)', () => {
    const t = { ...terms, tesco: { tiers: [{ from: 0, fee: 900 }, { from: 5000, fee: 400 }] } }
    const r = planOrder([L('tea', 1)], [O('tea', 'tesco', 1000), O('tea', 'office', 2000)], t)
    expect(r.best!.orders[0]).toMatchObject({ shop: 'tesco', subtotal: 1000, delivery: 900 })
  })

  it('never uses more shops than the delivery cap', () => {
    // each line is cheapest at a different shop; with maxShops 2 only two shops may be used
    const t = { a: T(0, 0), b: T(0, 0), c: T(0, 0) }
    const lines = [L('x', 1), L('y', 1), L('z', 1)]
    const offers = [O('x', 'a', 100), O('y', 'b', 100), O('z', 'c', 100), O('x', 'b', 150), O('y', 'a', 150), O('z', 'a', 150), O('z', 'b', 120)]
    expect(planOrder(lines, offers, t).best!.orders).toHaveLength(3)
    const capped = planOrder(lines, offers, t, { maxShops: 2 }).best!
    expect(capped.orders).toHaveLength(2)
    expect(capped.total).toBe(320) // x@a 100 + y@b 100 + z@b 120
  })

  it('ignores offers from shops it cannot order from (in-store only)', () => {
    const r = planOrder([L('tea', 1)], [O('tea', 'lidl', 50), O('tea', 'office', 300)], terms)
    expect(r.best!.orders[0].shop).toBe('office')
  })

  it('matches brute force on random problems', () => {
    let seed = 7
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n)
    const shops = ['s0', 's1', 's2', 's3']
    const t: Record<string, DeliveryTerms> = {
      s0: T(1500, 450, 4000),
      s1: { tiers: [{ from: 0, fee: 700 }, { from: 3000, fee: 300 }] },
      s2: T(0, 600, 2500),
      s3: { tiers: [{ from: 1000, fee: 550 }, { from: 2000, fee: 350 }, { from: 3500, fee: 200 }] },
    }
    for (let trial = 0; trial < 40; trial++) {
      const lines = Array.from({ length: 6 }, (_, i) => L(`l${i}`, 1 + rnd(30)))
      const offers = lines.flatMap((l) => shops.filter(() => rnd(4) > 0).map((s) => O(l.id, s, 100 + rnd(900), 1 + rnd(12))))
      const maxShops = 1 + rnd(3)
      const maxOrder = 2000 + rnd(6000)
      const got = planOrder(lines, offers, t, { maxShops, maxOrder }).best
      // brute force: every assignment of every offer
      const opts = lines.map((l) => offers.filter((o) => o.lineId === l.id))
      let want: number | null = null
      const go = (i: number, pick: Offer[]) => {
        if (i === lines.length) {
          const by = new Map<string, number>()
          pick.forEach((o, k) => by.set(o.shop, (by.get(o.shop) ?? 0) + Math.ceil(lines[k].qty / o.packSize) * o.price))
          if (by.size > maxShops) return
          let total = 0
          for (const [s, sub] of by) {
            const tier = t[s].tiers.filter((x) => sub >= x.from).at(-1)
            const d = tier ? tier.fee : null
            if (d === null || sub + d > maxOrder) return
            total += sub + d
          }
          if (want === null || total < want) want = total
          return
        }
        for (const o of opts[i]) go(i + 1, [...pick, o])
      }
      go(0, [])
      expect(got?.total ?? null).toBe(want)
      expect(planOrder(lines, offers, t, { maxShops, maxOrder }).exact).toBe(true)
    }
  })

  it('handles a weekly office list (22 lines x 8 shops) quickly', () => {
    const shops = ['tesco', 'sainsburys', 'asda', 'ocado', 'iceland', 'aldi', 'costco', 'viking']
    const t = Object.fromEntries(shops.map((s, i) => [s, T(2500 + i * 500, 300 + i * 50, 8000 + i * 1000)]))
    const lines = Array.from({ length: 22 }, (_, i) => L(`l${i}`, 1 + (i % 5)))
    const offers = lines.flatMap((l, i) => shops.map((s, j) => O(l.id, s, 300 + ((i * 37 + j * 53) % 400), 1 + (j % 3))))
    const t0 = Date.now()
    const r = planOrder(lines, offers, t, { maxShops: 3, maxOrder: 40000 })
    expect(r.best).not.toBeNull()
    expect(r.best!.orders.length).toBeLessThanOrEqual(3) // this synthetic catalogue is near-identical everywhere: worst case for pruning
    // ~3 s on an idle laptop; the limit only catches a hang (wall-clock, so it must survive a busy machine)
    expect(Date.now() - t0).toBeLessThan(60_000)
  }, 120_000)
})
