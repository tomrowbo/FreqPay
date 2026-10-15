// Cheapest way to buy a restock list across several shops, delivery included. Deterministic code,
// not the model's arithmetic: the agent finds the offers by browsing, this decides the split.
//
// Exact branch-and-bound: every line can go to any shop that offers it (cheapest offer per line
// per shop). Lines are assigned one at a time, cheapest option first; a branch is cut as soon as
// the goods already chosen plus the cheapest possible price of every remaining line can't beat
// the best plan found (delivery is never negative, so that bound is safe). Each finished
// assignment is scored with pack rounding, each shop's delivery tiers (minimum order, small-basket
// charge, free delivery), the card's per-charge limit and the max number of deliveries.

export interface Line { id: string; name: string; qty: number; unit: string } // qty in units, e.g. 48 cans
export interface Offer { lineId: string; shop: string; productId: string; name: string; packSize: number; price: number } // price per pack, pence
// Delivery charge by basket size, the way UK grocers price it: e.g. Tesco £9.50 under £50 and
// £4.50 from £50; Iceland free from £40. tiers sorted by `from`; a basket below the first tier
// is refused (minimum order). Pence.
export interface DeliveryTerms { tiers: { from: number; fee: number }[] }

export interface PlannedItem { lineId: string; productId: string; name: string; packs: number; packPrice: number; cost: number }
export interface ShopOrder { shop: string; items: PlannedItem[]; subtotal: number; delivery: number; total: number }
export interface Plan { orders: ShopOrder[]; total: number }
export interface PlanResult {
  best: Plan | null
  bestSingleShop: Plan | null // the yardstick: what a sensible human ordering from one shop would pay (card cap not applied)
  singleShop: Record<string, Plan | null> // per shop (+ the fallback shop for lines it doesn't stock), null when it can't supply every line
  missing: string[] // lines nobody offers
  exact: boolean // false when the search budget ran out somewhere: the plan is valid but may not be the cheapest
}
// maxOrder: pence per charge. maxShops: deliveries per cycle. fallback: for the yardstick, the shop a
// person would top up from for lines their main shop doesn't stock (e.g. the office supplier).
export interface Limits { maxOrder?: number; maxShops?: number; fallback?: string }

const packsFor = (qty: number, packSize: number) => Math.ceil(qty / packSize)
const costOf = (l: Line, o: Offer) => packsFor(l.qty, o.packSize) * o.price
// How much a line loses if it can't go to its cheapest shop: lines that matter most are decided first.
const regret = (l: Line, opts: Offer[]) => (opts.length > 1 ? costOf(l, opts[1]) - costOf(l, opts[0]) : Infinity)
const NODE_BUDGET = 50_000 // per shop set: a safety net so a pathological catalogue can't hang a run; real lists finish far below it

function* subsets<T>(items: T[], maxSize: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length) yield acc
  if (acc.length === maxSize) return
  for (let i = start; i < items.length; i++) yield* subsets(items, maxSize, i + 1, [...acc, items[i]])
}

// Delivery for one shop's basket, or null when the shop won't take it.
export function deliveryFor(t: DeliveryTerms, subtotal: number): number | null {
  let fee: number | null = null
  for (const tier of t.tiers) if (subtotal >= tier.from) fee = tier.fee
  return fee
}
export const minimumOrder = (t: DeliveryTerms) => t.tiers[0]?.from ?? 0

function score(lines: Line[], choice: Offer[], terms: Record<string, DeliveryTerms>, maxOrder = Infinity): Plan | null {
  const byShop = new Map<string, PlannedItem[]>()
  choice.forEach((o, i) => {
    const packs = packsFor(lines[i].qty, o.packSize)
    const item = { lineId: o.lineId, productId: o.productId, name: o.name, packs, packPrice: o.price, cost: packs * o.price }
    byShop.set(o.shop, [...(byShop.get(o.shop) ?? []), item])
  })
  const orders: ShopOrder[] = []
  for (const [shop, items] of byShop) {
    const t = terms[shop]
    const subtotal = items.reduce((n, x) => n + x.cost, 0)
    const delivery = t ? deliveryFor(t, subtotal) : null
    if (delivery === null) return null
    if (subtotal + delivery > maxOrder) return null // one charge per supplier must fit the card's per-charge limit
    orders.push({ shop, items, subtotal, delivery, total: subtotal + delivery })
  }
  orders.sort((a, b) => b.total - a.total)
  return { orders, total: orders.reduce((n, o) => n + o.total, 0) }
}

// Cheaper total wins; on a tie, fewer deliveries (fewer boxes to receive).
const better = (a: Plan, b: Plan | null) => !b || a.total < b.total || (a.total === b.total && a.orders.length < b.orders.length)

export function planOrder(lines: Line[], offers: Offer[], terms: Record<string, DeliveryTerms>, limits: Limits = {}): PlanResult {
  const { maxOrder = Infinity, maxShops = Infinity, fallback } = limits
  // Cheapest offer per (line, shop): within one shop a cheaper equivalent is always at least as good.
  // Only shops we can order from (they have delivery terms) are options.
  const options: Offer[][] = lines.map((l) => {
    const perShop = new Map<string, Offer>()
    for (const o of offers.filter((x) => x.lineId === l.id && terms[x.shop])) {
      const cur = perShop.get(o.shop)
      if (!cur || costOf(l, o) < costOf(l, cur)) perShop.set(o.shop, o)
    }
    return [...perShop.values()].sort((a, b) => costOf(l, a) - costOf(l, b))
  })
  const missing = lines.filter((_, i) => options[i].length === 0).map((l) => l.name)
  const shops = [...new Set(options.flat().map((o) => o.shop))]
  const singleShop: Record<string, Plan | null> = {}
  for (const s of shops) {
    const only = options.map((opts) => opts.find((o) => o.shop === s) ?? opts.find((o) => o.shop === fallback))
    singleShop[s] = !missing.length && only.every(Boolean) ? score(lines, only as Offer[], terms) : null // the yardstick ignores the card cap
  }
  let bestSingleShop: Plan | null = null
  for (const p of Object.values(singleShop)) if (p && better(p, bestSingleShop)) bestSingleShop = p
  if (missing.length) return { best: null, bestSingleShop, singleShop, missing, exact: true }

  // Search each set of up to `maxShops` shops separately: inside a set every shop must get at least
  // one line, so each one's unavoidable delivery
  // (its cheapest tier) joins the bound, which is what makes the pruning bite.
  const order = lines.map((_, i) => i).sort((a, b) => regret(lines[b], options[b]) - regret(lines[a], options[a]))
  let best: Plan | null = null
  let exact = true
  for (const set of subsets(shops, Math.min(maxShops, shops.length))) {
    const inSet = new Set(set)
    const opts = order.map((i) => options[i].filter((o) => inSet.has(o.shop)))
    if (opts.some((o) => o.length === 0)) continue
    const minDelivery = set.reduce((n, s) => n + Math.min(...terms[s].tiers.map((x) => x.fee)), 0)
    const floor = new Array<number>(order.length + 1).fill(0)
    for (let k = order.length - 1; k >= 0; k--) floor[k] = floor[k + 1] + costOf(lines[order[k]], opts[k][0])
    const choice: Offer[] = new Array(lines.length)
    const used = new Map<string, number>()
    let nodes = 0
    let cut = false
    const walk = (k: number, goods: number) => {
      if (++nodes > NODE_BUDGET) { cut = true; return }
      if (best && goods + floor[k] + minDelivery > best.total) return
      if (set.length - used.size > order.length - k) return // not enough lines left to use every shop
      if (k === order.length) {
        const p = score(lines, choice, terms, maxOrder)
        if (p && better(p, best)) best = p
        return
      }
      const i = order[k]
      for (const o of opts[k]) {
        const n = used.get(o.shop) ?? 0
        choice[i] = o
        used.set(o.shop, n + 1)
        walk(k + 1, goods + costOf(lines[i], o))
        if (n === 0) used.delete(o.shop)
        else used.set(o.shop, n)
        if (cut) return
      }
    }
    walk(0, 0)
    if (cut) exact = false
  }
  return { best, bestSingleShop, singleShop, missing, exact }
}
