import { updateStore, weekLabel, type Order, type Rejection, type Week } from './store'
import { effectiveProfile, isDue } from './subscriptions'
import { buildPlan, offersFor } from './plan'
import { formatGBP, inStock, SHOPS } from './shops'
import { checkProduct } from './rules'

// Public demo (freqpay.app has no browser agent and no `stripe listen`): run a week instantly with
// the same rules, stock-outs, optimiser and delivery terms the agent uses, then place the planned
// orders from the wallet. Receipts say it was placed instantly; the recorded demo shows the agent.
export async function simulateWeek(): Promise<Week> {
  return await updateStore((s) => {
    s.weekIndex += 1
    const index = s.weekIndex
    const runId = `sim_${Date.now().toString(36)}`
    const profile = effectiveProfile(s.profile, s.subscriptions, index)
    const week: Week = { index, label: weekLabel(index), runId, status: 'nothing-bought', includes: (s.subscriptions ?? []).filter((x) => isDue(x, index)).map((x) => x.name) }
    s.weeks.push(week)
    if (!profile.lines.length) { week.note = 'Nothing is due this week.'; return week }

    const cats = new Set<string>(profile.lines.map((l) => l.category))
    const rejected: Rejection[] = []
    for (const shop of SHOPS) for (const p of shop.products) {
      if (!cats.has(p.category)) continue
      const r = checkProduct(p, profile)
      const reasons = r.pass && !inStock(p.id, index) ? [`out of stock at ${shop.name} this week`] : r.reasons
      if (!r.pass || !inStock(p.id, index)) rejected.push({ id: p.id, name: `${p.name} (${shop.name})`, reasons })
    }
    week.rejected = rejected

    const plan = buildPlan(profile, offersFor(SHOPS.flatMap((x) => x.products.map((p) => p.id)), profile, index))
    Object.assign(week, { comparison: plan.comparison, total: plan.total, bestSingleShop: plan.bestSingleShop, savings: plan.savings })
    if (!plan.orders.length) { week.note = 'No mix of shops could supply the whole list this week.'; return week }
    if (plan.total > s.profile.budgetPence) { week.orders = plan.orders; week.note = `The cheapest plan is ${formatGBP(plan.total)}, over the ${formatGBP(s.profile.budgetPence)} weekly limit, so nothing was bought.`; return week }
    const wallet = s.wallet?.balancePence
    if (wallet !== undefined && plan.total > wallet) {
      week.orders = plan.orders.map((o) => ({ ...o, status: 'declined', declineReason: 'the agent wallet can’t cover it: top it up' }))
      week.note = `The agent wallet has ${formatGBP(wallet)}, not enough for this week’s ${formatGBP(plan.total)}. Top up to continue.`
      return week
    }
    week.orders = plan.orders.map((o, i) => {
      const order: Order = { id: `ord_demo_${Date.now().toString(36)}${i}`, shop: o.shop, weekIndex: index, items: o.items, subtotal: o.subtotal, delivery: o.delivery, total: o.total, status: 'approved', createdAt: Date.now() }
      s.orders.push(order)
      return { ...o, status: 'paid', orderId: order.id }
    })
    if (s.wallet) s.wallet.balancePence -= plan.total
    week.status = 'bought'
    const oos = rejected.filter((r) => r.reasons[0]?.startsWith('out of stock')).map((r) => r.name)
    week.note = `Ordered ${plan.orders.map((o) => `${o.shopName} ${formatGBP(o.total)}`).join(', ')}, delivery included${plan.savings ? `, saving ${formatGBP(plan.savings)} vs buying from one supermarket` : ''}.${oos.length ? ` Out of stock this week: ${oos.join(', ')}, so those came from elsewhere.` : ''}`
    return week
  })
}
