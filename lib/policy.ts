import { shopByName, formatGBP } from './shops'
import type { Order, SupplierOrder } from './store'

// Money policy run inside Stripe's real-time authorization webhook. The agent plans first; a
// charge is approved only if it is exactly a planned supplier order for this week.
export function decideAuthorization(input: {
  merchant: string
  amount: number
  budgetPence: number
  weekIndex: number
  orders: Order[] // shop-side order log (approved/declined)
  planned: SupplierOrder[] // this week's plan, from the agent's plan_order step
}) {
  const { merchant, amount } = input
  if (!shopByName(merchant)?.orderable) return { approved: false, reason: `merchant "${merchant}" is not an approved supplier` }
  const plan = input.planned.find((o) => o.shopName === merchant)
  if (!plan) return { approved: false, reason: `no order at ${merchant} in this week's plan` }
  if (amount !== plan.total) return { approved: false, reason: `${formatGBP(amount)} doesn't match the ${formatGBP(plan.total)} planned at ${merchant}` }
  const thisWeek = input.orders.filter((o) => o.weekIndex === input.weekIndex && o.status === 'approved')
  if (thisWeek.some((o) => o.shop === plan.shop)) return { approved: false, reason: `${merchant} has already been paid this week` }
  const spent = thisWeek.reduce((n, o) => n + o.total, 0)
  if (spent + amount > input.budgetPence) return { approved: false, reason: `would take this week to ${formatGBP(spent + amount)}, over the ${formatGBP(input.budgetPence)} budget` }
  return { approved: true, reason: `matches the plan: ${formatGBP(amount)} at ${merchant}` }
}
