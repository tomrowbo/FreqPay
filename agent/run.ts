import Anthropic from '@anthropic-ai/sdk'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { openBrowser, readPage, clickRef, setField } from './browser'
import { checkProduct, type Profile } from '../lib/rules'
import { findProduct, formatGBP, inStock, priceOf, SHOPS, shopByHost, shopUrl } from '../lib/shops'
import { buildPlan, offersFor } from '../lib/plan'
import { getCardDetails } from '../lib/stripe'
import { weekLabel, type Rejection, type SupplierOrder } from '../lib/store'

const APP = 'http://localhost:3000'
const MODEL = 'claude-opus-5-5'
const RUN_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 420_000)

const client = new Anthropic()

async function post(path: string, body: unknown) {
  const r = await fetch(`${APP}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

interface Context {
  profile: Profile
  weekIndex: number
  history: { week: string; total?: number; savings?: number; suppliers: string[] }[]
}

const SYSTEM = `You are the office's buyer. Once a week you restock the office (kitchen, pantry and washrooms) from the restock list, paying with your own company card, inside the office's rules. You are running unattended: nobody will answer questions, so make the decisions yourself.

How to work:
1. Call get_context for the restock list, team allergies, budget and the suppliers (with their delivery terms).
2. Visit every supplier's product page (open_url on each supplier's url). Prices change week to week, so always look.
3. Call check_items once per supplier with the ids of EVERY product on its page. Don't pre-filter: check_items decides what fits the list, applies the brand rules and the team's allergies, and rejected products can't be bought.
4. Call plan_order. It works out the cheapest way to buy the whole list across up to 3 suppliers that deliver, including pack sizes, minimum orders and delivery charges. Follow its plan exactly: it is also what the card will approve, to the penny.
5. For each supplier in the plan: open its site, set each planned product's quantity field to the planned number of packs and click its Add/Update button, open the checkout page, and call pay_at_checkout. Do one supplier at a time. You never see or type the card number.
6. If a payment is declined, don't retry it with a different basket; carry on with the other suppliers and explain in your note.
7. Call finish with a short note to the office manager (2-3 sentences): what you bought where, what the split saved, and any price rise worth knowing about.

Be efficient: you have a limited number of steps. Don't re-read pages you've just read.`

export async function runWeek(runId: string, log: (kind: string, text: string) => Promise<void>) {
  const ctx = (await fetch(`${APP}/api/agent/context`).then((r) => r.json())) as Context
  if (!ctx.profile.lines.length) { // every subscription is paused or not due this week
    const note = 'Nothing is due this week, so there was nothing to buy.'
    await post('/api/agent/week', { action: 'update', runId, fields: { note, status: 'nothing-bought' } })
    await log('done', note)
    return
  }
  const passed = new Set<string>()
  const rejected: Rejection[] = []
  let orders: SupplierOrder[] | null = null
  let finished = false

  const { browser, page } = await openBrowser()
  // The model often batches several actions into one turn and the tool runner executes them in
  // parallel. Browser actions must run one at a time or they race each other's page loads.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn)
    queue = next.catch(() => {})
    return next
  }
  const update = (fields: object) => post('/api/agent/week', { action: 'update', runId, fields })

  const tools = [
    betaZodTool({
      name: 'get_context',
      description: 'Read the restock list, team allergies, weekly budget, past weeks and the suppliers you can buy from (with delivery terms).',
      inputSchema: z.object({}),
      run: async () => {
        await log('tool', 'Reading the restock list, rules and suppliers')
        return JSON.stringify({
          team: ctx.profile.team,
          weeklyBudget: formatGBP(ctx.profile.budgetPence),
          teamAllergies: ctx.profile.allergies,
          restockList: ctx.profile.lines.map((l) => ({ line: l.name, quantity: `${l.qty} ${l.unit}`, brand: l.brand ?? 'any brand (own-brand fine)' })),
          pastWeeks: ctx.history,
          suppliers: SHOPS.map((s) => ({ name: s.name, type: s.kind, url: shopUrl(s), canOrder: s.orderable, delivery: s.deliveryNote })),
        })
      },
    }),
    betaZodTool({
      name: 'open_url',
      description: 'Open a URL in the browser and return a snapshot of the page.',
      inputSchema: z.object({ url: z.string() }),
      run: ({ url }) => serial(async () => {
        await log('step', `Opening ${url}`)
        await page.goto(url)
        return readPage(page)
      }),
    }),
    betaZodTool({
      name: 'read_page',
      description: 'Get a text snapshot of the current page with numbered refs (e1, e2…) for links, buttons and fields.',
      inputSchema: z.object({}),
      run: () => serial(() => readPage(page)),
    }),
    betaZodTool({
      name: 'set_field',
      description: 'Type a value into a field (e.g. a quantity box) by its ref. Does not submit.',
      inputSchema: z.object({ ref: z.string(), value: z.string() }),
      run: ({ ref, value }) => serial(() => setField(page, ref, value)),
    }),
    betaZodTool({
      name: 'click',
      description: 'Click a link or button by its ref from a snapshot. Returns the new page snapshot.',
      inputSchema: z.object({ ref: z.string(), why: z.string().describe('a few words on why, shown to the office manager') }),
      run: ({ ref, why }) => serial(async () => {
        await log('step', why)
        const r = await clickRef(page, ref)
        return `${r}\n\n${await readPage(page)}`
      }),
    }),
    betaZodTool({
      name: 'check_items',
      description: "Check products (by id) against the restock list, brand rules and the team's allergies. Only products that pass can be planned and bought.",
      inputSchema: z.object({ product_ids: z.array(z.string()) }),
      run: async ({ product_ids }) => {
        const out = []
        for (const id of product_ids) {
          const found = findProduct(id)
          if (!found) { out.push({ id, error: 'unknown product id' }); continue }
          const rules = checkProduct(found.product, ctx.profile)
          // A product that fits the rules but is out of stock this week can't be bought; the planner buys the line elsewhere.
          const r = rules.pass && !inStock(id, ctx.weekIndex) ? { ...rules, pass: false, reasons: [`out of stock at ${found.shop.name} this week`] } : rules
          const line = ctx.profile.lines.find((l) => l.id === r.lineId)
          if (r.pass) passed.add(id)
          else if (!rejected.some((x) => x.id === id)) rejected.push({ id, name: `${found.product.name} (${found.shop.name})`, reasons: r.reasons })
          await log('check', `${found.shop.name}: ${found.product.name}: ${r.pass ? `OK for “${line?.name}”` : 'REJECTED — ' + r.reasons.join('; ')}`)
          out.push({ id, product: found.product.name, supplier: found.shop.name, price: formatGBP(priceOf(found.product, ctx.weekIndex).price), pack: found.product.packLabel, pass: r.pass, forLine: line?.name, reasons: r.reasons })
        }
        await update({ rejected })
        return JSON.stringify(out)
      },
    }),
    betaZodTool({
      name: 'plan_order',
      description: 'Work out the cheapest way to buy the whole restock list from the products that passed check_items, across suppliers, including pack sizes, minimum orders and delivery. Saves the plan; the card will only approve charges that match it.',
      inputSchema: z.object({}),
      run: async () => {
        if (orders?.some((o) => o.status !== 'planned')) return 'You have already started paying for this week\'s plan; it can\'t change now.'
        const plan = buildPlan(ctx.profile, offersFor([...passed], ctx.profile, ctx.weekIndex))
        if (plan.missing.length) return `No passed product yet for: ${plan.missing.join(', ')}. Check more products (every supplier) and call plan_order again.`
        if (plan.total > ctx.profile.budgetPence) {
          await log('decision', `Cheapest plan is ${formatGBP(plan.total)}, over the ${formatGBP(ctx.profile.budgetPence)} budget: buying nothing this week`)
          return `The cheapest plan is ${formatGBP(plan.total)}, over the ${formatGBP(ctx.profile.budgetPence)} weekly budget. Don't buy anything: call finish and tell the office manager to raise the budget or trim the list.`
        }
        orders = plan.orders
        await update({ orders, comparison: plan.comparison, total: plan.total, bestSingleShop: plan.bestSingleShop, savings: plan.savings })
        const summary = plan.orders.map((o) => `${o.shopName} ${formatGBP(o.total)}`).join(' + ')
        const yardstick = plan.bestSingleShop && `${SHOPS.find((s) => s.slug === plan.bestSingleShop!.shop)!.name} + Viking for the rest`
        const vs = plan.bestSingleShop ? `; ${yardstick} would be ${formatGBP(plan.bestSingleShop.total)}, saving ${formatGBP(plan.savings ?? 0)}` : ''
        await log('decision', `Plan: ${summary} = ${formatGBP(plan.total)}${vs}`)
        return JSON.stringify({
          total: formatGBP(plan.total),
          usualWay: plan.bestSingleShop && { description: `one supermarket for everything it stocks (${yardstick}), what an office manager would normally do`, total: formatGBP(plan.bestSingleShop.total) },
          saving: plan.savings !== undefined ? formatGBP(plan.savings) : undefined,
          orders: plan.orders.map((o) => ({
            supplier: o.shopName,
            url: shopUrl(SHOPS.find((s) => s.slug === o.shop)!),
            items: o.items.map((i) => ({ id: i.id, product: i.name, packs: i.packs, packPrice: formatGBP(i.price) })),
            subtotal: formatGBP(o.subtotal),
            delivery: o.delivery ? formatGBP(o.delivery) : 'free',
            chargeExactly: formatGBP(o.total),
          })),
        })
      },
    }),
    betaZodTool({
      name: 'pay_at_checkout',
      description: "Pay on the current supplier's checkout page with your card. The basket must match the plan for this supplier exactly. Fills the card details for you and submits. Returns the outcome.",
      inputSchema: z.object({}),
      run: () => serial(async () => {
        if (!orders) return 'Call plan_order first.'
        const url = new URL(page.url())
        const shop = shopByHost(url.host)
        const order = orders.find((o) => o.shop === shop?.slug)
        if (!shop || !order) return `This supplier isn't in the plan.`
        if (order.status !== 'planned') return `${shop.name} is already ${order.status} this week.`
        if (!url.pathname.startsWith('/checkout')) return 'Go to the checkout page first.'
        const basket = JSON.parse((await page.locator('#checkout-form').getAttribute('data-basket')) ?? '{}') as Record<string, number>
        const want = Object.fromEntries(order.items.map((i) => [i.id, i.packs ?? 1]))
        const diff = [...new Set([...Object.keys(basket), ...Object.keys(want)])].filter((id) => basket[id] !== want[id]).map((id) => `${id}: basket ${basket[id] ?? 0}, plan ${want[id] ?? 0}`)
        if (diff.length) return `Refusing to pay: the basket doesn't match the plan for ${shop.name}. Fix these quantities first: ${diff.join('; ')}`
        const c = await getCardDetails()
        await log('pay', `Paying ${formatGBP(order.total)} at ${shop.name} with card ••${c.last4}`)
        await page.fill('#name', c.name)
        await page.fill('#card-number', c.number)
        await page.fill('#exp', `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}`)
        await page.fill('#cvc', c.cvc)
        await page.fill('#postcode', 'EC1A 1AA')
        await page.click('#pay-button')
        await page.waitForURL(/\/order\/|declined=/, { timeout: 45_000 })
        const after = new URL(page.url())
        let detail: string
        if (after.pathname.startsWith('/order/')) {
          order.status = 'paid'
          order.orderId = after.pathname.split('/').pop()!
          order.authorizationId = (await page.locator('#authorization-id').innerText()).trim()
          detail = `Approved at ${shop.name}. Order ${order.orderId}, Stripe authorization ${order.authorizationId}.`
        } else {
          order.status = 'declined'
          order.declineReason = after.searchParams.get('declined') ?? 'declined'
          detail = `Declined at ${shop.name}: ${order.declineReason}`
        }
        const allPaid = orders.every((o) => o.status === 'paid')
        await update({ orders, ...(allPaid ? { status: 'bought' } : {}) })
        await log('pay', detail)
        return detail + (allPaid ? ' All planned orders are paid.' : '')
      }),
    }),
    betaZodTool({
      name: 'finish',
      description: "End this week's run with a short note to the office manager.",
      inputSchema: z.object({ note: z.string() }),
      run: async ({ note }) => {
        finished = true
        await update({ note, status: weekStatus() })
        await log('done', note)
        return 'Done. Stop now.'
      },
    }),
  ]

  const weekStatus = () => {
    const paid = orders?.filter((o) => o.status === 'paid').length ?? 0
    return orders && paid === orders.length ? 'bought' : paid > 0 ? 'partial' : 'nothing-bought'
  }

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    // If a safety classifier declines a turn, the API retries it on a fallback model instead of stopping.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    max_iterations: 160,
    output_config: { effort: (process.env.AGENT_EFFORT as 'low' | 'medium' | 'high') ?? 'low' },
    system: SYSTEM,
    tools,
    messages: [{ role: 'user', content: `It's ${weekLabel(ctx.weekIndex)} (demo week ${ctx.weekIndex}). Do this week's restock.` }],
  })

  const timeout = new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), RUN_TIMEOUT_MS))
  try {
    const result = await Promise.race([runner, timeout]) // awaiting the runner drives the loop; .done() alone does not
    if (result === 'timeout') {
      await log('error', `Run hit the ${RUN_TIMEOUT_MS / 1000}s limit`)
      await update({ status: weekStatus() === 'nothing-bought' ? 'failed' : weekStatus() })
    } else if (!finished) {
      await update({ status: weekStatus() })
    }
  } catch (e) {
    await log('error', `Agent error: ${(e as Error).message}`)
    await update({ status: weekStatus() === 'nothing-bought' ? 'failed' : weekStatus() })
  } finally {
    await page.waitForTimeout(1500)
    await browser.close()
  }
}
