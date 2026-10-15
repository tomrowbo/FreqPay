// Scripted (no AI) end-to-end: plan -> basket -> pay with the agent's Issuing card -> webhook checks
// the charge against the plan. Then the same supplier again (must be declined: already paid).
import { chromium, type Page } from 'playwright'
import { getCardDetails } from '../lib/stripe'
import { priceBasket } from '../lib/basket'
import { shopBySlug } from '../lib/shops'

const APP = 'http://localhost:3000'
const base = 'http://iceland.localhost:3000'
const post = (path: string, body: unknown) => fetch(`${APP}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

const want = { 'ic-fanta-24': 2, 'ic-little-duck-24': 1, 'ic-easytea-240': 2 }
await post('/api/reset', {})
await post('/api/agent/week', { action: 'start', runId: 'smoke' })
const shop = shopBySlug('iceland')!
const b = priceBasket(shop, want, 1)
await post('/api/agent/week', { action: 'update', runId: 'smoke', fields: { orders: [{ shop: 'iceland', shopName: shop.name, items: b.lines.map((l) => ({ id: l.product.id, name: l.product.name, price: l.price, packs: l.qty })), subtotal: b.subtotal, delivery: b.delivery, total: b.total, status: 'planned' }] } })
console.log(`planned Iceland: ${b.subtotal} + ${b.delivery} = ${b.total}`)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
async function fillBasketAndPay(p: Page) {
  for (const [id, qty] of Object.entries(want)) {
    await p.goto(`${base}/p/${id}`)
    await p.getByRole('spinbutton').fill(String(qty))
    await p.getByRole('button', { name: /Add .* to basket|Update/ }).click()
    await p.waitForLoadState()
  }
  await p.goto(`${base}/checkout`)
  console.log('checkout total:', await p.locator('#checkout-total').innerText())
  const c = await getCardDetails()
  await p.fill('#name', c.name)
  await p.fill('#card-number', c.number)
  await p.fill('#exp', `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}`)
  await p.fill('#cvc', c.cvc)
  await p.fill('#postcode', 'EC1A 1AA')
  const t0 = Date.now()
  await p.click('#pay-button')
  await p.waitForURL(/\/order\/|declined=/, { timeout: 30000 })
  console.log(`result after ${Date.now() - t0}ms:`, decodeURIComponent(p.url()))
}
await fillBasketAndPay(page)
await fillBasketAndPay(page) // second time: policy must decline (already paid this week)
await browser.close()
