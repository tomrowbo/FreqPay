import Anthropic from '@anthropic-ai/sdk'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { checkProduct } from './rules'
import { findProduct, formatGBP, inStock, priceOf, SHOPS } from './shops'
import { buildPlan, offersFor } from './plan'
import { priceBasket } from './basket'
import { decideAuthorization } from './policy'
import { chargeToken, grantToken } from './spt'
import { effectiveProfile } from './subscriptions'
import { readStore, updateStore, weekLabel, type Order, type Rejection, type SupplierOrder, type Week } from './store'

// The agent in agentic-commerce mode (no browser): it reads each shop's product feed, checks every
// product against the rules, plans with the optimiser, and pays each shop through its checkout API
// with a Stripe Shared Payment Token minted for exactly that order. Runs inside the web server
// (a Vercel function), so it works on freqpay.app with nothing else running.
const SYSTEM = `You are the office's buyer. Each week you restock the office from its subscriptions, inside the office's rules. You run unattended: make the decisions yourself.

1. Call get_context for the list due this week, allergies, the weekly limit and the shops (with delivery terms).
2. For EVERY shop, call list_products, then call check_items with the ids of EVERY product it lists. Don't pre-filter: check_items applies the brand rules, allergies and stock.
3. Call plan_order. It finds the cheapest split across up to 3 shops, including pack sizes, minimum orders and delivery. Follow it exactly.
4. For each shop in the plan, call pay with that shop's name. FreqPay checks the payment against the plan and mints a Stripe shared payment token for exactly that amount; the shop charges the token.
5. If a payment fails, don't retry it; carry on and explain in your note.
6. Call finish with a short note to the office manager (2-3 sentences): what you bought where, what it saved, and anything out of stock or pricier this week.`

export async function runWeekApi(runId: string) {
  const s0 = (await readStore())
  const weekIndex = s0.weekIndex
  const profile = effectiveProfile(s0.profile, s0.subscriptions, weekIndex)
  const passed = new Set<string>()
  const rejected: Rejection[] = []
  let orders: SupplierOrder[] | null = null
  let finished = false
  const log = async (kind: 'step' | 'tool' | 'check' | 'decision' | 'pay' | 'error' | 'done', text: string) =>
    await updateStore((s) => { s.events.push({ runId, t: Date.now(), kind, text }); if (s.events.length > 2000) s.events.splice(0, s.events.length - 2000) })
  const update = async (fields: Partial<Week>) => await updateStore((s) => { const w = s.weeks.find((x) => x.runId === runId); if (w) Object.assign(w, fields) })
  const status = () => {
    const paid = orders?.filter((o) => o.status === 'paid').length ?? 0
    return orders && paid === orders.length ? 'bought' : paid > 0 ? 'partial' : 'nothing-bought'
  }

  if (!profile.lines.length) { await update({ status: 'nothing-bought', note: 'Nothing is due this week.' }); return }
  await log('step', `${weekLabel(weekIndex)}: agent woke up`)

  const tools = [
    betaZodTool({
      name: 'get_context', description: 'The list due this week, allergies, weekly limit and the shops you can buy from.', inputSchema: z.object({}),
      run: async () => {
        await log('tool', 'Reading the subscriptions, rules and shops')
        return JSON.stringify({
          office: profile.team, weeklyLimit: formatGBP(profile.budgetPence), allergies: profile.allergies,
          dueThisWeek: profile.lines.map((l) => ({ line: l.name, quantity: `${l.qty} ${l.unit}`, brand: l.brand ?? 'any brand' })),
          shops: SHOPS.map((x) => ({ name: x.name, type: x.kind, delivery: x.deliveryNote })),
        })
      },
    }),
    betaZodTool({
      name: 'list_products', description: "A shop's product feed for this week: ids, names, packs, prices and stock.", inputSchema: z.object({ shop: z.string() }),
      run: async ({ shop }) => {
        const sh = SHOPS.find((x) => x.name.toLowerCase() === shop.toLowerCase() || x.slug === shop.toLowerCase())
        if (!sh) return `No shop called ${shop}. Shops: ${SHOPS.map((x) => x.name).join(', ')}`
        await log('step', `Reading ${sh.name}'s product feed`)
        return JSON.stringify(sh.products.map((p) => ({ id: p.id, name: p.name, brand: p.brand, pack: p.packLabel, price: formatGBP(priceOf(p, weekIndex).price), inStock: inStock(p.id, weekIndex) })))
      },
    }),
    betaZodTool({
      name: 'check_items', description: 'Check products (by id) against the list, brand rules, allergies and stock. Only passed products can be planned.', inputSchema: z.object({ product_ids: z.array(z.string()) }),
      run: async ({ product_ids }) => {
        const out = []
        for (const id of product_ids) {
          const found = findProduct(id)
          if (!found) { out.push({ id, error: 'unknown product id' }); continue }
          const rules = checkProduct(found.product, profile)
          const r = rules.pass && !inStock(id, weekIndex) ? { ...rules, pass: false, reasons: [`out of stock at ${found.shop.name} this week`] } : rules
          if (r.pass) passed.add(id)
          else if (!rejected.some((x) => x.id === id)) rejected.push({ id, name: `${found.product.name} (${found.shop.name})`, reasons: r.reasons })
          if (!r.pass) log('check', `${found.shop.name}: ${found.product.name}: REJECTED — ${r.reasons.join('; ')}`)
          out.push({ id, pass: r.pass, reasons: r.reasons })
        }
        await update({ rejected })
        return JSON.stringify(out)
      },
    }),
    betaZodTool({
      name: 'plan_order', description: 'The cheapest way to buy everything due, across up to 3 shops, delivery included. Saves the plan.', inputSchema: z.object({}),
      run: async () => {
        if (orders?.some((o) => o.status !== 'planned')) return 'Payments have started; the plan can’t change now.'
        const plan = buildPlan(profile, offersFor([...passed], profile, weekIndex))
        if (plan.missing.length) return `No passed product yet for: ${plan.missing.join(', ')}. Check every shop's products and call plan_order again.`
        if (plan.total > profile.budgetPence) {
          await log('decision', `Cheapest plan is ${formatGBP(plan.total)}, over the ${formatGBP(profile.budgetPence)} limit: buying nothing this week`)
          return `Over the weekly limit. Don't buy anything: call finish and explain.`
        }
        orders = plan.orders
        await update({ orders, comparison: plan.comparison, total: plan.total, bestSingleShop: plan.bestSingleShop, savings: plan.savings })
        await log('decision', `Plan: ${plan.orders.map((o) => `${o.shopName} ${formatGBP(o.total)}`).join(' + ')} = ${formatGBP(plan.total)}${plan.savings ? `, saving ${formatGBP(plan.savings)} vs buying from one supermarket` : ''}`)
        return JSON.stringify({ total: formatGBP(plan.total), saving: plan.savings !== undefined ? formatGBP(plan.savings) : undefined, orders: plan.orders.map((o) => ({ shop: o.shopName, items: o.items.map((i) => `${i.packs} × ${i.name}`), delivery: o.delivery ? formatGBP(o.delivery) : 'free', total: formatGBP(o.total) })) })
      },
    }),
    betaZodTool({
      name: 'pay', description: "Pay one planned shop: FreqPay checks it against the plan, mints a shared payment token for exactly that amount, and the shop's checkout charges it.", inputSchema: z.object({ shop: z.string() }),
      run: async ({ shop }) => {
        if (!orders) return 'Call plan_order first.'
        const order = orders.find((o) => o.shopName.toLowerCase() === shop.toLowerCase() || o.shop === shop.toLowerCase())
        if (!order) return `${shop} isn't in the plan.`
        if (order.status !== 'planned') return `${order.shopName} is already ${order.status}.`
        const sh = SHOPS.find((x) => x.slug === order.shop)!
        // The shop prices its own basket; it must equal the plan.
        const b = priceBasket(sh, Object.fromEntries(order.items.map((i) => [i.id, i.packs ?? 1])), weekIndex)
        const s = (await readStore())
        const d = decideAuthorization({ merchant: sh.name, amount: order.total, budgetPence: s.profile.budgetPence, weekIndex, orders: s.orders, planned: orders, walletPence: s.wallet?.balancePence })
        const fail = async (reason: string) => {
          order.status = 'declined'; order.declineReason = reason
          await update({ orders: orders!, status: status() })
          await log('pay', `Declined at ${sh.name}: ${reason}`)
          return `Declined at ${sh.name}: ${reason}. Don't retry.`
        }
        if (!d.approved) return fail(d.reason)
        const t = await grantToken(order.total)
        if ('error' in t) return fail(t.error)
        await log('pay', `Minted a Stripe shared payment token for ${sh.name}, limited to ${formatGBP(order.total)} for 15 minutes`)
        const pi = await chargeToken(t.id, b.total, sh.name)
        if ('error' in pi) return fail(pi.error)
        const rec: Order = { id: `ord_${Date.now().toString(36)}`, shop: sh.slug, weekIndex, items: order.items, subtotal: b.subtotal, delivery: b.delivery, total: b.total, status: 'approved', authorizationId: pi.id, createdAt: Date.now() }
        await updateStore((st) => {
          st.orders.push(rec)
          st.auths.unshift({ id: pi.id, amount: b.total, merchant: sh.name, approved: true, reason: 'paid with agent token', policyReason: `${d.reason}; token ${t.id}`, t: Date.now() })
          if (st.wallet) st.wallet.balancePence -= b.total
        })
        order.status = 'paid'; order.orderId = rec.id; order.authorizationId = pi.id
        await update({ orders, ...(orders.every((o) => o.status === 'paid') ? { status: 'bought' as const } : {}) })
        await log('pay', `Paid ${formatGBP(b.total)} at ${sh.name}. Stripe payment ${pi.id}`)
        return `Paid ${formatGBP(b.total)} at ${sh.name}.`
      },
    }),
    betaZodTool({
      name: 'finish', description: "End this week's run with a short note to the office manager.", inputSchema: z.object({ note: z.string() }),
      run: async ({ note }) => { finished = true; await update({ note, status: status() }); await log('done', note); return 'Done. Stop now.' },
    }),
  ]

  const t0 = Date.now()
  try {
    await new Anthropic().beta.messages.toolRunner({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      max_iterations: 60,
      output_config: { effort: 'low' },
      system: SYSTEM,
      tools,
      messages: [{ role: 'user', content: `It's ${weekLabel(weekIndex)}. Do this week's restock.` }],
    })
    if (!finished) update({ status: status() })
  } catch (e) {
    await log('error', `Agent error: ${(e as Error).message}`)
    await update({ status: status() === 'nothing-bought' ? 'failed' : status() })
  }
  await log('step', `Run finished in ${Math.round((Date.now() - t0) / 1000)}s`)
}
