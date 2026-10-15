import { planOrder, type Offer } from './optimise'
import { checkProduct, type Profile } from './rules'
import { findProduct, ORDERABLE, priceOf, SHOPS } from './shops'
import type { Comparison, SupplierOrder } from './store'

// Products the agent found (by id) -> offers the planner may use. Only products that pass the
// rules become offers; the price is the shop's price this week, never a number the model typed.
export function offersFor(productIds: string[], profile: Profile, weekIndex: number): Offer[] {
  const offers: Offer[] = []
  for (const id of new Set(productIds)) {
    const found = findProduct(id)
    if (!found) continue
    const r = checkProduct(found.product, profile)
    if (!r.pass || !r.lineId) continue
    offers.push({ lineId: r.lineId, shop: found.shop.slug, productId: id, name: found.product.name, packSize: found.product.packSize, price: priceOf(found.product, weekIndex).price })
  }
  return offers
}

// Each supplier order is one card charge, so it must fit the Issuing card's per-charge limit.
export const CARD_LIMIT_PENCE = 30000
// Deliveries per cycle: more boxes to receive costs office time, so the planner never splits wider.
export const MAX_DELIVERIES = 3
// The "what you'd do anyway" yardstick: one supermarket for everything it stocks, Viking for the rest.
export const YARDSTICK_FALLBACK = 'viking'

export interface WeekPlan {
  orders: SupplierOrder[]
  total: number
  bestSingleShop?: { shop: string; total: number }
  savings?: number
  comparison: Comparison[]
  missing: string[]
}

export function buildPlan(profile: Profile, offers: Offer[]): WeekPlan {
  profile = { ...profile, lines: profile.lines.filter((l) => l.qty > 0) } // a 0 line means "skip this week"
  const terms = Object.fromEntries(ORDERABLE.map((s) => [s.slug, s.delivery])) // in-store-only shops are compared, never ordered from
  const r = planOrder(profile.lines, offers, terms, { maxOrder: CARD_LIMIT_PENCE, maxShops: MAX_DELIVERIES, fallback: YARDSTICK_FALLBACK })
  const orders: SupplierOrder[] = (r.best?.orders ?? []).map((o) => ({
    shop: o.shop,
    shopName: SHOPS.find((s) => s.slug === o.shop)!.name,
    items: o.items.map((i) => ({ id: i.productId, name: i.name, price: i.packPrice, packs: i.packs })),
    subtotal: o.subtotal,
    delivery: o.delivery,
    total: o.total,
    status: 'planned',
  }))
  const chosen = new Map(orders.flatMap((o) => o.items.map((i) => [i.id, o.shop] as const)))
  const comparison: Comparison[] = profile.lines.map((l) => {
    const perShop: Comparison['perShop'] = {}
    for (const s of SHOPS) {
      const best = offers
        .filter((o) => o.lineId === l.id && o.shop === s.slug)
        .map((o) => ({ cost: Math.ceil(l.qty / o.packSize) * o.price, product: o.name }))
        .sort((a, b) => a.cost - b.cost)[0]
      perShop[s.slug] = best ?? null
    }
    const chosenOffer = offers.find((o) => o.lineId === l.id && chosen.has(o.productId))
    return { lineId: l.id, line: `${l.qty} ${l.unit} · ${l.name}`, perShop, chosenShop: chosenOffer?.shop ?? '' }
  })
  // Only claim a saving when the split really beats one supplier (it can cost slightly more when
  // the card's per-charge cap forces a split).
  const single = r.bestSingleShop && r.best && r.bestSingleShop.total > r.best.total ? r.bestSingleShop : null
  return {
    orders,
    total: r.best?.total ?? 0,
    bestSingleShop: single ? { shop: single.orders[0].shop, total: single.total } : undefined,
    savings: single && r.best ? single.total - r.best.total : undefined,
    comparison,
    missing: r.missing,
  }
}
