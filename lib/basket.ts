import { cookies } from 'next/headers'
import { deliveryFor, minimumOrder } from './optimise'
import { priceOf, type Product, type Shop } from './shops'
import { readStore } from './store'

// Basket = {productId: packs} in a cookie. Cookies are per host, so each shop has its own basket.
export interface BasketLine { product: Product; qty: number; price: number; was?: number; label?: string; cost: number }

export function parseBasket(raw: string | undefined): Record<string, number> {
  try {
    const v = raw ? JSON.parse(raw) : {}
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

// Prices are this demo week's (promotions change week to week).
export function priceBasket(shop: Shop, qtys: Record<string, number>, weekIndex: number) {
  const lines: BasketLine[] = []
  for (const [id, qty] of Object.entries(qtys)) {
    const product = shop.products.find((p) => p.id === id)
    if (!product || !(qty > 0)) continue
    const pr = priceOf(product, weekIndex)
    lines.push({ product, qty, ...pr, cost: pr.price * qty })
  }
  const subtotal = lines.reduce((n, l) => n + l.cost, 0)
  // Same delivery tiers the planner uses, so a basket that matches the plan costs exactly the plan.
  const fee = subtotal === 0 ? 0 : deliveryFor(shop.delivery, subtotal)
  const delivery = fee ?? 0
  return { lines, subtotal, delivery, total: subtotal + delivery, belowMinimum: subtotal > 0 && fee === null, minimum: minimumOrder(shop.delivery), count: lines.reduce((n, l) => n + l.qty, 0) }
}

export async function readBasket(shop: Shop) {
  return priceBasket(shop, parseBasket((await cookies()).get('basket')?.value), (await readStore()).weekIndex)
}
